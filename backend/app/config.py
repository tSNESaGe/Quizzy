# backend/app/config.py
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import EmailStr, SecretStr, validator
from typing import Optional, List

class Settings(BaseSettings):
    # Base
    PROJECT_NAME: str = "AI Quiz Generator"
    VERSION: str = "0.2.0"
    DESCRIPTION: str = "An AI-powered quiz generation application"
    
    # Database
    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: int = int(os.getenv("DB_PORT"))
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD")
    DB_NAME: str = os.getenv("DB_NAME")
    DB_TYPE: str = os.getenv("DB_TYPE")
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    APP_PORT: str = os.getenv("APP_PORT")
    FRONTEND_PORT: str = os.getenv("FRONTEND_PORT")
    # Constructed database URL
    @property
    def DATABASE_URL(self) -> str:
        if not self.DATABASE_URL:
            return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Admin User (created on first run)
    ADMIN_EMAIL: EmailStr = os.getenv("ADMIN_EMAIL")
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME")
    ADMIN_PASSWORD: SecretStr = SecretStr(os.getenv("ADMIN_PASSWORD"))
    
    # AI Services
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    
    # Embedding settings
    EMBEDDING_DIMENSIONS: int = 1536
    
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
    UPLOAD_FOLDER: str = os.getenv('UPLOAD_FOLDER')
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16 MB
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "pptx", "docx", "doc", "txt", "html", "json"]
    
    # CORS settings
    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        return [
        "http://localhost",
        f"http://localhost:{self.DB_PORT}",
        f"http://localhost:{self.FRONTEND_PORT}",
        "http://localhost:3000",
        f"http://localhost:{self.APP_PORT}"
        ]
    
    class Config:
        env_file = ".env"
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