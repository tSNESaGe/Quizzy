# backend/app/database.py

import os
import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency to get DB session in FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_enums():
    """
    Ensure enum types are correctly registered (if you’re using SQLAlchemy Enums).
    For example:
      from sqlalchemy import Enum
      from app.models.question import QuestionType
      from app.models.history import ActionType

      Enum(QuestionType).create(bind=engine, checkfirst=True)
      Enum(ActionType).create(bind=engine, checkfirst=True)
    """
    pass


def init_db():
    """
    Initialize database with tables and any necessary Postgres extensions.
    """
    # For Postgres, enable pgvector if needed:
    try:
        with engine.connect() as conn:
            conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("pgvector extension enabled (if Postgres user has permissions).")
    except Exception as e:
        print(f"Warning: Could not enable pgvector extension: {e}")

    # Create any enum types
    init_enums()

    # Import all models - using the __init__.py to handle circular dependencies
    from app.models import user, quiz, question, document, project, history
    
    # Make sure the module is imported which sets up all relationships
    import app.models

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Optionally create an index on vector columns (if using pgvector)
    try:
        with engine.connect() as conn:
            # First check if the vector extension exists
            has_vector = conn.execute(sa.text(
                "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
            )).scalar() is not None
            
            if has_vector:
                # Now check if the document_chunks table exists
                has_table = conn.execute(sa.text(
                    "SELECT 1 FROM information_schema.tables WHERE table_name='document_chunks'"
                )).scalar() is not None
                
                if has_table:
                    conn.execute(sa.text(
                        "CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx "
                        "ON document_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);"
                    ))
                    conn.commit()
                    print("Vector index created successfully.")
                else:
                    print("Skipping vector index creation as document_chunks table doesn't exist yet.")
            else:
                print("Skipping vector index creation as vector extension is not available.")
    except Exception as e:
        print(f"Warning: Could not create vector index: {e}")

    print("Database initialized successfully")


def create_admin_user():
    """
    Create initial admin user if it doesn’t exist yet.
    """
    from app.models.user import User
    from app.services.auth import get_password_hash

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                username=settings.ADMIN_USERNAME,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD.get_secret_value()),
                is_active=True,
                is_admin=True,
                default_prompt=settings.DEFAULT_QUIZ_PROMPT
            )
            db.add(admin)
            db.commit()
            print(f"Admin user created: {settings.ADMIN_USERNAME}")
        else:
            print("Admin user already exists.")
    finally:
        db.close()
