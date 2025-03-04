# backend/app/routes/documents.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentResponse, DocumentSummary, RelevantChunk
from app.services.auth import get_current_user
from app.utils.document_processor import process_document
from app.config import settings
from app.services.embedding import EmbeddingService

router = APIRouter()
embedding_service = EmbeddingService()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    create_embeddings: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process a document for quiz generation
    """
    # Check file extension to determine type
    filename = file.filename
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    # Validate file extension
    extension = filename.lower().split('.')[-1]
    if extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {extension}. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    # Process file based on its type
    file_content = await file.read()
    
    # Check if file exceeds maximum size
    if len(file_content) > settings.MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed ({settings.MAX_CONTENT_LENGTH / (1024 * 1024)}MB)"
        )
    
    # Extract text content based on file type
    try:
        file_type, extracted_text = await process_document(filename, file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process document: {str(e)}"
        )
    
    # Create document record
    document = Document(
        filename=filename,
        file_type=file_type,
        content=extracted_text,
        user_id=current_user.id
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Create embeddings if requested
    if create_embeddings:
        success = await embedding_service.process_document(db, document.id)
        if not success:
            # Still return the document, but with a warning
            return DocumentResponse(
                id=document.id,
                filename=document.filename,
                file_type=document.file_type,
                content=document.content,
                user_id=document.user_id,
                created_at=document.created_at,
                embeddings_created=False,
                warning="Failed to create embeddings for document"
            )
    
    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        content=document.content,
        user_id=document.user_id,
        created_at=document.created_at,
        embeddings_created=create_embeddings
    )

@router.post("/batch-upload", response_model=List[DocumentResponse])
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
    create_embeddings: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process multiple documents at once
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    documents = []
    
    for file in files:
        filename = file.filename
        if not filename:
            continue
        
        # Validate file extension
        extension = filename.lower().split('.')[-1]
        if extension not in settings.ALLOWED_EXTENSIONS:
            continue
        
        # Process file
        file_content = await file.read()
        
        # Check file size
        if len(file_content) > settings.MAX_CONTENT_LENGTH:
            continue
        
        try:
            file_type, extracted_text = await process_document(filename, file_content)
            
            # Create document record
            document = Document(
                filename=filename,
                file_type=file_type,
                content=extracted_text,
                user_id=current_user.id
            )
            
            db.add(document)
            db.commit()
            db.refresh(document)
            
            # Create embeddings if requested
            embeddings_created = False
            if create_embeddings:
                embeddings_created = await embedding_service.process_document(db, document.id)
            
            documents.append(DocumentResponse(
                id=document.id,
                filename=document.filename,
                file_type=document.file_type,
                content=document.content,
                user_id=document.user_id,
                created_at=document.created_at,
                embeddings_created=embeddings_created
            ))
            
        except Exception as e:
            print(f"Error processing {filename}: {str(e)}")
    
    if not documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not process any of the provided documents"
        )
    
    return documents

@router.post("/{document_id}/embeddings")
async def create_document_embeddings(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create embeddings for an existing document
    """
    # Verify document exists and belongs to user
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Create embeddings
    success = await embedding_service.process_document(db, document_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create document embeddings"
        )
    
    return {"message": "Document embeddings created successfully"}

@router.get("/search", response_model=List[RelevantChunk])
async def search_documents(
    query: str,
    document_ids: Optional[List[int]] = Query(None),
    top_k: int = Query(5, gt=0, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search for relevant document chunks based on semantic similarity
    """
    # If document_ids provided, verify they belong to the user
    if document_ids:
        user_docs = db.query(Document.id).filter(
            Document.id.in_(document_ids),
            Document.user_id == current_user.id
        ).all()
        
        user_doc_ids = [doc.id for doc in user_docs]
        
        # Filter out any document IDs that don't belong to user
        document_ids = [doc_id for doc_id in document_ids if doc_id in user_doc_ids]
        
        if not document_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="None of the provided document IDs belong to the current user"
            )
    else:
        # If no document_ids provided, search across all user documents
        user_docs = db.query(Document.id).filter(Document.user_id == current_user.id).all()
        document_ids = [doc.id for doc in user_docs]
        
        if not document_ids:
            return []
    
    # Search for relevant chunks
    results = await embedding_service.find_relevant_chunks(
        db=db,
        query=query,
        top_k=top_k,
        document_ids=document_ids
    )
    
    # Get document information for each chunk
    for result in results:
        doc = db.query(Document).filter(Document.id == result["document_id"]).first()
        if doc:
            result["document_filename"] = doc.filename
    
    return results

@router.get("", response_model=List[DocumentSummary])
def get_user_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all documents for the current user
    """
    documents = db.query(Document).filter(
        Document.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    return documents

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific document by ID
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if document has embeddings
    from app.services.embedding import DocumentChunk
    has_embeddings = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).count() > 0
    
    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        content=document.content,
        user_id=document.user_id,
        created_at=document.created_at,
        embeddings_created=has_embeddings
    )

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete any associated chunks first
    from app.services.embedding import DocumentChunk
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    
    # Delete the document
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.post("/preview", response_model=DocumentSummary)
async def preview_document(
    file: UploadFile = File(...),
):
    """
    Preview document contents without saving to database
    """
    # Check file extension to determine type
    filename = file.filename
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    # Validate file extension
    extension = filename.lower().split('.')[-1]
    if extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {extension}. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    # Process file based on its type
    file_content = await file.read()
    
    # Check if file exceeds maximum size
    if len(file_content) > settings.MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed ({settings.MAX_CONTENT_LENGTH / (1024 * 1024)}MB)"
        )
    
    # Extract text content based on file type
    try:
        file_type, extracted_text = await process_document(filename, file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process document: {str(e)}"
        )
    
    # Create a preview summary
    preview = {
        "id": 0,  # Placeholder
        "filename": filename,
        "file_type": file_type,
        "created_at": None,  # Placeholder
        "content_preview": extracted_text[:500] + ("..." if len(extracted_text) > 500 else "")
    }
    
    return preview