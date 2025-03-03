from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from app.models.project import Project, ProjectQuiz
from app.models.quiz import Quiz
from app.models.history import ProjectHistory, ActionType
from app.services.history import HistoryService

class ProjectService:
    @staticmethod
    async def create_project(
        db: Session,
        user_id: int,
        project_data: Dict[str, Any]
    ) -> Project:
        """
        Create a new project and record in history
        """
        # Create the project
        project = Project(
            title=project_data.get("title", "New Project"),
            description=project_data.get("description", ""),
            user_id=user_id,
            use_default_prompt=project_data.get("use_default_prompt", True),
            custom_prompt=project_data.get("custom_prompt", None) if not project_data.get("use_default_prompt", True) else None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(project)
        db.commit()
        db.refresh(project)
        
        # Record in history
        HistoryService.record_project_action(
            db=db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.CREATE
        )
        
        return project
    
    @staticmethod
    async def update_project(
        db: Session,
        project_id: int,
        user_id: int,
        project_data: Dict[str, Any]
    ) -> Project:
        """
        Update a project with new data, saving the previous state in history
        """
        # Get the existing project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Store the previous state
        previous_state = {
            "title": project.title,
            "description": project.description,
            "use_default_prompt": project.use_default_prompt,
            "custom_prompt": project.custom_prompt
        }
        
        # Update project fields
        if "title" in project_data:
            project.title = project_data["title"]
        
        if "description" in project_data:
            project.description = project_data["description"]
        
        if "use_default_prompt" in project_data:
            project.use_default_prompt = project_data["use_default_prompt"]
            
        if "custom_prompt" in project_data and not project_data.get("use_default_prompt", project.use_default_prompt):
            project.custom_prompt = project_data["custom_prompt"]
        elif "use_default_prompt" in project_data and project_data["use_default_prompt"]:
            project.custom_prompt = None
            
        project.updated_at = datetime.utcnow()
        
        # Create history entry
        HistoryService.record_project_action(
            db=db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.UPDATE,
            previous_state=previous_state
        )
        
        db.commit()
        db.refresh(project)
        
        return project
    
    @staticmethod
    async def delete_project(
        db: Session,
        project_id: int,
        user_id: int
    ) -> None:
        """
        Delete a project and record in history
        """
        # Get the project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Store the project data for history
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
        
        # Create history entry before deletion
        HistoryService.record_project_action(
            db=db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.DELETE,
            previous_state=previous_state
        )
        
        # Delete the project
        db.delete(project)
        db.commit()
    
    @staticmethod
    async def revert_project(
        db: Session,
        project_id: int,
        user_id: int,
        history_id: Optional[int] = None
    ) -> Project:
        """
        Revert a project to a previous state
        """
        # Get the project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Get the history entry
        if history_id:
            history = db.query(ProjectHistory).filter(
                ProjectHistory.id == history_id,
                ProjectHistory.project_id == project_id,
                ProjectHistory.previous_state.isnot(None)
            ).first()
        else:
            # Get the most recent history with previous state
            history = db.query(ProjectHistory).filter(
                ProjectHistory.project_id == project_id,
                ProjectHistory.previous_state.isnot(None)
            ).order_by(desc(ProjectHistory.timestamp)).first()
        
        if not history or not history.previous_state:
            raise ValueError("No history found to revert to")
        
        # Store current state
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
                quiz_id = quiz_data["quiz_id"]
                # Verify the quiz still exists
                quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
                if quiz:
                    db_project_quiz = ProjectQuiz(
                        project_id=project_id,
                        quiz_id=quiz_id,
                        position=quiz_data["position"]
                    )
                    db.add(db_project_quiz)
        
        project.updated_at = datetime.utcnow()
        
        # Create revert history entry
        HistoryService.record_project_action(
            db=db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.REVERT,
            previous_state=current_state
        )
        
        db.commit()
        db.refresh(project)
        
        return project
    
    @staticmethod
    async def add_quiz_to_project(
        db: Session,
        project_id: int,
        user_id: int,
        quiz_id: int,
        position: int
    ) -> Project:
        """
        Add a quiz to a project and record in history
        """
        # Get the project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with ID {project_id} not found")
        
        # Get the quiz
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            raise ValueError(f"Quiz with ID {quiz_id} not found")
        
        # Store previous state
        previous_state = {
            "quizzes": [
                {
                    "quiz_id": pq.quiz_id,
                    "position": pq.position
                } for pq in project.quizzes
            ]
        }
        
        # Check if quiz is already in project
        project_quiz = db.query(ProjectQuiz).filter(
            ProjectQuiz.project_id == project_id,
            ProjectQuiz.quiz_id == quiz_id
        ).first()
        
        if project_quiz:
            # Update position
            project_quiz.position = position
        else:
            # Create new association
            project_quiz = ProjectQuiz(
                project_id=project_id,
                quiz_id=quiz_id,
                position=position
            )
            db.add(project_quiz)
        
        # Update project timestamp
        project.updated_at = datetime.utcnow()
        
        # Record in history
        HistoryService.record_project_action(
            db=db,
            project_id=project.id,
            user_id=user_id,
            action=ActionType.ADD_QUIZ,
            previous_state=previous_state
        )
        
        db.commit()
        db.refresh(project)
        
        return project