import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship

from app.database import Base

class ActionType(enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    REGENERATE = "REGENERATE"
    REVERT = "REVERT"
    ADD_QUIZ = "ADD_QUIZ"
    REMOVE_QUIZ = "REMOVE_QUIZ"
    REORDER = "REORDER"
    REMOVE_FROM_QUIZ = "REMOVE_FROM_QUIZ"
    REMOVE_QUESTION = "REMOVE_QUESTION"

class QuizHistory(Base):
    __tablename__ = "quiz_history"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(Enum(ActionType), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Store the previous state for reversion
    previous_state = Column(JSON, nullable=True)
    
    quiz = relationship("Quiz", back_populates="history")
    user = relationship("User", back_populates="quiz_history")

class QuestionHistory(Base):
    __tablename__ = "question_history"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(Enum(ActionType), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Store the previous state for reversion
    previous_state = Column(JSON, nullable=True)
    
    question = relationship("Question", back_populates="history")
    user = relationship("User", back_populates="question_history")

class ProjectHistory(Base):
    __tablename__ = "project_history"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(Enum(ActionType), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Store the previous state for reversion
    previous_state = Column(JSON, nullable=True)
    
    project = relationship("Project", back_populates="history")
    user = relationship("User", back_populates="project_history")