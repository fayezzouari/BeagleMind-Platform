import logging
import sys
import os
import asyncio
from fastapi import FastAPI
import httpx
from pathlib import Path
from app.routes.retrieval import router as retrieval_router
from app.routes.github_ingestion import router as github_ingestion_router

# Configure logging to ensure all logs are visible
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # Output to console
        logging.FileHandler('app.log', mode='a')  # Also log to file
    ]
)

# Set specific loggers
logger = logging.getLogger(__name__)
logging.getLogger('uvicorn').setLevel(logging.INFO)
logging.getLogger('uvicorn.access').setLevel(logging.INFO)

app = FastAPI(
    title="Information Retrieval API",
    description="API for semantic document retrieval using Milvus and ONNX embeddings",
    version="1.0.0"
)

app.include_router(retrieval_router, prefix="/api", tags=["retrieval"])
app.include_router(github_ingestion_router, prefix="/api", tags=["github_ingestion"])

@app.get("/")
async def root():
    logger.info("[MAIN] Root endpoint accessed")
    return {"message": "Information Retrieval API is running"}

@app.get("/health")
async def health_check():
    logger.info("[MAIN] Health check endpoint accessed")
    return {"status": "healthy"}

logger.info("[MAIN] FastAPI application initialized successfully")

# One-time startup task: trigger initial ingestion and forum import
_startup_done = False

@app.on_event("startup")
async def startup_tasks():
    global _startup_done
    if _startup_done:
        return
    _startup_done = True
    logger.info("[STARTUP] Running one-time startup tasks: initial ingestion and forum import")

    # Determine API base URL inside Docker or local
    api_base = os.getenv("SELF_API_BASE", "http://localhost:8000")

    # Prepare ingest body
    ingest_body = {
        "github_url": "https://github.com/beagleboard/docs.beagleboard.io",
        "collection_name": "beagleboard"
    }

    # Fire-and-forget task to avoid blocking startup
    async def do_startup_work():
        # 1) Call our own API to ingest GitHub repo (retry a few times to allow server to be ready)
        url = f"{api_base}/api/ingest-data"
        max_attempts = 5
        delay = 2
        for attempt in range(1, max_attempts + 1):
            try:
                if attempt == 1:
                    # small initial delay so the server is accepting connections
                    await asyncio.sleep(2)
                logger.info(f"[STARTUP] Calling ingest endpoint (attempt {attempt}/{max_attempts}): {url} -> {ingest_body}")
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(url, json=ingest_body)
                    if resp.status_code == 200:
                        logger.info("[STARTUP] GitHub ingest triggered successfully")
                        break
                    else:
                        logger.warning(f"[STARTUP] Ingest API returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"[STARTUP] Ingest API attempt {attempt} failed: {e}")
            if attempt < max_attempts:
                await asyncio.sleep(delay)

        # 2) Run forum ingestor script with provided JSON and same collection
        try:
            app_dir = Path(__file__).resolve().parent  # /app inside container
            json_path = app_dir / "data" / "scraped_threads_complete.json"
            script_path = app_dir / "app" / "scripts" / "forum_ingestor.py"
            if json_path.exists():
                cmd = [
                    sys.executable,
                    str(script_path),
                    str(json_path),
                    "--collection",
                    "beagleboard",
                ]
                logger.info(f"[STARTUP] Running forum ingestor: {' '.join(cmd)}")
                # Run in a separate process so it doesn't block; let it log to stdout
                proc = await asyncio.create_subprocess_exec(*cmd)
                # Don't await completion; it can run in background
            else:
                logger.warning(f"[STARTUP] Forum JSON not found at {json_path}; skipping forum ingest")
        except Exception as e:
            logger.exception(f"[STARTUP] Failed to start forum ingestor: {e}")

    asyncio.create_task(do_startup_work())
