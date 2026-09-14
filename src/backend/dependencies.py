"""
src/backend/dependencies.py
────────────────────────────
FastAPI dependency-injection helpers for the AI layer.

Design
──────
• get_watsonx() returns a process-wide singleton WatsonxService via lru_cache.
  This avoids rebuilding the IBM SDK client on every request.
• IBM credentials are loaded from environment variables inside WatsonxConfig —
  they NEVER appear in request/response payloads or log output.
• The dependency is written as a plain function (not an async generator) so it
  can be overridden trivially in tests via app.dependency_overrides.

Usage in routes
───────────────
    from src.backend.dependencies import get_watsonx

    @router.post("/ai/extract-protocol")
    def extract_protocol(
        body: ExtractProtocolRequest,
        svc: WatsonxService = Depends(get_watsonx),
    ):
        ...

Usage in tests
──────────────
    from src.backend.dependencies import get_watsonx

    app.dependency_overrides[get_watsonx] = lambda: mock_svc
"""

from __future__ import annotations

import logging
from functools import lru_cache

from src.ai.watsonx_service import WatsonxService

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_watsonx() -> WatsonxService:
    """
    Return the process-wide WatsonxService singleton.

    The first call instantiates the service (reads env vars, validates config,
    and initialises the IBM SDK client).  Subsequent calls return the cached
    instance.

    Raises WatsonxConfigError if required environment variables are missing.
    """
    logger.info("Initialising WatsonxService singleton (first call).")
    return WatsonxService()
