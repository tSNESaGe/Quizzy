# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_enums():
    """Ensure enum types are correctly registered"""
    from sqlalchemy import Enum
    from app.models.question import QuestionType
    
    # This ensures SQLAlchemy knows about the enum values
    Enum(QuestionType).create(bind=engine, checkfirst=True)

def init_db():
    from app.models import user, quiz, question, document, project, history
    
    init_enums()
    
    # Create tables
    Base.metadata.create_all(bind=engine)

# Function to create initial admin user
def create_admin_user():
    from app.models.user import User
    from app.services.auth import get_password_hash
    from sqlalchemy.orm import Session
    
    db = SessionLocal()
    try:
        # Check if admin user already exists
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
            print(f"Admin user already exists: {settings.ADMIN_USERNAME}")
    finally:
        db.close()