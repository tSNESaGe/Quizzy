# backend/app/schemas/document.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Base Document model
class DocumentBase(BaseModel):
    filename: str
    file_type: str
    content: str

# Document creation model
class DocumentCreate(DocumentBase):
    pass

# Complete Document model for responses
class DocumentResponse(DocumentBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True
        from_attributes = True

# Document with minimal content for list views
class DocumentSummary(BaseModel):
    id: int
    filename: str
    file_type: str
    created_at: datetime
    
    class Config:
        orm_mode = True
        from_attributes = True