from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from loguru import logger
import os
from dotenv import load_dotenv

# Import routers
from app.endpoints import analyze, auth

# Load environment variables from .env file
load_dotenv()

# Configure logging
logger.add("logs/app.log", rotation="10 MB", retention="1 week", level="INFO")

app = FastAPI(
    title="CometWeb Audit Tool",
    description="A comprehensive tool for auditing websites, including performance, SEO, accessibility, and more",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this in production with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.get("/")
async def root():
    """
    Root endpoint returning app info
    """
    return {
        "app": "CometWeb Audit Tool",
        "version": "0.1.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
