# backend/app/models/question.py
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Enum, JSON
from sqlalchemy.orm import relationship

from app.database import Base

class QuestionType(enum.Enum):
    BOOLEAN = "boolean"
    MULTIPLE_CHOICE = "multiple_choice"
    OPEN_ENDED = "open_ended"
    
    def __str__(self):
        return self.value
    
class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    explanation = Column(Text, nullable=True)
    position = Column(Integer, nullable=False)  # For ordering
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
    history = relationship("QuestionHistory", back_populates="question", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
    position = Column(Integer, nullable=False)  # For ordering
    
    question = relationship("Question", back_populates="answers")