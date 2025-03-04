# backend/app/schemas/quiz.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# Question Types
class QuestionType(str, Enum):
    BOOLEAN = "boolean"
    MULTIPLE_CHOICE = "multiple_choice"
    OPEN_ENDED = "open_ended"

# Answer model
class AnswerBase(BaseModel):
    answer_text: str
    is_correct: bool
    position: int

class AnswerCreate(AnswerBase):
    pass

class AnswerUpdate(BaseModel):
    answer_text: Optional[str] = None
    is_correct: Optional[bool] = None
    position: Optional[int] = None

class Answer(AnswerBase):
    id: int
    question_id: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# Quiz summary for list views
class QuizSummary(BaseModel):
    id: int
    title: str
    topic: str
    created_at: datetime
    question_count: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# Question model
class QuestionBase(BaseModel):
    question_text: str
    question_type: QuestionType
    explanation: Optional[str] = None
    position: int

class QuestionCreate(QuestionBase):
    answers: List[AnswerCreate]

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    explanation: Optional[str] = None
    position: Optional[int] = None
    answers: Optional[List[AnswerCreate]] = None

class QuestionTypeChangeRequest(BaseModel):
    question_type: str

class Question(QuestionBase):
    id: int
    quiz_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    answers: List[Answer]
    
    class Config:
        orm_mode = True
        from_attributes = True
        json_encoders = {
            QuestionType: lambda v: v.value
        }

# Quiz model
class QuizBase(BaseModel):
    title: str
    topic: str
    description: Optional[str] = None
    use_default_prompt: bool = True
    custom_prompt: Optional[str] = None

class QuizCreate(QuizBase):
    pass

class QuizUpdate(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    description: Optional[str] = None
    use_default_prompt: Optional[bool] = None
    custom_prompt: Optional[str] = None

class Quiz(QuizBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    document_sources: Optional[Dict[str, Any]] = None
    questions: List[Question]
    
    class Config:
        orm_mode = True
        from_attributes = True

# Quiz generation request
class QuizGenerateRequest(BaseModel):
    topic: str
    num_questions: int = 10
    document_ids: Optional[List[int]] = None
    use_default_prompt: bool = True
    custom_prompt: Optional[str] = None
    use_embeddings: bool = True  # Option to use document embeddings for better context