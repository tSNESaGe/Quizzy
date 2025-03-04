# backend/app/routes/quizzes.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.utils.conversion import convert_enum_to_string
import json

from app.database import get_db
from app.models.quiz import Quiz
from app.models.document import Document
from app.models.question import Question, Answer, QuestionType
from app.models.history import QuizHistory, QuestionHistory, ActionType
from app.schemas.quiz import (
    Quiz as QuizSchema,
    QuizCreate,
    QuizUpdate,
    QuizGenerateRequest,
    Question as QuestionSchema,
    QuestionCreate,
    QuestionUpdate,
    QuestionTypeChangeRequest
)
from app.schemas.history import (
    QuizHistoryResponse,
    QuestionHistoryResponse
)
from app.services.auth import get_current_user
from app.services.ai import AIService
from app.services.question import QuestionService
from app.services.history import HistoryService
from app.models.user import User

router = APIRouter()
ai_service = AIService()

@router.post("/generate", response_model=QuizSchema)
async def generate_quiz(
    request: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a new quiz based on topic or documents
    """
    # Generate questions using AI
    questions_data = await ai_service.generate_quiz(
        db,
        topic=request.topic,
        num_questions=request.num_questions,
        document_ids=request.document_ids,
        custom_prompt=request.custom_prompt if not request.use_default_prompt else None,
        use_embeddings=request.use_embeddings
    )
    
    if not questions_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate quiz questions"
        )
    
    # Create the quiz in the database
    db_quiz = Quiz(
        title=f"Quiz on {request.topic}",
        topic=request.topic,
        user_id=current_user.id,
        use_default_prompt=request.use_default_prompt,
        custom_prompt=request.custom_prompt if not request.use_default_prompt else None
    )
    
    # If documents were used, store references
    if request.document_ids:
        db_quiz.document_sources = {"document_ids": request.document_ids}
    
    db.add(db_quiz)
    db.commit()
    db.refresh(db_quiz)
    
    # Create questions and answers
    for q_data in questions_data:
        db_question = Question(
            quiz_id=db_quiz.id,
            question_text=q_data["question_text"],
            question_type=q_data["question_type"].upper() if isinstance(q_data["question_type"], str) else q_data["question_type"],
            explanation=q_data.get("explanation", ""),
            position=q_data["position"]
        )
        
        db.add(db_question)
        db.commit()
        db.refresh(db_question)
        
        # Create answers for this question
        for a_data in q_data.get("answers", []):
            db_answer = Answer(
                question_id=db_question.id,
                answer_text=a_data["answer_text"],
                is_correct=a_data["is_correct"],
                position=a_data["position"]
            )
            
            db.add(db_answer)
        
    db.commit()
    
    # Record this action in history
    HistoryService.record_quiz_action(
        db=db,
        quiz_id=db_quiz.id,
        user_id=current_user.id,
        action=ActionType.CREATE
    )
    
    # Return the complete quiz
    return db_quiz

@router.get("", response_model=List[QuizSchema])
def get_user_quizzes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all quizzes for the current user
    """
    quizzes = db.query(Quiz).filter(Quiz.user_id == current_user.id).order_by(desc(Quiz.updated_at)).offset(skip).limit(limit).all()
    convert_enum_to_string(quizzes)
    return quizzes

@router.get("/{quiz_id}", response_model=QuizSchema)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific quiz by ID
    """
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    convert_enum_to_string(quiz)
    return quiz

@router.put("/{quiz_id}", response_model=QuizSchema)
def update_quiz(
    quiz_id: int,
    quiz_data: QuizUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a quiz's metadata
    """
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Store previous state for history
    previous_state = {
        "title": quiz.title,
        "topic": quiz.topic,
        "description": quiz.description,
        "use_default_prompt": quiz.use_default_prompt,
        "custom_prompt": quiz.custom_prompt
    }
    
    # Update quiz fields
    update_data = quiz_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(quiz, key, value)
    
    # Record history
    HistoryService.record_quiz_action(
        db=db,
        quiz_id=quiz.id,
        user_id=current_user.id,
        action=ActionType.UPDATE,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(quiz)
    
    return quiz

@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a quiz
    """
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Record history before deletion
    previous_state = {
        "title": quiz.title,
        "topic": quiz.topic,
        "description": quiz.description,
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type.value,
                "explanation": q.explanation,
                "position": q.position,
                "answers": [
                    {
                        "id": a.id,
                        "answer_text": a.answer_text,
                        "is_correct": a.is_correct,
                        "position": a.position
                    } for a in q.answers
                ]
            } for q in quiz.questions
        ]
    }
    
    HistoryService.record_quiz_action(
        db=db,
        quiz_id=quiz.id,
        user_id=current_user.id,
        action=ActionType.DELETE,
        previous_state=previous_state
    )
    
    db.delete(quiz)
    db.commit()
    
    return {"message": "Quiz deleted successfully"}

@router.post("/{quiz_id}/regenerate", response_model=QuizSchema)
async def regenerate_quiz(
    quiz_id: int,
    use_embeddings: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate all questions for a quiz
    """
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Store the current state for history
    previous_state = {
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type.value,
                "explanation": q.explanation,
                "position": q.position,
                "answers": [
                    {
                        "id": a.id,
                        "answer_text": a.answer_text,
                        "is_correct": a.is_correct,
                        "position": a.position
                    } for a in q.answers
                ]
            } for q in quiz.questions
        ]
    }
    
    # Get number of questions to regenerate
    num_questions = len(quiz.questions) or 10
    
    # Extract document IDs if available
    document_ids = quiz.document_sources.get("document_ids") if quiz.document_sources else None
    
    # Generate new questions
    questions_data = await ai_service.generate_quiz(
        db,
        topic=quiz.topic,
        num_questions=num_questions,
        document_ids=document_ids,
        custom_prompt=quiz.custom_prompt if not quiz.use_default_prompt else None,
        use_embeddings=use_embeddings
    )
    
    if not questions_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate quiz questions"
        )
    
    # Delete existing questions
    for question in quiz.questions:
        db.delete(question)
    
    # Create new questions and answers
    for q_data in questions_data:
        db_question = Question(
            quiz_id=quiz.id,
            question_text=q_data["question_text"],
            question_type=q_data["question_type"].upper() if isinstance(q_data["question_type"], str) else q_data["question_type"],
            explanation=q_data.get("explanation", ""),
            position=q_data["position"]
        )
        
        db.add(db_question)
        db.commit()
        db.refresh(db_question)
        
        # Create answers for this question
        for a_data in q_data.get("answers", []):
            db_answer = Answer(
                question_id=db_question.id,
                answer_text=a_data["answer_text"],
                is_correct=a_data["is_correct"],
                position=a_data["position"]
            )
            
            db.add(db_answer)
    
    # Record this regeneration in history
    HistoryService.record_quiz_action(
        db=db,
        quiz_id=quiz.id,
        user_id=current_user.id,
        action=ActionType.REGENERATE,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(quiz)
    
    return quiz

@router.post("/{quiz_id}/questions", response_model=QuestionSchema)
async def add_question(
    quiz_id: int,
    question_data: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new question to a quiz
    """
    # Verify quiz exists and belongs to user
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    question = await QuestionService.add_question(
        db=db,
        quiz_id=quiz_id,
        user_id=current_user.id,
        question_data=question_data.dict()
    )
    
    return question

@router.put("/{quiz_id}/questions/{question_id}", response_model=QuestionSchema)
async def update_question(
    quiz_id: int,
    question_id: int,
    question_data: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a specific question in a quiz
    """
    # Verify quiz exists and belongs to user
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Verify question belongs to quiz
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.quiz_id == quiz_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    updated_question = await QuestionService.update_question(
        db=db,
        question_id=question_id,
        user_id=current_user.id,
        question_data=question_data.dict(exclude_unset=True)
    )
    
    return updated_question

@router.delete("/{quiz_id}/questions/{question_id}")
async def delete_question(
    quiz_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific question from a quiz
    """
    # Verify quiz exists and belongs to user
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Verify question belongs to quiz
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.quiz_id == quiz_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    await QuestionService.delete_question(
        db=db,
        question_id=question_id,
        user_id=current_user.id
    )
    
    return {"message": "Question deleted successfully"}

@router.post("/{quiz_id}/questions/{question_id}/regenerate", response_model=QuestionSchema)
async def regenerate_question(
    quiz_id: int,
    question_id: int,
    use_document_content: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate a specific question in a quiz with document content support
    """
    # Verify quiz belongs to user and exists
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get the question
    question = db.query(Question).filter(Question.id == question_id, Question.quiz_id == quiz_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Store previous state for history
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
    
    # Get document content if requested and available
    document_content = None
    if use_document_content and quiz.document_sources and "document_ids" in quiz.document_sources:
        document_ids = quiz.document_sources["document_ids"]
        if document_ids:
            # Get relevant content from document embeddings
            try:
                # Use embedding service to find relevant content
                from app.services.embedding import EmbeddingService, DocumentChunk
                embedding_service = EmbeddingService()
                
                # Check if any documents have chunks
                has_embeddings = db.query(DocumentChunk).filter(
                    DocumentChunk.document_id.in_(document_ids)
                ).count() > 0
                
                if has_embeddings:
                    # Use question text as query to find relevant content
                    relevant_chunks = await embedding_service.find_relevant_chunks(
                        db=db,
                        query=question.question_text,
                        top_k=5,
                        document_ids=document_ids
                    )
                    
                    if relevant_chunks:
                        document_content = "\n\n".join([chunk["text"] for chunk in relevant_chunks])
                
                # If no embeddings or chunks found, use traditional approach
                if not document_content:
                    # Get full document content (limited)
                    documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
                    contents = []
                    
                    for doc in documents:
                        # Limit size to avoid context issues
                        doc_content = doc.content[:3000] + "..." if len(doc.content) > 3000 else doc.content
                        contents.append(f"--- From {doc.filename} ---\n{doc_content}")
                    
                    if contents:
                        document_content = "\n\n".join(contents)
            except Exception as e:
                print(f"Error getting document content: {str(e)}")
    
    # Generate a new question
    question_data = await ai_service.regenerate_question(
        topic=quiz.topic,
        question_index=question.position,
        question_type=question.question_type.value,
        custom_prompt=quiz.custom_prompt if not quiz.use_default_prompt else None,
        document_content=document_content
    )
    
    if not question_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate question"
        )
    
    # Update question fields
    question.question_text = question_data["question_text"]
    question.explanation = question_data.get("explanation", "")
    
    # Delete existing answers
    for answer in question.answers:
        db.delete(answer)
    
    # Create new answers
    for a_data in question_data.get("answers", []):
        db_answer = Answer(
            question_id=question.id,
            answer_text=a_data["answer_text"],
            is_correct=a_data["is_correct"],
            position=a_data["position"]
        )
        
        db.add(db_answer)
    
    # Record this regeneration in history
    HistoryService.record_question_action(
        db=db,
        question_id=question.id,
        user_id=current_user.id,
        action=ActionType.REGENERATE,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(question)
    
    return question

@router.post("/{quiz_id}/questions/{question_id}/change-type", response_model=QuestionSchema)
async def change_question_type(
    quiz_id: int,
    question_id: int,
    type_request: QuestionTypeChangeRequest,
    use_document_content: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Change a question's type (boolean/multiple choice) and regenerate appropriate answers
    """
    # Verify quiz belongs to user and exists
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get the question
    question = db.query(Question).filter(Question.id == question_id, Question.quiz_id == quiz_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check if the type is already the requested type
    if question.question_type.value == type_request.question_type:
        return question
    
    # Store previous state for history
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
    
    # Convert the question data to dictionary
    question_data = {
        "question_text": question.question_text,
        "question_type": question.question_type.value,
        "explanation": question.explanation,
        "position": question.position
    }
    
    # Get document content if requested and available
    document_content = None
    if use_document_content and quiz.document_sources and "document_ids" in quiz.document_sources:
        document_ids = quiz.document_sources["document_ids"]
        if document_ids:
            # Get relevant content from document embeddings
            try:
                # Use embedding service to find relevant content
                from app.services.embedding import EmbeddingService, DocumentChunk
                embedding_service = EmbeddingService()
                
                # Check if any documents have chunks
                has_embeddings = db.query(DocumentChunk).filter(
                    DocumentChunk.document_id.in_(document_ids)
                ).count() > 0
                
                if has_embeddings:
                    # Use question text as query to find relevant content
                    relevant_chunks = await embedding_service.find_relevant_chunks(
                        db=db,
                        query=question.question_text,
                        top_k=5,
                        document_ids=document_ids
                    )
                    
                    if relevant_chunks:
                        document_content = "\n\n".join([chunk["text"] for chunk in relevant_chunks])
                
                # If no embeddings or chunks found, use traditional approach
                if not document_content:
                    # Get full document content (limited)
                    documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
                    contents = []
                    
                    for doc in documents:
                        # Limit size to avoid context issues
                        doc_content = doc.content[:3000] + "..." if len(doc.content) > 3000 else doc.content
                        contents.append(f"--- From {doc.filename} ---\n{doc_content}")
                    
                    if contents:
                        document_content = "\n\n".join(contents)
            except Exception as e:
                print(f"Error getting document content: {str(e)}")
    
    # Use AI to change question type and generate new answers
    new_question_data = await ai_service.change_question_type(
        question_data=question_data,
        new_type=type_request.question_type,
        topic=quiz.topic,
        custom_prompt=quiz.custom_prompt if not quiz.use_default_prompt else None,
        document_content=document_content
    )
    
    if not new_question_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change question type"
        )
    
    # Update question fields
    question.question_type = QuestionType(type_request.question_type)
    if "question_text" in new_question_data:
        question.question_text = new_question_data["question_text"]
    if "explanation" in new_question_data:
        question.explanation = new_question_data.get("explanation", "")
    
    # Delete existing answers
    for answer in question.answers:
        db.delete(answer)
    
    # Create new answers
    for a_data in new_question_data.get("answers", []):
        db_answer = Answer(
            question_id=question.id,
            answer_text=a_data["answer_text"],
            is_correct=a_data["is_correct"],
            position=a_data["position"]
        )
        
        db.add(db_answer)
    
    # Record this change in history
    HistoryService.record_question_action(
        db=db,
        question_id=question.id,
        user_id=current_user.id,
        action=ActionType.UPDATE,
        previous_state=previous_state
    )
    
    db.commit()
    db.refresh(question)
    
    return question

@router.post("/{quiz_id}/revert", response_model=QuizSchema)
def revert_quiz(
    quiz_id: int,
    history_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revert a quiz to a previous state
    """
    # Verify quiz belongs to user and exists
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get the history entry to revert to
    if history_id:
        history = db.query(QuizHistory).filter(
            QuizHistory.id == history_id,
            QuizHistory.quiz_id == quiz_id
        ).first()
        
        if not history or not history.previous_state:
            raise HTTPException(status_code=404, detail="History entry not found")
    else:
        # Get the most recent history entry with a previous state
        history = db.query(QuizHistory).filter(
            QuizHistory.quiz_id == quiz_id,
            QuizHistory.previous_state.isnot(None)
        ).order_by(QuizHistory.timestamp.desc()).first()
        
        if not history:
            raise HTTPException(status_code=404, detail="No history available to revert to")
    
    # Store the current state for a new history entry
    current_state = {
        "title": quiz.title,
        "topic": quiz.topic,
        "description": quiz.description,
        "use_default_prompt": quiz.use_default_prompt,
        "custom_prompt": quiz.custom_prompt
    }
    
    # If the history contains question data, process that
    if "questions" in history.previous_state:
        # Delete existing questions
        for question in quiz.questions:
            db.delete(question)
        
        # Recreate questions from history
        for q_data in history.previous_state["questions"]:
            db_question = Question(
                quiz_id=quiz.id,
                question_text=q_data["question_text"],
                question_type=q_data["question_type"].upper() if isinstance(q_data["question_type"], str) else q_data["question_type"],
                explanation=q_data.get("explanation", ""),
                position=q_data["position"]
            )
            
            db.add(db_question)
            db.commit()
            db.refresh(db_question)
            
            # Create answers for this question
            for a_data in q_data.get("answers", []):
                db_answer = Answer(
                    question_id=db_question.id,
                    answer_text=a_data["answer_text"],
                    is_correct=a_data["is_correct"],
                    position=a_data["position"]
                )
                
                db.add(db_answer)
    
    # Update quiz metadata if present in history
    if "title" in history.previous_state:
        quiz.title = history.previous_state["title"]
    if "topic" in history.previous_state:
        quiz.topic = history.previous_state["topic"]
    if "description" in history.previous_state:
        quiz.description = history.previous_state["description"]
    if "use_default_prompt" in history.previous_state:
        quiz.use_default_prompt = history.previous_state["use_default_prompt"]
    if "custom_prompt" in history.previous_state:
        quiz.custom_prompt = history.previous_state["custom_prompt"]
    
    # Record this reversion in history
    HistoryService.record_quiz_action(
        db=db,
        quiz_id=quiz.id,
        user_id=current_user.id,
        action=ActionType.REVERT,
        previous_state=current_state
    )
    
    db.commit()
    db.refresh(quiz)
    
    return quiz

@router.post("/{quiz_id}/questions/{question_id}/revert", response_model=QuestionSchema)
async def revert_question(
    quiz_id: int,
    question_id: int,
    history_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Revert a question to a previous state
    """
    # Verify quiz belongs to user and exists
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Verify question belongs to quiz
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.quiz_id == quiz_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    try:
        reverted_question = await QuestionService.revert_question(
            db=db,
            question_id=question_id,
            user_id=current_user.id,
            history_id=history_id
        )
        return reverted_question
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{quiz_id}/history", response_model=List[QuizHistoryResponse])
def get_quiz_history(
    quiz_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the edit history for a quiz
    """
    # Verify quiz belongs to user
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    history = HistoryService.get_quiz_history(db=db, quiz_id=quiz_id, limit=limit)
    return history

@router.get("/{quiz_id}/questions/{question_id}/history", response_model=List[QuestionHistoryResponse])
def get_question_history(
    quiz_id: int,
    question_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the edit history for a specific question
    """
    # Verify quiz belongs to user
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Verify question belongs to quiz
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.quiz_id == quiz_id
    ).first()
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    history = HistoryService.get_question_history(db=db, question_id=question_id, limit=limit)
    return history