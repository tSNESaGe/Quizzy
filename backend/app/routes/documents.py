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
# Import the new, unified document processor
from app.utils.document_processor import DocumentProcessor
from app.config import settings
from app.services.embedding import EmbeddingService

router = APIRouter()
embedding_service = EmbeddingService()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    create_embeddings: bool = Form(False),
    force_upload: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enhanced document upload with advanced duplicate detection and processing
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file extension
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Check file size
    if len(file_content) > settings.MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=413, 
            detail=f"File size exceeds {settings.MAX_CONTENT_LENGTH / (1024*1024)}MB limit"
        )
    
    try:
        # Process document using enhanced processor
        processed_doc = document_processor.process_document(file.filename, file_content)
        
        # Check for duplicates
        existing_by_file_hash = db.query(Document).filter(
            Document.file_hash == processed_doc['file_hash'],
            Document.user_id == current_user.id
        ).first()
        
        existing_by_content_hash = db.query(Document).filter(
            Document.content_hash == processed_doc['content_hash'],
            Document.user_id == current_user.id
        ).first()
        
        # Duplicate handling logic
        if existing_by_file_hash or existing_by_content_hash:
            if not force_upload:
                # Prepare duplicate info
                duplicate = existing_by_file_hash or existing_by_content_hash
                return DocumentResponse(
                    **{
                        k: v for k, v in duplicate.__dict__.items() 
                        if k in ['id', 'filename', 'file_type', 'content', 'user_id', 'created_at']
                    },
                    embeddings_created=False,
                    warning=f"Duplicate document found: {duplicate.filename}"
                )
        
        # Create document record
        document = Document(
            filename=processed_doc['filename'],
            file_type=processed_doc['file_type'],
            content=processed_doc['content'],
            user_id=current_user.id,
            file_hash=processed_doc['file_hash'],
            content_hash=processed_doc['content_hash'],
            file_size=processed_doc['file_size'],
            raw_file_path=processed_doc['raw_file_path']
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Create embeddings if requested
        embeddings_created = False
        if create_embeddings:
            embeddings_created = await embedding_service.process_document(db, document.id)
        
        return DocumentResponse(
            **{
                k: v for k, v in document.__dict__.items() 
                if k in ['id', 'filename', 'file_type', 'content', 'user_id', 'created_at']
            },
            embeddings_created=embeddings_created
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

@router.post("/batch-upload")
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
    create_embeddings: bool = Form(False),
    force_upload: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Batch upload documents with advanced processing and duplicate detection
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Track upload progress and results
    upload_results = {
        'uploaded': [],
        'duplicates': [],
        'errors': []
    }
    
    for file in files:
        try:
            # Use the same upload logic as single file upload
            response = await upload_document(
                file=file, 
                create_embeddings=create_embeddings, 
                force_upload=force_upload,
                db=db, 
                current_user=current_user
            )
            
            # Categorize response
            if hasattr(response, 'warning') and response.warning:
                upload_results['duplicates'].append(response)
            else:
                upload_results['uploaded'].append(response)
        
        except HTTPException as e:
            upload_results['errors'].append({
                'filename': file.filename, 
                'error': e.detail
            })
    
    return upload_results

@router.post("/{document_id}/embeddings")
async def create_document_embeddings(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create embeddings for an existing document.
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
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
    Search for relevant document chunks based on semantic similarity.
    """
    if document_ids:
        user_docs = db.query(Document.id).filter(
            Document.id.in_(document_ids),
            Document.user_id == current_user.id
        ).all()
        user_doc_ids = [doc.id for doc in user_docs]
        document_ids = [doc_id for doc_id in document_ids if doc_id in user_doc_ids]
        if not document_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="None of the provided document IDs belong to the current user"
            )
    else:
        user_docs = db.query(Document.id).filter(Document.user_id == current_user.id).all()
        document_ids = [doc.id for doc in user_docs]
        if not document_ids:
            return []
    
    results = await embedding_service.find_relevant_chunks(
        db=db,
        query=query,
        top_k=top_k,
        document_ids=document_ids
    )
    
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
    Get all documents for the current user.
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
    Get a specific document by ID.
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
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
    Delete a document.
    """
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    from app.services.embedding import DocumentChunk
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}

@router.post("/preview", response_model=DocumentSummary)
async def preview_document(
    file: UploadFile = File(...),
):
    """
    Preview document contents without saving to the database.
    """
    filename = file.filename
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    extension = filename.lower().split('.')[-1]
    if extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {extension}. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    file_content = await file.read()
    if len(file_content) > settings.MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the maximum allowed ({settings.MAX_CONTENT_LENGTH / (1024 * 1024)}MB)"
        )
    
    try:
        file_type, extracted_text = await process_document(filename, file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not process document: {str(e)}"
        )
    
    preview = {
        "id": 0,
        "filename": filename,
        "file_type": file_type,
        "created_at": None,
        "content_preview": extracted_text[:500] + ("..." if len(extracted_text) > 500 else ""),
        "full_content": extracted_text,
        "markdown": extracted_text
    }
    
    return preview
