# backend/app/main.py
import os
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.config import settings
from app.database import init_db, create_admin_user
from app.routes import auth, documents, quizzes, projects, history

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["Quizzes"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(history.router, prefix="/api/history", tags=["History"])

# Mount uploads directory
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
app.mount(f"/{settings.UPLOAD_FOLDER}", StaticFiles(directory=settings.UPLOAD_FOLDER), name=settings.UPLOAD_FOLDER)

@app.on_event("startup")
async def startup_event():
    # Initialize database
    init_db()
    
    # Create admin user
    create_admin_user()
    
    print(f"App started with environment: {os.getenv('ENVIRONMENT', 'development')}")
    print(f"Gemini API Key configured: {'Yes' if settings.GEMINI_API_KEY else 'No'}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.APP_PORT, reload=True)