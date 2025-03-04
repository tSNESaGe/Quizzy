# backend/app/models/__init__.py

# Import all models first
from sqlalchemy.orm import relationship
from app.models.user import User
from app.models.quiz import Quiz
from app.models.question import Question, Answer, QuestionType
from app.models.document import Document
from app.models.project import Project, ProjectQuiz
from app.models.history import QuizHistory, QuestionHistory, ProjectHistory, ActionType

# Set up relationships that cause circular dependencies
Quiz.questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
Quiz.history = relationship("QuizHistory", back_populates="quiz", cascade="all, delete-orphan")
Quiz.projects = relationship("ProjectQuiz", back_populates="quiz")

Question.quiz = relationship("Quiz", back_populates="questions")
Question.answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
Question.history = relationship("QuestionHistory", back_populates="question", cascade="all, delete-orphan")

# Update these relationships in the history models
QuestionHistory.question = relationship("Question", back_populates="history", passive_deletes=True)
QuizHistory.quiz = relationship("Quiz", back_populates="history", passive_deletes=True)