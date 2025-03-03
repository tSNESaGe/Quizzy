# backend/app/services/question.py
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.question import Question, Answer, QuestionType
from app.models.history import QuestionHistory, ActionType

class QuestionService:
    @staticmethod
    async def update_question(
        db: Session,
        question_id: int,
        user_id: int,
        question_data: Dict[str, Any]
    ) -> Question:
        """
        Update a question with new data, saving the previous state in history
        """
        # Get the existing question
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ValueError(f"Question with ID {question_id} not found")
        
        # Store the previous state
        previous_state = {
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "explanation": question.explanation,
            "position": question.position,
            "answers": [
                {
                    "id": a.id,
                    "answer_text": a.answer_text,
                    "is_correct": a.is_correct,
                    "position": a.position
                } for a in question.answers
            ]
        }
        
        # Update question fields
        if "question_text" in question_data:
            question.question_text = question_data["question_text"]
        
        if "explanation" in question_data:
            question.explanation = question_data["explanation"]
        
        if "position" in question_data:
            question.position = question_data["position"]
        
        # Update question type if provided
        if "question_type" in question_data:
            new_type = question_data["question_type"]
            if new_type in [qt.value for qt in QuestionType]:
                question.question_type = QuestionType(new_type)
        
        # Update answers if provided
        if "answers" in question_data and isinstance(question_data["answers"], list):
            # Delete existing answers
            for answer in question.answers:
                db.delete(answer)
            
            # Create new answers
            for a_data in question_data["answers"]:
                new_answer = Answer(
                    question_id=question.id,
                    answer_text=a_data["answer_text"],
                    is_correct=a_data["is_correct"],
                    position=a_data["position"]
                )
                db.add(new_answer)
        
        # Create history entry
        history_entry = QuestionHistory(
            question_id=question.id,
            user_id=user_id,
            action=ActionType.UPDATE,
            previous_state=previous_state
        )
        
        db.add(history_entry)
        db.commit()
        db.refresh(question)
        
        return question
    
    @staticmethod
    async def add_question(
        db: Session,
        quiz_id: int,
        user_id: int,
        question_data: Dict[str, Any]
    ) -> Question:
        """
        Add a new question to a quiz
        """
        # Get the next position
        last_position = db.query(Question).filter(Question.quiz_id == quiz_id).count()
        
        # Create the question
        question_type_value = question_data.get("question_type", "multiple_choice")
        if question_type_value not in [qt.value for qt in QuestionType]:
            question_type_value = "multiple_choice"
        
        new_question = Question(
            quiz_id=quiz_id,
            question_text=question_data.get("question_text", f"Question {last_position + 1}"),
            question_type=QuestionType(question_type_value),
            explanation=question_data.get("explanation", ""),
            position=last_position,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(new_question)
        db.commit()
        db.refresh(new_question)
        
        # Create answers
        answers_data = question_data.get("answers", [])
        if not answers_data:
            # Generate default answers based on question type
            if question_type_value == "boolean":
                answers_data = [
                    {"answer_text": "True", "is_correct": True, "position": 0},
                    {"answer_text": "False", "is_correct": False, "position": 1}
                ]
            else:
                answers_data = [
                    {"answer_text": "Option A", "is_correct": True, "position": 0},
                    {"answer_text": "Option B", "is_correct": False, "position": 1},
                    {"answer_text": "Option C", "is_correct": False, "position": 2},
                    {"answer_text": "Option D", "is_correct": False, "position": 3}
                ]
        
        for a_data in answers_data:
            answer = Answer(
                question_id=new_question.id,
                answer_text=a_data["answer_text"],
                is_correct=a_data["is_correct"],
                position=a_data["position"]
            )
            db.add(answer)
        
        # Create history entry
        history_entry = QuestionHistory(
            question_id=new_question.id,
            user_id=user_id,
            action=ActionType.CREATE
        )
        
        db.add(history_entry)
        db.commit()
        db.refresh(new_question)
        
        return new_question
    
    @staticmethod
    async def delete_question(
        db: Session,
        question_id: int,
        user_id: int
    ) -> None:
        """
        Delete a question from a quiz
        """
        # Get the question
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ValueError(f"Question with ID {question_id} not found")
        
        # Store the question data for history
        previous_state = {
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "explanation": question.explanation,
            "position": question.position,
            "answers": [
                {
                    "id": a.id,
                    "answer_text": a.answer_text,
                    "is_correct": a.is_correct,
                    "position": a.position
                } for a in question.answers
            ]
        }
        
        # Create history entry before deletion
        history_entry = QuestionHistory(
            question_id=question.id,
            user_id=user_id,
            action=ActionType.DELETE,
            previous_state=previous_state
        )
        
        db.add(history_entry)
        
        # Delete the question (cascades to answers)
        db.delete(question)
        db.commit()
    
    @staticmethod
    async def revert_question(
        db: Session,
        question_id: int,
        user_id: int,
        history_id: Optional[int] = None
    ) -> Question:
        """
        Revert a question to a previous state
        """
        # Get the question
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ValueError(f"Question with ID {question_id} not found")
        
        # Get the history entry
        if history_id:
            history = db.query(QuestionHistory).filter(
                QuestionHistory.id == history_id,
                QuestionHistory.question_id == question_id,
                QuestionHistory.previous_state.isnot(None)
            ).first()
        else:
            # Get the most recent history with previous state
            history = db.query(QuestionHistory).filter(
                QuestionHistory.question_id == question_id,
                QuestionHistory.previous_state.isnot(None)
            ).order_by(QuestionHistory.timestamp.desc()).first()
        
        if not history or not history.previous_state:
            raise ValueError("No history found to revert to")
        
        # Store current state
        current_state = {
            "question_text": question.question_text,
            "question_type": question.question_type.value,
            "explanation": question.explanation,
            "position": question.position,
            "answers": [
                {
                    "id": a.id,
                    "answer_text": a.answer_text,
                    "is_correct": a.is_correct,
                    "position": a.position
                } for a in question.answers
            ]
        }
        
        # Update question fields
        question.question_text = history.previous_state["question_text"]
        question.question_type = QuestionType(history.previous_state["question_type"])
        question.explanation = history.previous_state["explanation"]
        question.position = history.previous_state["position"]
        
        # Delete existing answers
        for answer in question.answers:
            db.delete(answer)
        
        # Create answers from previous state
        for a_data in history.previous_state["answers"]:
            answer = Answer(
                question_id=question.id,
                answer_text=a_data["answer_text"],
                is_correct=a_data["is_correct"],
                position=a_data["position"]
            )
            db.add(answer)
        
        # Create revert history entry
        new_history = QuestionHistory(
            question_id=question.id,
            user_id=user_id,
            action=ActionType.REVERT,
            previous_state=current_state
        )
        
        db.add(new_history)
        db.commit()
        db.refresh(question)
        
        return question