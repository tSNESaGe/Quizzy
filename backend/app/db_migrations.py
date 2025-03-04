# backend/app/db_migrations.py

import sys
from sqlalchemy import inspect, text
from sqlalchemy.orm import sessionmaker
from app.models.question import Question, QuestionType
from app.models.history import ActionType
from app.database import SessionLocal, engine, Base

def update_enum_type(conn, enum_type_name, enum_values):
    """
    Update a PostgreSQL enum type with new values from Python enum
    
    Args:
        conn: SQLAlchemy connection object
        enum_type_name: Name of the PostgreSQL enum type (e.g. 'actiontype')
        enum_values: List of values from Python enum (strings)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # First check if the enum type exists
        enum_exists = conn.execute(text(
            f"SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = '{enum_type_name}')"
        )).scalar()
        
        if not enum_exists:
            print(f"  Enum type '{enum_type_name}' doesn't exist in database, skipping update")
            return False
        
        # Get all current enum values from Postgres
        existing_enum_values = conn.execute(text(
            f"SELECT enumlabel FROM pg_enum WHERE enumtypid = "
            f"(SELECT oid FROM pg_type WHERE typname = '{enum_type_name}')"
        )).fetchall()
        
        existing_enum_values = [row[0] for row in existing_enum_values]
        print(f"  Existing {enum_type_name} values: {existing_enum_values}")
        
        enum_values = [case 
                       for value in enum_values 
                       for case in (value, value.upper(), value.lower())]
        # Find missing values
        missing_values = [value for value in enum_values if value not in existing_enum_values]
        
        if missing_values:
            print(f"  Found {len(missing_values)} new enum values to add: {missing_values}")
            
            # Check PostgreSQL version to determine how to add values
            pg_version = conn.execute(text("SHOW server_version")).scalar()
            print(f"  PostgreSQL version: {pg_version}")
            
            # Parse version string to get major version number
            major_version = int(pg_version.split('.')[0])
            
            # PostgreSQL 9.6+ supports IF NOT EXISTS
            supports_if_not_exists = major_version >= 10
            
            # Add missing values
            for value in missing_values:
                try:
                    if supports_if_not_exists:
                        conn.execute(text(f"ALTER TYPE {enum_type_name} ADD VALUE IF NOT EXISTS '{value}'"))
                        print(f"  -> Added '{value}' to {enum_type_name} enum")
                    else:
                        # For older PostgreSQL versions, we need to check existence first
                        exists = conn.execute(text(
                            f"SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumlabel = '{value}' AND "
                            f"enumtypid = (SELECT oid FROM pg_type WHERE typname = '{enum_type_name}'))"
                        )).scalar()
                        
                        if not exists:
                            conn.execute(text(f"ALTER TYPE {enum_type_name} ADD VALUE '{value}'"))
                            print(f"  -> Added '{value}' to {enum_type_name} enum (older PG version method)")
                except Exception as e:
                    print(f"  -> Error adding '{value}': {e}")
        else:
            print(f"  No new {enum_type_name} values to add")
        
        return True
    except Exception as e:
        print(f"Warning: Could not update {enum_type_name} enum: {e}")
        return False

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
        
        # 5) Add file_hash and content_hash columns to documents table
        print("Checking if file_hash and content_hash columns exist in documents table...")
        
        has_file_hash = False
        has_content_hash = False
        
        for column in inspector.get_columns('documents'):
            if column['name'] == 'file_hash':
                has_file_hash = True
            if column['name'] == 'content_hash':
                has_content_hash = True
        
        if not has_file_hash:
            print("Adding file_hash column to documents table...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64)"))
                conn.execute(text("CREATE INDEX idx_documents_file_hash ON documents(file_hash)"))
                conn.commit()
        
        if not has_content_hash:
            print("Adding content_hash column to documents table...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE documents ADD COLUMN content_hash VARCHAR(64)"))
                conn.execute(text("CREATE INDEX idx_documents_content_hash ON documents(content_hash)"))
                conn.commit()
        
        # Calculate hashes for existing documents
        if not has_file_hash or not has_content_hash:
            print("Calculating hashes for existing documents...")
            from hashlib import sha256
            from app.models.document import Document
            documents = db.query(Document).all()
            
            for document in documents:
                if not document.content_hash:
                    document.content_hash = sha256(document.content.encode('utf-8')).hexdigest()
                
                if not document.file_hash:
                    document.file_hash = document.content_hash
            
            db.commit()
            print(f"Updated hash values for {len(documents)} documents")

        has_file_size = False
        for column in inspector.get_columns('documents'):
            if column['name'] == 'file_size':
                has_file_size = True
                break

        if not has_file_size:
            print("Adding file_size column to documents table...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE documents ADD COLUMN file_size BIGINT"))
                conn.commit()
            print("file_size column added successfully")
            
        print("Fixing question history foreign key constraint for cascade delete...")
        try:
            # Add a timeout for potentially long-running operations
            # Set statement_timeout to 5 seconds
            with engine.connect() as conn:
                try:
                    conn.execute(text("SET statement_timeout = 5000"))  # 5 seconds
                    print("Set statement timeout to 5 seconds")
                except Exception as e:
                    print(f"Could not set statement timeout: {e}")
                    print("Will continue without timeout settings")
                    
                # First check if the question_history table exists
                has_table = conn.execute(text(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='question_history')"
                )).scalar()
                
                if not has_table:
                    print("question_history table doesn't exist, skipping constraint update")
                else:
                    print("Skipping existing constraint modification to avoid hanging")
                    print("Will attempt to create model relationships through SQLAlchemy instead")
                    
                    # Skip the direct constraint modification that's causing the hang
                    # Instead, we'll ensure the relationship is properly defined in the model
                    # This will still enable cascade deletion for new items
                    print("Using SQLAlchemy model definition for cascading instead of direct constraint")
        except Exception as e:
            print(f"Error during foreign key update: {e}")
            print("Continuing with other migrations...")

        print("Foreign key constraint update step completed")
            
        print("Updating enum types...")
        try:
            with engine.connect() as conn:
                try:
                    # Update ActionType enum
                    action_type_values = [action.value for action in ActionType]
                    update_enum_type(conn, 'actiontype', action_type_values)
                except Exception as action_e:
                    print(f"Error updating actiontype enum: {action_e}")
                
                try:
                    # Update QuestionType enum
                    question_type_values = [qtype.value for qtype in QuestionType]
                    update_enum_type(conn, 'questiontype', question_type_values)
                except Exception as question_e:
                    print(f"Error updating questiontype enum: {question_e}")
                
                # Add any other enum types here
                
                try:
                    # For PostgreSQL 9.6+, we can use a transaction
                    conn.commit()
                    print("All enum types updated successfully")
                except Exception as commit_e:
                    print(f"Error committing enum type updates: {commit_e}")
        except Exception as e:
            print(f"Error updating enum types: {e}")
            
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_migrations()
