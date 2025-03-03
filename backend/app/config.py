# backend/app/config.py
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import EmailStr, SecretStr, validator
from typing import Optional

class Settings(BaseSettings):
    # Base
    PROJECT_NAME: str = "AI Quiz Generator"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "An AI-powered quiz generation application"
    
    # Database
    DATABASE_URL: str = "sqlite:///./quiz_app.db"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Admin User (created on first run)
    ADMIN_EMAIL: EmailStr
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: SecretStr
    
    # AI Services
    GEMINI_API_KEY: Optional[str] = None
    
    # Default system prompt for quiz generation
    DEFAULT_QUIZ_PROMPT: str = """
    Generate a quiz based on the topic or document provided. 
    Each question should be challenging but fair, test knowledge and understanding, 
    and have clearly defined correct answers.
    
    For multiple-choice questions, provide 4 options with exactly one correct answer.
    For boolean questions, provide True/False options with one correct answer.
    
    For each question, include a brief explanation of why the correct answer is right.
    """
    
    # File upload settings
    UPLOAD_FOLDER: str = "uploads"
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16 MB
    ALLOWED_EXTENSIONS: list = ["pdf", "docx", "doc", "txt", "html", "json"]
    
    # CORS settings
    ALLOWED_ORIGINS: list = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
    ]
    
    class Config:
        env_file = str(Path(__file__).resolve().parent.parent / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True

    @validator("UPLOAD_FOLDER", pre=True)
    def create_upload_folder(cls, v):
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return str(path)

# Create settings instance
settings = Settings()

# Ensure upload folder exists
Path(settings.UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)