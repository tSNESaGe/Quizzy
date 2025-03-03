from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Default system prompt preferences
    default_prompt = Column(Text, nullable=True)
    
    # Relationships
    quizzes = relationship("Quiz", back_populates="user")
    projects = relationship("Project", back_populates="user")
    quiz_history = relationship("QuizHistory", back_populates="user")
    question_history = relationship("QuestionHistory", back_populates="user")
    project_history = relationship("ProjectHistory", back_populates="user")