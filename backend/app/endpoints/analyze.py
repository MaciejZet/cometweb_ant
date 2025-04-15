from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from loguru import logger
from app.services.analyzer import WebsiteAnalyzer

router = APIRouter()

class AnalysisRequest(BaseModel):
    url: HttpUrl
    modules: List[str] = ["performance", "seo", "accessibility", "technology", "carbon"]
    depth: int = 1  # How many pages to crawl (1 = just the homepage)
    device: str = "desktop"  # desktop or mobile


class AnalysisResponse(BaseModel):
    task_id: str
    status: str
    message: str


class AnalysisResult(BaseModel):
    url: str
    timestamp: str
    results: Dict[str, Any]
    summary: Dict[str, Any]


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_website(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """
    Analyze a website based on provided parameters.
    
    This endpoint initiates an asynchronous website analysis and returns a task ID
    that can be used to check the status and retrieve results.
    """
    logger.info(f"Received analysis request for URL: {request.url}")
    
    try:
        analyzer = WebsiteAnalyzer()
        task_id = await analyzer.start_analysis(
            url=str(request.url),
            modules=request.modules,
            depth=request.depth,
            device=request.device
        )
        
        # Start the analysis in the background
        background_tasks.add_task(
            analyzer.run_analysis,
            task_id=task_id
        )
        
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Analysis started successfully. Use the task ID to check status."
        }
        
    except Exception as e:
        logger.error(f"Error starting analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")


@router.get("/analysis/{task_id}", response_model=Optional[AnalysisResult])
async def get_analysis_results(task_id: str):
    """
    Get the results of a previously initiated website analysis.
    
    If the analysis is still running, this will return a status update.
    If the analysis is complete, this will return the full results.
    """
    try:
        analyzer = WebsiteAnalyzer()
        result = await analyzer.get_analysis_results(task_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Analysis task not found")
            
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving analysis results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analysis results: {str(e)}")
