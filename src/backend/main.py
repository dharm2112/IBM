"""
src/backend/main.py
────────────────────
FastAPI application factory for the Clinical Trial Risk Monitor backend.

Start the server
────────────────
    uvicorn src.backend.main:app --reload --port 8000

Or via env var:
    APP_PORT=8000 uvicorn src.backend.main:app --reload

Environment variables (see src/.env.example)
────────────────────────────────────────────
    WATSONX_APIKEY       — IBM Cloud API key
    WATSONX_PROJECT_ID   — watsonx.ai project ID
    WATSONX_URL          — regional endpoint
    WATSONX_MODEL_ID     — foundation model ID
    APP_PORT             — HTTP port (default 8000)
    APP_ENV              — development | staging | production
    LOG_LEVEL            — DEBUG | INFO | WARNING | ERROR (default INFO)

Security note
─────────────
IBM credentials are loaded from environment variables by WatsonxConfig.
They are NEVER exposed through any API response, error message, or log line
at INFO/ERROR level.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from multiple candidate locations — first file found wins.
# Search order: project root → src/ → scripts/
# This allows the .env to live anywhere common developers place it.
import pathlib
_BASE = pathlib.Path(__file__).resolve().parents[2]  # d:\hackthon\IBM
for _env_candidate in [
    _BASE / ".env",
    _BASE / "src" / ".env",
    _BASE / "scripts" / ".env",
]:
    if _env_candidate.exists() and _env_candidate.stat().st_size > 0:
        load_dotenv(dotenv_path=str(_env_candidate), override=True)
        break
else:
    # Fall back to default search (handles venv/docker scenarios)
    load_dotenv()

from src.backend.error_handlers import register_error_handlers
from src.backend.routers.ai_routes import router as ai_router
from src.backend.routers.engine_routes import router as engine_router
from src.backend.routers.data_routes import router as data_router
from src.backend.database import init_db

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

_APP_ENV = os.environ.get("APP_ENV", "development")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app_instance: "FastAPI"):
    """Startup / shutdown lifecycle handler."""
    # Initialise database tables (idempotent)
    init_db()
    logger.info(
        "Clinical Trial Risk Monitor API starting | env=%s | log_level=%s",
        _APP_ENV,
        _LOG_LEVEL,
    )
    yield
    logger.info("Clinical Trial Risk Monitor API shutting down.")


app = FastAPI(
    title="Clinical Trial Risk Monitor — AI API",
    description=(
        "Exposes IBM watsonx.ai capabilities for clinical trial risk monitoring. "
        "All AI endpoints operate on pre-computed facts from the deterministic "
        "rule engine. The AI layer generates explanations, extracts protocol "
        "rules, and drafts CAPA documents — it never makes clinical decisions "
        "autonomously."
    ),
    version="1.0.0",
    docs_url="/docs" if _APP_ENV != "production" else None,
    redoc_url="/redoc" if _APP_ENV != "production" else None,
    lifespan=lifespan,
)

# CORS — adjust allowed origins for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _APP_ENV == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register AI-layer exception handlers
register_error_handlers(app)

# Mount routers
app.include_router(ai_router)
app.include_router(engine_router)
app.include_router(data_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["Health"])
def health_check() -> dict:
    """Lightweight liveness check — returns 200 if the app is running."""
    return {"status": "ok", "env": _APP_ENV}



