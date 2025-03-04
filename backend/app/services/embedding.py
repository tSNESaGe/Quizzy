import os
import json
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.types import TypeDecorator, UserDefinedType
import google.generativeai as genai
from sqlalchemy import text

from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
from app.models.document import Document
from app.database import Base
from app.config import settings

# Define our Vector type for SQLAlchemy
class Vector(UserDefinedType):
    def __init__(self, dimensions=None):
        self.dimensions = dimensions

    def get_col_spec(self, **kw):
        if self.dimensions is not None:
            return f"vector({self.dimensions})"
        else:
            return "vector"

    def bind_processor(self, dialect):
        def process(value):
            if value is None:
                return None
            # Convert numpy array or list to a string representation
            if isinstance(value, np.ndarray):
                return value.tolist()
            return value
        return process

    def result_processor(self, dialect, coltype):
        def process(value):
            if value is None:
                return None
            return np.array(value)
        return process

# Model for document chunks with embeddings
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    
    # Use our Vector type directly
    embedding = Column(Vector(settings.EMBEDDING_DIMENSIONS), nullable=True)
    
    # No table args for now as they were causing issues

# Document embedding service
class EmbeddingService:
    def __init__(self):
        # Initialize the embedding model via Gemini
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel('gemini-1.5-pro')
        self.embedding_dimensions = settings.EMBEDDING_DIMENSIONS
        
        # Initialize chunker
        self.chunker = HybridChunker(
            min_words_per_chunk=30,
            max_words_per_chunk=150,
            overlap=5
        )
        
        # Initialize document converter
        self.converter = DocumentConverter()
    
    async def process_document(self, db: Session, document_id: int) -> bool:
        """Process a document and create embeddings for chunks"""
        try:
            # Get the document from database
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                print(f"Document with ID {document_id} not found")
                return False
            
            # Check if this document already has chunks
            existing_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.document_id == document_id
            ).count()
            
            if existing_chunks > 0:
                # Delete existing chunks for this document
                db.query(DocumentChunk).filter(
                    DocumentChunk.document_id == document_id
                ).delete()
                db.commit()
            
            # We already have the text content in the document model
            # Now we need to chunk it
            chunks = self.chunk_text(document.content)
            
            # Create embeddings for each chunk
            for i, chunk_text in enumerate(chunks):
                embedding = await self.create_embedding(chunk_text)
                
                # Create document chunk with embedding
                if embedding is not None:
                    chunk = DocumentChunk(
                        document_id=document_id,
                        chunk_text=chunk_text,
                        chunk_index=i,
                        embedding=embedding.tolist()  # Convert numpy array to list
                    )
                    db.add(chunk)
            
            db.commit()
            return True
            
        except Exception as e:
            print(f"Error processing document: {str(e)}")
            db.rollback()
            return False
    
    def chunk_text(self, text: str) -> List[str]:
        """Chunk text using Docling HybridChunker"""
        try:
            # Convert text to paragraphs for chunking
            paragraphs = [p for p in text.split('\n\n') if p.strip()]
            chunks = []
            
            for p in paragraphs:
                # Process only substantial paragraphs
                if len(p.split()) > 10:
                    chunk_texts = self.chunker.chunk_text(p)
                    chunks.extend(chunk_texts)
                else:
                    # Keep short paragraphs as is
                    chunks.append(p)
            
            return chunks
        except Exception as e:
            print(f"Error chunking text: {str(e)}")
            # Fallback to simple chunking
            words = text.split()
            chunk_size = 100
            chunks = []
            
            for i in range(0, len(words), chunk_size):
                chunk = ' '.join(words[i:i+chunk_size])
                chunks.append(chunk)
            
            return chunks
    
    async def create_embedding(self, text: str) -> Optional[np.ndarray]:
        """Create embedding for text using Gemini"""
        try:
            response = await self.model.embed_content_async(
                model="embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            
            if response and response.embedding:
                return np.array(response.embedding)
            return None
        except Exception as e:
            print(f"Error creating embedding: {str(e)}")
            return None
    
    async def find_relevant_chunks(
        self, 
        db: Session, 
        query: str, 
        top_k: int = 5,
        document_ids: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """Find the most relevant document chunks for a query using pgvector"""
        try:
            # Create embedding for the query
            query_embedding = await self.create_embedding(query)
            if query_embedding is None:
                return []
            
            # Convert embedding to list for SQL
            query_embedding_list = query_embedding.tolist()
            
            # Prepare document filter
            doc_filter = ""
            if document_ids:
                doc_ids_str = ",".join(str(id) for id in document_ids)
                doc_filter = f"AND document_id IN ({doc_ids_str})"
            
            # Use PostgreSQL's vector operations to find similar chunks
            # Using pgvector's <=> operator for cosine distance
            sql_query = text(f"""
                SELECT 
                    id, 
                    document_id, 
                    chunk_text, 
                    chunk_index,
                    1 - (embedding <=> :query_embedding) AS similarity
                FROM 
                    document_chunks
                WHERE 
                    embedding IS NOT NULL
                    {doc_filter}
                ORDER BY 
                    embedding <=> :query_embedding
                LIMIT :top_k
            """)
            
            # Execute the query
            results = db.execute(
                sql_query, 
                {"query_embedding": query_embedding_list, "top_k": top_k}
            ).fetchall()
            
            # Format results
            formatted_results = []
            for row in results:
                formatted_results.append({
                    "chunk_id": row[0],
                    "document_id": row[1],
                    "text": row[2],
                    "chunk_index": row[3],
                    "similarity": float(row[4])
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"Error finding relevant chunks: {str(e)}")
            # Fallback to non-vector search if pgvector fails
            return await self._fallback_search(db, query, top_k, document_ids)
    
    async def _fallback_search(
        self,
        db: Session,
        query: str,
        top_k: int = 5,
        document_ids: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """Fallback search method using basic text matching"""
        query_terms = query.lower().split()
        
        # Get all document chunks
        chunk_query = db.query(DocumentChunk)
        if document_ids:
            chunk_query = chunk_query.filter(DocumentChunk.document_id.in_(document_ids))
        
        chunks = chunk_query.all()
        
        # Calculate basic text matching scores
        results = []
        for chunk in chunks:
            chunk_text = chunk.chunk_text.lower()
            
            # Simple scoring based on term frequency
            score = sum(chunk_text.count(term) for term in query_terms)
            
            # Normalize by length
            if len(chunk_text) > 0:
                score = score / len(chunk_text.split()) * 100
            
            results.append({
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "text": chunk.chunk_text,
                "chunk_index": chunk.chunk_index,
                "similarity": min(score / 10, 1.0)  # Normalize to 0-1 range
            })
        
        # Sort by score (descending)
        results.sort(key=lambda x: x["similarity"], reverse=True)
        
        # Return top k results
        return results[:top_k]