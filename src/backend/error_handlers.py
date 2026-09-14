"""
src/backend/error_handlers.py
───────────────────────────────
Registers exception handlers on the FastAPI application for all AI-layer
and configuration errors.

Security contract
─────────────────
• IBM credentials (api_key, project_id, url) are NEVER included in error
  responses or log messages at INFO/ERROR level.
• Error details contain only the exception type and a safe message.

HTTP status mapping
───────────────────
WatsonxConfigError          → 503  Service Unavailable (misconfiguration)
WatsonxAPIError             → 502  Bad Gateway (IBM API failure)
WatsonxError (generic)      → 502  Bad Gateway

ProtocolExtractionError     → 422  Unprocessable Entity (bad input)
ProtocolParseError          → 502  Bad Gateway (model returned bad JSON)

RiskExplainerError          → 422  Unprocessable Entity (bad input)
RiskExplainerParseError     → 502  Bad Gateway

CapaGeneratorError          → 422  Unprocessable Entity (bad input)
CapaParseError              → 502  Bad Gateway
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.ai.capa_generator import CapaGeneratorError, CapaParseError
from src.ai.protocol_extractor import ProtocolExtractionError, ProtocolParseError
from src.ai.risk_explainer import RiskExplainerError, RiskExplainerParseError
from src.ai.watsonx_service import WatsonxAPIError, WatsonxConfigError, WatsonxError

logger = logging.getLogger(__name__)


def _error_body(error_type: str, message: str) -> dict:
    """Build a safe, structured error response dict."""
    return {"error": error_type, "message": message}


def register_error_handlers(app: FastAPI) -> None:
    """Register all AI-layer exception handlers on *app*."""

    # ------------------------------------------------------------------
    # WatsonxConfigError — missing environment variables
    # ------------------------------------------------------------------
    @app.exception_handler(WatsonxConfigError)
    async def watsonx_config_error_handler(
        request: Request, exc: WatsonxConfigError
    ) -> JSONResponse:
        logger.error(
            "WatsonxConfigError: missing IBM credentials configuration. "
            "Check WATSONX_APIKEY, WATSONX_PROJECT_ID, WATSONX_URL, WATSONX_MODEL_ID."
        )
        return JSONResponse(
            status_code=503,
            content=_error_body(
                "WatsonxConfigError",
                "IBM watsonx.ai is not configured. "
                "Check server environment variables (WATSONX_*).",
            ),
        )

    # ------------------------------------------------------------------
    # WatsonxAPIError — IBM API returned an error
    # ------------------------------------------------------------------
    @app.exception_handler(WatsonxAPIError)
    async def watsonx_api_error_handler(
        request: Request, exc: WatsonxAPIError
    ) -> JSONResponse:
        logger.error(
            "WatsonxAPIError on %s %s: %s",
            request.method,
            request.url.path,
            type(exc).__name__,
            # exc message intentionally excluded — may contain request data
        )
        return JSONResponse(
            status_code=502,
            content=_error_body(
                "WatsonxAPIError",
                "The IBM watsonx.ai API returned an error. Please try again later.",
            ),
        )

    # ------------------------------------------------------------------
    # WatsonxError — generic fallback
    # ------------------------------------------------------------------
    @app.exception_handler(WatsonxError)
    async def watsonx_error_handler(
        request: Request, exc: WatsonxError
    ) -> JSONResponse:
        logger.error(
            "WatsonxError on %s %s: %s",
            request.method,
            request.url.path,
            type(exc).__name__,
        )
        return JSONResponse(
            status_code=502,
            content=_error_body(
                "WatsonxError",
                "An unexpected error occurred in the IBM watsonx.ai service.",
            ),
        )

    # ------------------------------------------------------------------
    # ProtocolParseError — model returned un-parseable JSON
    # ------------------------------------------------------------------
    @app.exception_handler(ProtocolParseError)
    async def protocol_parse_error_handler(
        request: Request, exc: ProtocolParseError
    ) -> JSONResponse:
        logger.warning(
            "ProtocolParseError on %s: %s", request.url.path, type(exc).__name__
        )
        return JSONResponse(
            status_code=502,
            content=_error_body(
                "ProtocolParseError",
                "The AI model returned a response that could not be parsed as valid "
                "JSON. Please retry or check the protocol text.",
            ),
        )

    # ------------------------------------------------------------------
    # ProtocolExtractionError — bad input (empty text, etc.)
    # ------------------------------------------------------------------
    @app.exception_handler(ProtocolExtractionError)
    async def protocol_extraction_error_handler(
        request: Request, exc: ProtocolExtractionError
    ) -> JSONResponse:
        logger.warning(
            "ProtocolExtractionError on %s: %s", request.url.path, str(exc)
        )
        return JSONResponse(
            status_code=422,
            content=_error_body("ProtocolExtractionError", str(exc)),
        )

    # ------------------------------------------------------------------
    # RiskExplainerParseError — model returned un-parseable JSON
    # ------------------------------------------------------------------
    @app.exception_handler(RiskExplainerParseError)
    async def risk_explainer_parse_error_handler(
        request: Request, exc: RiskExplainerParseError
    ) -> JSONResponse:
        logger.warning(
            "RiskExplainerParseError on %s: %s", request.url.path, type(exc).__name__
        )
        return JSONResponse(
            status_code=502,
            content=_error_body(
                "RiskExplainerParseError",
                "The AI model returned a response that could not be parsed. "
                "Please retry.",
            ),
        )

    # ------------------------------------------------------------------
    # RiskExplainerError — bad input
    # ------------------------------------------------------------------
    @app.exception_handler(RiskExplainerError)
    async def risk_explainer_error_handler(
        request: Request, exc: RiskExplainerError
    ) -> JSONResponse:
        logger.warning(
            "RiskExplainerError on %s: %s", request.url.path, str(exc)
        )
        return JSONResponse(
            status_code=422,
            content=_error_body("RiskExplainerError", str(exc)),
        )

    # ------------------------------------------------------------------
    # CapaParseError — model returned un-parseable JSON
    # ------------------------------------------------------------------
    @app.exception_handler(CapaParseError)
    async def capa_parse_error_handler(
        request: Request, exc: CapaParseError
    ) -> JSONResponse:
        logger.warning(
            "CapaParseError on %s: %s", request.url.path, type(exc).__name__
        )
        return JSONResponse(
            status_code=502,
            content=_error_body(
                "CapaParseError",
                "The AI model returned a CAPA response that could not be parsed. "
                "Please retry.",
            ),
        )

    # ------------------------------------------------------------------
    # CapaGeneratorError — bad input
    # ------------------------------------------------------------------
    @app.exception_handler(CapaGeneratorError)
    async def capa_generator_error_handler(
        request: Request, exc: CapaGeneratorError
    ) -> JSONResponse:
        logger.warning(
            "CapaGeneratorError on %s: %s", request.url.path, str(exc)
        )
        return JSONResponse(
            status_code=422,
            content=_error_body("CapaGeneratorError", str(exc)),
        )
