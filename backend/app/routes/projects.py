from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.project import Project, ProjectQuiz
from app.models.quiz import Quiz
from app.models.history import ProjectHistory, ActionType
from app.schemas.project import (
    Project as ProjectSchema,
    ProjectCreate,
    ProjectUpdate,
    ProjectWithQuizzes,
    ProjectQuizCreate,
    ProjectWithHistory
)
from app.schemas.history import ProjectHistoryResponse
from app.services.auth import get_current_user
from app.services.history import HistoryService

router = APIRouter()

@router.post("", response_model=ProjectSchema)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project
    """
    db_project = Project(
        title=project.title,
        description=project.description,
        user_id=current_user.id,
        use_default_prompt=project.use_default_prompt,
        custom_prompt=project.custom_prompt if not project.use_default_prompt else None
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # Record creation in history
    HistoryService.record_project_action(
        db=db,
        project_id=db_project.id,
        user_id=current_user.id,
        action=ActionType.CREATE
    )
    
    return db_project

@router.get("", response_model=List[ProjectSchema])
def get_user_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all projects for the current user
    """
    projects = db.query(Project).filter(
        Project.user_id == current_user.id
    ).order_by(desc(Project.updated_at)).offset(skip).limit(limit).all()
    
    return projects

@router.get("/{project_id}", response_model=ProjectWithQuizzes)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project with its quizzes
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@router.put("/{project_id}", response_model=ProjectSchema)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update project details
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Store previous state for history
    previous_state = {
        "title": project.title,
        "description": project.description,
        "use_default_prompt": project.use_default_prompt,
        "custom_prompt": project.custom_prompt
    }
    
    # Update project fields
    update_data = project_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    
    # Record update in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.UPDATE,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(project)
    
    return project

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project (does not delete associated quizzes)
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Store previous state for history
    previous_state = {
        "title": project.title,
        "description": project.description,
        "use_default_prompt": project.use_default_prompt,
        "custom_prompt": project.custom_prompt,
        "quizzes": [
            {
                "quiz_id": pq.quiz_id,
                "position": pq.position
            } for pq in project.quizzes
        ]
    }
    
    # Record deletion in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.DELETE,
        previous_state=previous_state
    )
    
    # Remove project quiz associations
    db.query(ProjectQuiz).filter(ProjectQuiz.project_id == project_id).delete()
    
    # Delete the project
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}

@router.post("/{project_id}/quizzes", response_model=ProjectWithQuizzes)
def add_quiz_to_project(
    project_id: int,
    quiz_data: ProjectQuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a quiz to a project
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify quiz exists and belongs to user
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_data.quiz_id,
        Quiz.user_id == current_user.id
    ).first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check if quiz is already in the project
    existing = db.query(ProjectQuiz).filter(
        ProjectQuiz.project_id == project_id,
        ProjectQuiz.quiz_id == quiz_data.quiz_id
    ).first()
    
    # Store previous state for history
    previous_state = {
        "quizzes": [
            {
                "quiz_id": pq.quiz_id,
                "position": pq.position
            } for pq in project.quizzes
        ]
    }
    
    if existing:
        # Update position if it already exists
        existing.position = quiz_data.position
    else:
        # Create new association
        project_quiz = ProjectQuiz(
            project_id=project_id,
            quiz_id=quiz_data.quiz_id,
            position=quiz_data.position
        )
        db.add(project_quiz)
    
    # Record action in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.ADD_QUIZ,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(project)
    
    return project

@router.delete("/{project_id}/quizzes/{quiz_id}")
def remove_quiz_from_project(
    project_id: int,
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a quiz from a project
    """
    # Verify project exists and belongs to user
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Store previous state for history
    previous_state = {
        "quizzes": [
            {
                "quiz_id": pq.quiz_id,
                "position": pq.position
            } for pq in project.quizzes
        ]
    }
    
    # Remove the association
    result = db.query(ProjectQuiz).filter(
        ProjectQuiz.project_id == project_id,
        ProjectQuiz.quiz_id == quiz_id
    ).delete()
    
    if result == 0:
        raise HTTPException(status_code=404, detail="Quiz not found in project")
    
    # Record action in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.REMOVE_QUIZ,
        previous_state=previous_state
    )
    
    db.commit()
    
    return {"message": "Quiz removed from project successfully"}

@router.put("/{project_id}/quizzes/reorder", response_model=ProjectWithQuizzes)
def reorder_project_quizzes(
    project_id: int,
    quiz_orders: List[ProjectQuizCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder quizzes in a project
    """
    # Verify project exists and belongs to user
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Store previous state for history
    previous_state = {
        "quizzes": [
            {
                "quiz_id": pq.quiz_id,
                "position": pq.position
            } for pq in project.quizzes
        ]
    }
    
    # Update positions
    for quiz_order in quiz_orders:
        project_quiz = db.query(ProjectQuiz).filter(
            ProjectQuiz.project_id == project_id,
            ProjectQuiz.quiz_id == quiz_order.quiz_id
        ).first()
        
        if project_quiz:
            project_quiz.position = quiz_order.position
    
    # Record action in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.REORDER,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(project)
    
    return project

@router.get("/{project_id}/history", response_model=List[ProjectHistoryResponse])
def get_project_history(
    project_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the edit history for a project
    """
    # Verify project belongs to user
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    history = HistoryService.get_project_history(db=db, project_id=project_id, limit=limit)
    return history

@router.post("/{project_id}/revert", response_model=ProjectWithQuizzes)
def revert_project(
    project_id: int,
    history_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revert a project to a previous state
    """
    # Verify project belongs to user and exists
    project = db.query(Project).filter(
        Project.id == project_id, 
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the history entry to revert to
    if history_id:
        history = db.query(ProjectHistory).filter(
            ProjectHistory.id == history_id,
            ProjectHistory.project_id == project_id,
            ProjectHistory.previous_state.isnot(None)
        ).first()
        
        if not history or not history.previous_state:
            raise HTTPException(status_code=404, detail="History entry not found")
    else:
        # Get the most recent history entry with a previous state
        history = db.query(ProjectHistory).filter(
            ProjectHistory.project_id == project_id,
            ProjectHistory.previous_state.isnot(None)
        ).order_by(desc(ProjectHistory.timestamp)).first()
        
        if not history:
            raise HTTPException(status_code=404, detail="No history available to revert to")
    
    # Store the current state for a new history entry
    current_state = {
        "title": project.title,
        "description": project.description,
        "use_default_prompt": project.use_default_prompt,
        "custom_prompt": project.custom_prompt,
        "quizzes": [
            {
                "quiz_id": pq.quiz_id,
                "position": pq.position
            } for pq in project.quizzes
        ]
    }
    
    # Update project metadata if present in history
    if "title" in history.previous_state:
        project.title = history.previous_state["title"]
    if "description" in history.previous_state:
        project.description = history.previous_state["description"]
    if "use_default_prompt" in history.previous_state:
        project.use_default_prompt = history.previous_state["use_default_prompt"]
    if "custom_prompt" in history.previous_state:
        project.custom_prompt = history.previous_state["custom_prompt"]
    
    # If the history contains quiz associations, revert those
    if "quizzes" in history.previous_state:
        # Delete existing quiz associations
        db.query(ProjectQuiz).filter(ProjectQuiz.project_id == project_id).delete()
        
        # Recreate quiz associations from history
        for quiz_data in history.previous_state["quizzes"]:
            db_project_quiz = ProjectQuiz(
                project_id=project_id,
                quiz_id=quiz_data["quiz_id"],
                position=quiz_data["position"]
            )
            db.add(db_project_quiz)
    
    # Record this reversion in history
    HistoryService.record_project_action(
        db=db,
        project_id=project.id,
        user_id=current_user.id,
        action=ActionType.REVERT,
        previous_state=current_state
    )
    
    db.commit()
    db.refresh(project)
    
    return project