from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum

# Action Types
class ActionType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    REGENERATE = "regenerate"
    REVERT = "revert"
    ADD_QUIZ = "add_quiz"
    REMOVE_QUIZ = "remove_quiz"
    REORDER = "reorder"

# Base History model
class HistoryBase(BaseModel):
    action: ActionType
    timestamp: datetime
    previous_state: Optional[Dict[str, Any]] = None

# Quiz History model
class QuizHistoryResponse(HistoryBase):
    id: int
    quiz_id: int
    user_id: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# Question History model
class QuestionHistoryResponse(HistoryBase):
    id: int
    question_id: int
    user_id: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# Project History model
class ProjectHistoryResponse(HistoryBase):
    id: int
    project_id: int
    user_id: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# History summary for display to users
class HistorySummary(BaseModel):
    id: int
    action: ActionType
    timestamp: datetime
    entity_type: str  # "quiz", "question", or "project"
    entity_id: int
    
    class Config:
        orm_mode = True
        from_attributes = True

# User's complete edit history
class UserHistoryResponse(BaseModel):
    quiz_history: List[QuizHistoryResponse]
    question_history: List[QuestionHistoryResponse]
    project_history: List[ProjectHistoryResponse]
