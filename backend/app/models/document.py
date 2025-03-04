# backend/app/models/document.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, BigInteger
from sqlalchemy.orm import relationship
import os
import hashlib

from app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    file_size = Column(BigInteger, nullable=True)  # Store file size in bytes
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Hash fields
    file_hash = Column(String(64), nullable=True, index=True)
    content_hash = Column(String(64), nullable=True, index=True)
    
    # File path for raw storage
    raw_file_path = Column(String(512), nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="documents")
    
    @staticmethod
    def calculate_file_hash(file_content):
        """Calculate SHA-256 hash of file content"""
        return hashlib.sha256(file_content).hexdigest()
    
    @staticmethod
    def calculate_content_hash(content):
        """Calculate SHA-256 hash of extracted text content"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    @staticmethod
    def get_unique_filename(upload_folder, original_filename, file_hash):
        """Generate a unique filename for storing raw file"""
        # Create hash-based directory structure to avoid too many files in one directory
        hash_dir = os.path.join(upload_folder, file_hash[:2], file_hash[2:4])
        os.makedirs(hash_dir, exist_ok=True)
        
        # Use hash as part of filename to ensure uniqueness
        _, ext = os.path.splitext(original_filename)
        unique_filename = f"{file_hash}{ext}"
        return os.path.join(hash_dir, unique_filename)

# Add the relationship to the User model
from app.models.user import User
User.documents = relationship("Document", back_populates="user")