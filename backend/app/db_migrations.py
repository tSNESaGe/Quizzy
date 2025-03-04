# backend/app/db_migrations.py

import sys
from sqlalchemy import inspect, text
from sqlalchemy.orm import sessionmaker
from app.models.question import Question, QuestionType
from app.models.history import ActionType
from app.database import SessionLocal, engine, Base

def run_migrations():
    """Run database schema migrations and fixes for Postgres."""
    print("Starting database migrations...")

    db = SessionLocal()
    inspector = inspect(engine)

    try:
        # 1) Check if project_history table exists
        if not inspector.has_table("project_history"):
            print("Adding project_history table...")
            from app.models.history import ProjectHistory
            Base.metadata.create_all(bind=engine, tables=[ProjectHistory.__table__])
            print("project_history table created successfully")

        # 2) Check if document_chunks table exists
        if not inspector.has_table("document_chunks"):
            print("Adding document_chunks table...")
            from app.services.embedding import DocumentChunk
            Base.metadata.create_all(bind=engine, tables=[DocumentChunk.__table__])
            print("document_chunks table created successfully")

        # 3) If action_type is truly a table, insert missing rows
        #    (If action_type is actually a Postgres ENUM, you'd need a different approach, e.g. ALTER TYPE)
        if inspector.has_table("action_type"):
            print("Checking if we need to add new actions to 'action_type' table...")
            actions_to_add = {
                "ADD_QUIZ": "add_quiz",
                "REMOVE_QUIZ": "remove_quiz",
                "REORDER": "reorder"
            }
            with engine.connect() as conn:
                for enum_name, enum_value in actions_to_add.items():
                    res = conn.execute(
                        text("SELECT name FROM action_type WHERE name = :val"),
                        {"val": enum_value}
                    ).fetchone()
                    if not res:
                        conn.execute(
                            text("INSERT INTO action_type (name) VALUES (:val)"),
                            {"val": enum_value}
                        )
                        print(f"  -> Added {enum_value} to action_type table")
                conn.commit()

        # 4) Fix question_type values stored as lowercase strings in the DB
        questions = db.query(Question).all()
        print(f"Found {len(questions)} questions to verify/fix")
        fixed_count = 0
        for question in questions:
            # Convert string values to uppercase enum values
            if isinstance(question.question_type, str):
                lower_val = question.question_type.lower()
                if lower_val == 'multiple_choice':
                    question.question_type = QuestionType.MULTIPLE_CHOICE
                    fixed_count += 1
                elif lower_val == 'boolean':
                    question.question_type = QuestionType.BOOLEAN
                    fixed_count += 1
                elif lower_val == 'open_ended':
                    question.question_type = QuestionType.OPEN_ENDED
                    fixed_count += 1

        if fixed_count > 0:
            print(f"Fixed {fixed_count} question_type values, committing changes...")
            db.commit()

        print("Database migration completed successfully")

    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_migrations()
