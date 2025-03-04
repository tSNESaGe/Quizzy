from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, or_
import json

from app.models.history import QuizHistory, QuestionHistory, ProjectHistory, ActionType
from app.models.quiz import Quiz
from app.models.question import Question
from app.models.project import Project
from app.schemas.history import HistoryFilter, HistorySummary

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
        limit: int = 50,
        filter_params: Optional[HistoryFilter] = None
    ) -> Dict[str, List[Union[QuizHistory, QuestionHistory, ProjectHistory]]]:
        """
        Get all edit history for a user (quizzes, questions, and projects) with filtering
        """
        # Base queries
        quiz_query = db.query(QuizHistory).filter(QuizHistory.user_id == user_id)
        question_query = db.query(QuestionHistory).filter(QuestionHistory.user_id == user_id)
        project_query = db.query(ProjectHistory).filter(ProjectHistory.user_id == user_id)
        
        # Apply filters if provided
        if filter_params:
            # Filter by action types
            if filter_params.action_types:
                quiz_query = quiz_query.filter(QuizHistory.action.in_(filter_params.action_types))
                question_query = question_query.filter(QuestionHistory.action.in_(filter_params.action_types))
                project_query = project_query.filter(ProjectHistory.action.in_(filter_params.action_types))
            
            # Filter by entity types
            if filter_params.entity_types:
                # Include empty lists for filtered out entity types
                if "quiz" not in filter_params.entity_types:
                    quiz_query = db.query(QuizHistory).filter(False)  # Empty query
                if "question" not in filter_params.entity_types:
                    question_query = db.query(QuestionHistory).filter(False)  # Empty query
                if "project" not in filter_params.entity_types:
                    project_query = db.query(ProjectHistory).filter(False)  # Empty query
            
            # Filter by date range
            if filter_params.date_from:
                try:
                    date_from = datetime.fromisoformat(filter_params.date_from)
                    quiz_query = quiz_query.filter(QuizHistory.timestamp >= date_from)
                    question_query = question_query.filter(QuestionHistory.timestamp >= date_from)
                    project_query = project_query.filter(ProjectHistory.timestamp >= date_from)
                except ValueError:
                    pass  # Invalid date format, ignore
            
            if filter_params.date_to:
                try:
                    date_to = datetime.fromisoformat(filter_params.date_to)
                    # Add one day to include the end date fully
                    date_to = date_to + timedelta(days=1)
                    quiz_query = quiz_query.filter(QuizHistory.timestamp <= date_to)
                    question_query = question_query.filter(QuestionHistory.timestamp <= date_to)
                    project_query = project_query.filter(ProjectHistory.timestamp <= date_to)
                except ValueError:
                    pass  # Invalid date format, ignore
        
        # Execute queries with limit
        quiz_history = quiz_query.order_by(desc(QuizHistory.timestamp)).limit(limit).all()
        question_history = question_query.order_by(desc(QuestionHistory.timestamp)).limit(limit).all()
        project_history = project_query.order_by(desc(ProjectHistory.timestamp)).limit(limit).all()
        
        return {
            "quiz_history": quiz_history,
            "question_history": question_history,
            "project_history": project_history
        }
    
    @staticmethod
    def get_activity_log(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        filter_params: Optional[HistoryFilter] = None
    ) -> List[HistorySummary]:
        """
        Get a chronological log of all user activity
        """
        # Get the filtered history
        history = HistoryService.get_user_history(
            db=db,
            user_id=user_id,
            limit=limit * 3,  # Get more items since we'll be filtering and sorting
            filter_params=filter_params
        )
        
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
        
        # Apply pagination
        return summary[skip:skip + limit]
    
    @staticmethod
    def get_history_stats(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Get statistics about user history and edits
        """
        # Count total actions by type
        quiz_counts = db.query(QuizHistory.action, func.count(QuizHistory.id)).filter(
            QuizHistory.user_id == user_id
        ).group_by(QuizHistory.action).all()
        
        question_counts = db.query(QuestionHistory.action, func.count(QuestionHistory.id)).filter(
            QuestionHistory.user_id == user_id
        ).group_by(QuestionHistory.action).all()
        
        project_counts = db.query(ProjectHistory.action, func.count(ProjectHistory.id)).filter(
            ProjectHistory.user_id == user_id
        ).group_by(ProjectHistory.action).all()
        
        # Count total items
        total_quizzes = db.query(func.count(Quiz.id)).filter(Quiz.user_id == user_id).scalar()
        total_projects = db.query(func.count(Project.id)).filter(Project.user_id == user_id).scalar()
        
        # Count questions in all user's quizzes
        quiz_ids = [q.id for q in db.query(Quiz.id).filter(Quiz.user_id == user_id).all()]
        total_questions = db.query(func.count(Question.id)).filter(
            Question.quiz_id.in_(quiz_ids) if quiz_ids else False
        ).scalar() or 0
        
        # Recent activity
        recent_timeframe = datetime.utcnow() - timedelta(days=7)
        recent_quiz_actions = db.query(func.count(QuizHistory.id)).filter(
            QuizHistory.user_id == user_id,
            QuizHistory.timestamp >= recent_timeframe
        ).scalar() or 0
        
        recent_question_actions = db.query(func.count(QuestionHistory.id)).filter(
            QuestionHistory.user_id == user_id,
            QuestionHistory.timestamp >= recent_timeframe
        ).scalar() or 0
        
        recent_project_actions = db.query(func.count(ProjectHistory.id)).filter(
            ProjectHistory.user_id == user_id,
            ProjectHistory.timestamp >= recent_timeframe
        ).scalar() or 0
        
        # Create stats dictionary
        stats = {
            "total_items": {
                "quizzes": total_quizzes,
                "questions": total_questions,
                "projects": total_projects
            },
            "actions": {
                "quiz": {str(action): count for action, count in quiz_counts},
                "question": {str(action): count for action, count in question_counts},
                "project": {str(action): count for action, count in project_counts}
            },
            "recent_activity": {
                "quiz_actions": recent_quiz_actions,
                "question_actions": recent_question_actions,
                "project_actions": recent_project_actions,
                "total": recent_quiz_actions + recent_question_actions + recent_project_actions
            }
        }
        
        return stats
    
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
    
    @staticmethod
    def summarize_changes(previous_state: Optional[Dict[str, Any]], action: ActionType) -> str:
        """
        Generate a human-readable summary of changes based on previous state and action
        """
        if not previous_state:
            action_descriptions = {
                ActionType.CREATE: "Created new item",
                ActionType.UPDATE: "Updated item",
                ActionType.DELETE: "Deleted item",
                ActionType.REGENERATE: "Regenerated content",
                ActionType.REVERT: "Reverted to previous state",
                ActionType.ADD_QUIZ: "Added quiz to project",
                ActionType.REMOVE_QUIZ: "Removed quiz from project",
                ActionType.REORDER: "Reordered items"
            }
            return action_descriptions.get(action, f"Performed {action.value} action")
        
        # Handle different action types
        if action == ActionType.CREATE:
            return "Created new item"
        
        elif action == ActionType.UPDATE:
            # Identify which fields were changed
            changed_fields = []
            if "title" in previous_state:
                changed_fields.append("title")
            if "description" in previous_state:
                changed_fields.append("description")
            if "question_text" in previous_state:
                changed_fields.append("question text")
            if "answers" in previous_state:
                changed_fields.append("answers")
            if "custom_prompt" in previous_state:
                changed_fields.append("custom prompt")
            
            if changed_fields:
                return f"Updated {', '.join(changed_fields)}"
            else:
                return "Updated item properties"
        
        elif action == ActionType.DELETE:
            return "Deleted item"
        
        elif action == ActionType.REGENERATE:
            if "questions" in previous_state:
                return f"Regenerated {len(previous_state['questions'])} questions"
            elif "question_text" in previous_state:
                return "Regenerated question"
            else:
                return "Regenerated content"
        
        elif action == ActionType.REVERT:
            return "Reverted to previous state"
        
        elif action == ActionType.ADD_QUIZ:
            quiz_count = len(previous_state.get("quizzes", [])) if "quizzes" in previous_state else 0
            return f"Added quiz to project with {quiz_count} existing quizzes"
        
        elif action == ActionType.REMOVE_QUIZ:
            return "Removed quiz from project"
        
        elif action == ActionType.REORDER:
            return "Reordered items"
        
        else:
            return f"Performed {action.value} action"
    
    @staticmethod
    def get_detailed_changes(previous_state: Optional[Dict[str, Any]], action: ActionType) -> Dict[str, Any]:
        """
        Generate detailed change information for history viewing
        """
        if not previous_state:
            return {"action": action.value, "details": "No detailed change information available"}
        
        result = {"action": action.value, "changed_fields": []}
        
        # Track specific changes based on field type
        if action in [ActionType.UPDATE, ActionType.REGENERATE, ActionType.REVERT]:
            # Text fields
            for field in ["title", "description", "topic", "question_text", "explanation", "custom_prompt"]:
                if field in previous_state:
                    result["changed_fields"].append(field)
                    result[field] = {"old_value": previous_state[field]}
            
            # Boolean fields
            for field in ["use_default_prompt"]:
                if field in previous_state:
                    result["changed_fields"].append(field)
                    result[field] = {"old_value": previous_state[field]}
            
            # Complex fields
            if "answers" in previous_state:
                result["changed_fields"].append("answers")
                result["answers"] = {
                    "count": len(previous_state["answers"]),
                    "items": previous_state["answers"]
                }
            
            if "questions" in previous_state:
                result["changed_fields"].append("questions")
                result["questions"] = {
                    "count": len(previous_state["questions"]),
                    "preview": [q["question_text"][:100] for q in previous_state["questions"][:3]]
                }
            
            if "quizzes" in previous_state:
                result["changed_fields"].append("quizzes")
                result["quizzes"] = {
                    "count": len(previous_state["quizzes"]),
                    "items": previous_state["quizzes"]
                }
        
        # For deletion, include all previous state info
        elif action == ActionType.DELETE:
            result["deleted_item"] = previous_state
        
        return result