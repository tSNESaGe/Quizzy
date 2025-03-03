# backend/app/routes/documents.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path

from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentResponse, DocumentSummary
from app.services.auth import get_current_user
from app.utils.document_processor import process_document
from app.config import settings

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
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
    
    return document

@router.post("/batch-upload", response_model=List[DocumentResponse])
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
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
            
            documents.append(document)
        except Exception as e:
            print(f"Error processing {filename}: {str(e)}")
    
    if not documents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not process any of the provided documents"
        )
    
    return documents

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
    
    return document

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