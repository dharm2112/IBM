"""
src/ai/watsonx_service.py
─────────────────────────
Reusable IBM watsonx.ai service for the Clinical Trial Risk Monitor project.

Architecture note
─────────────────
This service is a *thin, dumb* transport layer.  It sends a fully-formed prompt
to watsonx.ai and returns the generated text verbatim.  It has NO knowledge of
clinical rules, deviation severity, risk scores, or business logic.

All clinical decisions are made by the deterministic rule engine (Member 1) and
then passed INTO the AI as factual evidence for explanation / summarisation
purposes only.

Future callers:
    src/ai/protocol_extractor.py  – extracts structured rules from PDF text
    src/ai/risk_explainer.py      – generates natural-language risk explanations
    src/ai/capa_generator.py      – drafts CAPA action items

Usage (direct)
──────────────
    from src.ai.watsonx_service import WatsonxService

    svc = WatsonxService()          # reads env vars automatically
    result = svc.generate_text(
        prompt="Summarise the following deviation: ...",
        max_new_tokens=300,
    )
    print(result.generated_text)

Usage (FastAPI dependency)
──────────────────────────
    from functools import lru_cache
    from src.ai.watsonx_service import WatsonxService

    @lru_cache(maxsize=1)
    def get_watsonx() -> WatsonxService:
        return WatsonxService()

    @app.post("/explain")
    async def explain(payload: ..., svc: WatsonxService = Depends(get_watsonx)):
        ...
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

# IBM watsonx.ai SDK
# pip install ibm-watsonx-ai
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.foundation_models.schema import TextGenParameters

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------


class WatsonxError(Exception):
    """Raised when the watsonx.ai service encounters an unrecoverable error."""


class WatsonxConfigError(WatsonxError):
    """Raised when required configuration / environment variables are missing."""


class WatsonxAPIError(WatsonxError):
    """Raised when the IBM watsonx.ai API returns an error response."""


# ---------------------------------------------------------------------------
# Configuration dataclass
# ---------------------------------------------------------------------------


@dataclass
class WatsonxConfig:
    """
    All configuration required to connect to IBM watsonx.ai.

    Values are read from environment variables.  This dataclass exists so that
    FastAPI / tests can override specific fields without monkey-patching os.environ.
    """

    api_key: str = field(default_factory=lambda: os.environ.get("WATSONX_APIKEY", ""))
    project_id: str = field(
        default_factory=lambda: os.environ.get("WATSONX_PROJECT_ID", "")
    )
    url: str = field(
        default_factory=lambda: os.environ.get(
            "WATSONX_URL", "https://us-south.ml.cloud.ibm.com"
        )
    )
    model_id: str = field(
        default_factory=lambda: os.environ.get(
            "WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct"
        )
    )

    def validate(self) -> None:
        """Raise WatsonxConfigError if any required field is missing."""
        missing: list[str] = []
        if not self.api_key:
            missing.append("WATSONX_APIKEY")
        if not self.project_id:
            missing.append("WATSONX_PROJECT_ID")
        if not self.url:
            missing.append("WATSONX_URL")
        if not self.model_id:
            missing.append("WATSONX_MODEL_ID")
        if missing:
            raise WatsonxConfigError(
                f"Missing required environment variable(s): {', '.join(missing)}"
            )


# ---------------------------------------------------------------------------
# Generation result
# ---------------------------------------------------------------------------


@dataclass
class GenerationResult:
    """Structured return value from generate_text()."""

    generated_text: str
    model_id: str
    input_token_count: int = 0
    generated_token_count: int = 0
    stop_reason: str = ""
    raw_response: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class WatsonxService:
    """
    Thin wrapper around the IBM watsonx.ai ModelInference API.

    Responsibilities
    ────────────────
    1. Load and validate credentials from environment variables.
    2. Initialise the IBM SDK client and model.
    3. Send prompts and return structured GenerationResult objects.
    4. Log activity without ever exposing API keys.
    5. Translate SDK exceptions into WatsonxError subclasses.

    NOT responsible for
    ───────────────────
    • Clinical deviation logic
    • Risk scoring
    • Severity classification
    • Anything deterministic — that belongs to the rule engine
    """

    def __init__(self, config: WatsonxConfig | None = None) -> None:
        self._config = config or WatsonxConfig()
        self._config.validate()
        self._model: ModelInference = self._build_model()
        logger.info(
            "WatsonxService initialised | model=%s | url=%s | project=%s",
            self._config.model_id,
            self._config.url,
            self._config.project_id,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_text(
        self,
        prompt: str,
        *,
        max_new_tokens: int = 512,
        min_new_tokens: int = 1,
        temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: int = 50,
        repetition_penalty: float = 1.1,
        stop_sequences: list[str] | None = None,
    ) -> GenerationResult:
        """
        Send *prompt* to watsonx.ai and return the generated text.

        Parameters
        ──────────
        prompt            : The fully-formed prompt string.
        max_new_tokens    : Hard cap on generated tokens (default 512).
        min_new_tokens    : Minimum tokens to generate (default 1).
        temperature       : Sampling temperature — lower = more deterministic.
        top_p             : Nucleus-sampling probability mass.
        top_k             : Top-K sampling pool size.
        repetition_penalty: Penalises token repetition (> 1.0 reduces loops).
        stop_sequences    : Optional list of strings that terminate generation.

        Returns
        ───────
        GenerationResult with .generated_text and metadata fields.

        Raises
        ──────
        WatsonxAPIError  : API returned an error.
        WatsonxError     : Unexpected SDK or network failure.
        """
        params = TextGenParameters(
            max_new_tokens=max_new_tokens,
            min_new_tokens=min_new_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            repetition_penalty=repetition_penalty,
            stop_sequences=stop_sequences or [],
        )

        logger.debug(
            "WatsonxService.generate_text | model=%s | prompt_chars=%d | max_new_tokens=%d",
            self._config.model_id,
            len(prompt),
            max_new_tokens,
        )

        try:
            raw = self._model.generate(prompt=prompt, params=params)
        except Exception as exc:
            logger.error(
                "WatsonxService.generate_text failed | model=%s | error=%s",
                self._config.model_id,
                type(exc).__name__,
                # NOTE: exc message intentionally NOT logged — it may contain
                #       request data.  Use DEBUG level only in non-prod.
            )
            raise WatsonxAPIError(
                f"watsonx.ai generation failed: {type(exc).__name__}: {exc}"
            ) from exc

        return self._parse_response(raw)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_model(self) -> ModelInference:
        """Construct the IBM SDK ModelInference object."""
        credentials = Credentials(
            api_key=self._config.api_key,
            url=self._config.url,
        )
        client = APIClient(credentials=credentials)
        return ModelInference(
            model_id=self._config.model_id,
            project_id=self._config.project_id,
            api_client=client,
        )

    @staticmethod
    def _parse_response(raw: dict[str, Any]) -> GenerationResult:
        """
        Extract fields from the watsonx.ai response dict into a GenerationResult.

        The SDK returns a dict structured roughly as:
          {
            "model_id": "...",
            "results": [
              {
                "generated_text": "...",
                "generated_tokens": 42,
                "input_token_count": 18,
                "stop_reason": "eos_token"
              }
            ]
          }
        """
        results: list[dict] = raw.get("results", [{}])
        first: dict = results[0] if results else {}

        return GenerationResult(
            generated_text=first.get("generated_text", "").strip(),
            model_id=raw.get("model_id", ""),
            input_token_count=first.get("input_token_count", 0),
            generated_token_count=first.get("generated_tokens", 0),
            stop_reason=first.get("stop_reason", ""),
            raw_response=raw,
        )
