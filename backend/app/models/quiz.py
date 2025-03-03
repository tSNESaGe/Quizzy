# backend/app/models/quiz.py
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship

from app.database import Base

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    topic = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="quizzes")
    
    # Set default system prompt or use custom
    use_default_prompt = Column(Boolean, default=True)
    custom_prompt = Column(Text, nullable=True)
    
    # Source document tracking
    document_sources = Column(JSON, nullable=True)  # Store file names and types
    
    # Relationships
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    history = relationship("QuizHistory", back_populates="quiz", cascade="all, delete-orphan")
    projects = relationship("ProjectQuiz", back_populates="quiz")

