from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.schemas.quiz import QuizSummary
from app.schemas.history import ProjectHistoryResponse

# Project Quiz relationship
class ProjectQuizBase(BaseModel):
    quiz_id: int
    position: int

class ProjectQuizCreate(ProjectQuizBase):
    pass

class ProjectQuiz(ProjectQuizBase):
    project_id: int
    quiz: QuizSummary
    
    class Config:
        orm_mode = True
        from_attributes = True

# Project model
class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    use_default_prompt: bool = True
    custom_prompt: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    use_default_prompt: Optional[bool] = None
    custom_prompt: Optional[str] = None

class Project(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
        from_attributes = True

class ProjectWithQuizzes(Project):
    quizzes: List[ProjectQuiz] = []

class ProjectWithHistory(ProjectWithQuizzes):
    history: List[ProjectHistoryResponse] = []
