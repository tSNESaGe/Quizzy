import os
import sys
import sqlite3
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from app.models.question import Question, QuestionType
from app.models.history import ActionType
from app.database import SessionLocal, engine, Base, init_enums

def run_migrations():
    """Run database schema migrations and fixes"""
    print("Starting database migrations...")
    
    # Initialize connection
    db = SessionLocal()
    inspector = inspect(engine)
    conn = sqlite3.connect('quiz_app.db')
    cursor = conn.cursor()
    
    try:
        # Check if ProjectHistory table exists
        if not inspector.has_table("project_history"):
            print("Adding project_history table...")
            
            # Import the models that include the new tables
            from app.models.history import ProjectHistory
            
            # Create only the missing tables
            Base.metadata.create_all(bind=engine, tables=[ProjectHistory.__table__])
            
            print("project_history table created successfully")
        
        # Check and update action_type enum if needed
        actions_to_add = {
            "ADD_QUIZ": "add_quiz",
            "REMOVE_QUIZ": "remove_quiz",
            "REORDER": "reorder"
        }
        
        # Use direct SQL to update enum types if needed
        try:
            # First check if the ENUM table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='action_type'")
            if cursor.fetchone():
                for enum_name, enum_value in actions_to_add.items():
                    # Check if this action_type already exists
                    cursor.execute("SELECT name FROM action_type WHERE name=?", (enum_value,))
                    if not cursor.fetchone():
                        cursor.execute("INSERT INTO action_type (name) VALUES (?)", (enum_value,))
                        print(f"Added {enum_value} to action_type enum")
        except Exception as e:
            print(f"Warning: Could not update action_type enum: {e}")
        
        # Fix question_type values (same as the existing fix_db.py functionality)
        questions = db.query(Question).all()
        print(f"Found {len(questions)} questions to verify")
        
        fixed_count = 0
        for question in questions:
            # Convert lowercase string values to uppercase enum values
            if isinstance(question.question_type, str):
                if question.question_type == 'multiple_choice':
                    question.question_type = QuestionType.MULTIPLE_CHOICE
                    fixed_count += 1
                elif question.question_type == 'boolean':
                    question.question_type = QuestionType.BOOLEAN
                    fixed_count += 1
                elif question.question_type == 'open_ended':
                    question.question_type = QuestionType.OPEN_ENDED
                    fixed_count += 1
        
        if fixed_count > 0:
            print(f"Fixed {fixed_count} question_type values")
            db.commit()
        
        # Final direct SQL approach for question_type values
        cursor.execute("UPDATE questions SET question_type = 'MULTIPLE_CHOICE' WHERE question_type = 'multiple_choice'")
        cursor.execute("UPDATE questions SET question_type = 'BOOLEAN' WHERE question_type = 'boolean'")
        cursor.execute("UPDATE questions SET question_type = 'OPEN_ENDED' WHERE question_type = 'open_ended'")
        
        conn.commit()
        print("Database migration completed successfully")
        
    except Exception as e:
        db.rollback()
        conn.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()
        conn.close()

if __name__ == "__main__":
    run_migrations()