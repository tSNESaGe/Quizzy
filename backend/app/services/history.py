from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.history import QuizHistory, QuestionHistory, ProjectHistory, ActionType

class HistoryService:
    @staticmethod
    def get_quiz_history(
        db: Session,
        quiz_id: int,
        limit: int = 50
    ) -> List[QuizHistory]:
        """
        Get the edit history for a specific quiz
        """
        return db.query(QuizHistory).filter(
            QuizHistory.quiz_id == quiz_id
        ).order_by(desc(QuizHistory.timestamp)).limit(limit).all()
    
    @staticmethod
    def get_question_history(
        db: Session,
        question_id: int,
        limit: int = 50
    ) -> List[QuestionHistory]:
        """
        Get the edit history for a specific question
        """
        return db.query(QuestionHistory).filter(
            QuestionHistory.question_id == question_id
        ).order_by(desc(QuestionHistory.timestamp)).limit(limit).all()
    
    @staticmethod
    def get_project_history(
        db: Session,
        project_id: int,
        limit: int = 50
    ) -> List[ProjectHistory]:
        """
        Get the edit history for a specific project
        """
        return db.query(ProjectHistory).filter(
            ProjectHistory.project_id == project_id
        ).order_by(desc(ProjectHistory.timestamp)).limit(limit).all()
    
    @staticmethod
    def get_user_history(
        db: Session,
        user_id: int,
        limit: int = 50
    ) -> Dict[str, List[Union[QuizHistory, QuestionHistory, ProjectHistory]]]:
        """
        Get all edit history for a user (quizzes, questions, and projects)
        """
        quiz_history = db.query(QuizHistory).filter(
            QuizHistory.user_id == user_id
        ).order_by(desc(QuizHistory.timestamp)).limit(limit).all()
        
        question_history = db.query(QuestionHistory).filter(
            QuestionHistory.user_id == user_id
        ).order_by(desc(QuestionHistory.timestamp)).limit(limit).all()
        
        project_history = db.query(ProjectHistory).filter(
            ProjectHistory.user_id == user_id
        ).order_by(desc(ProjectHistory.timestamp)).limit(limit).all()
        
        return {
            "quiz_history": quiz_history,
            "question_history": question_history,
            "project_history": project_history
        }
    
    @staticmethod
    def record_quiz_action(
        db: Session,
        quiz_id: int,
        user_id: int,
        action: ActionType,
        previous_state: Optional[Dict[str, Any]] = None
    ) -> QuizHistory:
        """
        Record a quiz action in the history
        """
        history_entry = QuizHistory(
            quiz_id=quiz_id,
            user_id=user_id,
            action=action,
            previous_state=previous_state
        )
        
        db.add(history_entry)
        db.commit()
        db.refresh(history_entry)
        
        return history_entry
    
    @staticmethod
    def record_question_action(
        db: Session,
        question_id: int,
        user_id: int,
        action: ActionType,
        previous_state: Optional[Dict[str, Any]] = None
    ) -> QuestionHistory:
        """
        Record a question action in the history
        """
        history_entry = QuestionHistory(
            question_id=question_id,
            user_id=user_id,
            action=action,
            previous_state=previous_state
        )
        
        db.add(history_entry)
        db.commit()
        db.refresh(history_entry)
        
        return history_entry
    
    @staticmethod
    def record_project_action(
        db: Session,
        project_id: int,
        user_id: int,
        action: ActionType,
        previous_state: Optional[Dict[str, Any]] = None
    ) -> ProjectHistory:
        """
        Record a project action in the history
        """
        history_entry = ProjectHistory(
            project_id=project_id,
            user_id=user_id,
            action=action,
            previous_state=previous_state
        )
        
        db.add(history_entry)
        db.commit()
        db.refresh(history_entry)
        
        return history_entry