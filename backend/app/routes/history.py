from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.quiz import Quiz
from app.models.question import Question
from app.models.project import Project
from app.models.history import QuizHistory, QuestionHistory, ProjectHistory, ActionType
from app.schemas.history import (
    UserHistoryResponse, 
    HistorySummary, 
    QuizHistoryResponse,
    QuestionHistoryResponse,
    ProjectHistoryResponse,
    DetailedHistoryResponse,
    HistoryFilter
)
from app.services.auth import get_current_user
from app.services.history import HistoryService

router = APIRouter()

@router.get("/user", response_model=UserHistoryResponse)
def get_user_history(
    limit: int = 50,
    action_types: Optional[List[ActionType]] = Query(None),
    entity_types: Optional[List[str]] = Query(None),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all edit history for the current user with optional filtering
    """
    # Create filter object
    history_filter = HistoryFilter(
        action_types=action_types,
        entity_types=entity_types,
        date_from=date_from,
        date_to=date_to
    )
    
    history = HistoryService.get_user_history(
        db=db,
        user_id=current_user.id,
        limit=limit,
        filter_params=history_filter
    )
    
    return history

@router.get("/summary", response_model=List[HistorySummary])
def get_history_summary(
    limit: int = 50,
    action_types: Optional[List[ActionType]] = Query(None),
    entity_types: Optional[List[str]] = Query(None),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a combined and simplified summary of all user history actions with filtering
    """
    # Create filter object
    history_filter = HistoryFilter(
        action_types=action_types,
        entity_types=entity_types,
        date_from=date_from,
        date_to=date_to
    )
    
    history = HistoryService.get_user_history(
        db=db,
        user_id=current_user.id,
        limit=limit,
        filter_params=history_filter
    )
    
    # Convert to summary format
    summary = []
    
    # Process quiz history
    for item in history["quiz_history"]:
        quiz = db.query(Quiz).filter(Quiz.id == item.quiz_id).first()
        quiz_title = quiz.title if quiz else f"Quiz ID {item.quiz_id}"
        
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="quiz",
            entity_id=item.quiz_id,
            entity_name=quiz_title,
            changes_summary=HistoryService.summarize_changes(item.previous_state, item.action)
        ))
    
    # Process question history
    for item in history["question_history"]:
        question = db.query(Question).filter(Question.id == item.question_id).first()
        quiz_id = question.quiz_id if question else None
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first() if quiz_id else None
        
        question_text = question.question_text[:50] + "..." if question and len(question.question_text) > 50 else (
            question.question_text if question else f"Question ID {item.question_id}")
        
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="question",
            entity_id=item.question_id,
            parent_id=quiz_id,
            parent_name=quiz.title if quiz else None,
            entity_name=question_text,
            changes_summary=HistoryService.summarize_changes(item.previous_state, item.action)
        ))
    
    # Process project history
    for item in history["project_history"]:
        project = db.query(Project).filter(Project.id == item.project_id).first()
        project_name = project.title if project else f"Project ID {item.project_id}"
        
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="project",
            entity_id=item.project_id,
            entity_name=project_name,
            changes_summary=HistoryService.summarize_changes(item.previous_state, item.action)
        ))
    
    # Sort by timestamp (newest first)
    summary.sort(key=lambda x: x.timestamp, reverse=True)
    
    # Limit results
    return summary[:limit]

@router.get("/detail/{entity_type}/{history_id}", response_model=DetailedHistoryResponse)
def get_history_detail(
    entity_type: str,
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed history information for a specific history entry
    """
    if entity_type not in ["quiz", "question", "project"]:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    history_item = None
    
    # Get the history item based on entity type
    if entity_type == "quiz":
        history_item = db.query(QuizHistory).filter(
            QuizHistory.id == history_id
        ).first()
        
        if history_item:
            # Verify the user owns the quiz
            quiz = db.query(Quiz).filter(
                Quiz.id == history_item.quiz_id,
                Quiz.user_id == current_user.id
            ).first()
            
            if not quiz:
                history_item = None
    
    elif entity_type == "question":
        history_item = db.query(QuestionHistory).filter(
            QuestionHistory.id == history_id
        ).first()
        
        if history_item:
            # Verify the user owns the question's quiz
            question = db.query(Question).filter(Question.id == history_item.question_id).first()
            if question:
                quiz = db.query(Quiz).filter(
                    Quiz.id == question.quiz_id,
                    Quiz.user_id == current_user.id
                ).first()
                
                if not quiz:
                    history_item = None
    
    elif entity_type == "project":
        history_item = db.query(ProjectHistory).filter(
            ProjectHistory.id == history_id
        ).first()
        
        if history_item:
            # Verify the user owns the project
            project = db.query(Project).filter(
                Project.id == history_item.project_id,
                Project.user_id == current_user.id
            ).first()
            
            if not project:
                history_item = None
    
    if not history_item:
        raise HTTPException(status_code=404, detail="History entry not found or not authorized")
    
    # Create the detailed response
    changes = HistoryService.get_detailed_changes(history_item.previous_state, history_item.action)
    
    # Get entity information
    entity_info = None
    if entity_type == "quiz":
        quiz = db.query(Quiz).filter(Quiz.id == history_item.quiz_id).first()
        if quiz:
            entity_info = {
                "id": quiz.id,
                "title": quiz.title,
                "type": "quiz"
            }
    elif entity_type == "question":
        question = db.query(Question).filter(Question.id == history_item.question_id).first()
        if question:
            entity_info = {
                "id": question.id,
                "text": question.question_text,
                "quiz_id": question.quiz_id,
                "type": "question"
            }
    elif entity_type == "project":
        project = db.query(Project).filter(Project.id == history_item.project_id).first()
        if project:
            entity_info = {
                "id": project.id,
                "title": project.title,
                "type": "project"
            }
    
    return DetailedHistoryResponse(
        id=history_item.id,
        action=history_item.action,
        timestamp=history_item.timestamp,
        entity_type=entity_type,
        entity_id=getattr(history_item, f"{entity_type}_id"),
        entity_info=entity_info,
        user_id=history_item.user_id,
        changes=changes,
        can_revert=history_item.previous_state is not None
    )

@router.get("/activity-log", response_model=List[HistorySummary])
def get_activity_log(
    limit: int = 100,
    skip: int = 0,
    action_types: Optional[List[ActionType]] = Query(None),
    entity_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a chronological log of all user activity
    """
    # Create filter parameters
    history_filter = HistoryFilter(
        action_types=action_types,
        entity_types=entity_types
    )
    
    return HistoryService.get_activity_log(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        filter_params=history_filter
    )

@router.get("/stats", response_model=Dict[str, Any])
def get_history_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about user activity and edits
    """
    return HistoryService.get_history_stats(db=db, user_id=current_user.id)