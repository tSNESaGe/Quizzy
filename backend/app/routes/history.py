from typing import Dict, List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.history import UserHistoryResponse, HistorySummary
from app.services.auth import get_current_user
from app.services.history import HistoryService

router = APIRouter()

@router.get("/user", response_model=UserHistoryResponse)
def get_user_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all edit history for the current user
    """
    history = HistoryService.get_user_history(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    
    return history

@router.get("/summary", response_model=List[HistorySummary])
def get_history_summary(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a combined and simplified summary of all user history actions
    """
    history = HistoryService.get_user_history(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    
    # Convert to summary format
    summary = []
    
    # Process quiz history
    for item in history["quiz_history"]:
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="quiz",
            entity_id=item.quiz_id
        ))
    
    # Process question history
    for item in history["question_history"]:
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="question",
            entity_id=item.question_id
        ))
    
    # Process project history
    for item in history["project_history"]:
        summary.append(HistorySummary(
            id=item.id,
            action=item.action,
            timestamp=item.timestamp,
            entity_type="project",
            entity_id=item.project_id
        ))
    
    # Sort by timestamp (newest first)
    summary.sort(key=lambda x: x.timestamp, reverse=True)
    
    # Limit results
    return summary[:limit]