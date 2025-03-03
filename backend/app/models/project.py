from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table, Boolean
from sqlalchemy.orm import relationship

from app.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="projects")
    
    # Custom system prompt for the entire project
    use_default_prompt = Column(Boolean, default=True)
    custom_prompt = Column(Text, nullable=True)
    
    # Relationship with quizzes
    quizzes = relationship("ProjectQuiz", back_populates="project", cascade="all, delete-orphan")
    
    # Add relationship with history
    history = relationship("ProjectHistory", back_populates="project", cascade="all, delete-orphan")

class ProjectQuiz(Base):
    __tablename__ = "project_quizzes"
    
    project_id = Column(Integer, ForeignKey("projects.id"), primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), primary_key=True)
    position = Column(Integer, nullable=False)  # For ordering
    
    project = relationship("Project", back_populates="quizzes")
    quiz = relationship("Quiz", back_populates="projects")