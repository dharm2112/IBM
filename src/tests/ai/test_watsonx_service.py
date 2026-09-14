"""
tests/ai/test_watsonx_service.py
─────────────────────────────────
Unit tests for src/ai/watsonx_service.py.

All IBM SDK calls are mocked.  No real API key is required.

Run:
    pytest src/tests/ai/test_watsonx_service.py -v
"""

from __future__ import annotations

import logging
import os
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Minimal fake response that mirrors the IBM SDK's dict structure
FAKE_SDK_RESPONSE: dict = {
    "model_id": "ibm/granite-13b-instruct-v2",
    "results": [
        {
            "generated_text": "  This is a test response.  ",
            "generated_tokens": 8,
            "input_token_count": 12,
            "stop_reason": "eos_token",
        }
    ],
}


def _make_config_kwargs(overrides: dict[str, str] | None = None) -> dict[str, str]:
    """Return WatsonxConfig field kwargs (snake_case) with valid test values."""
    base = {
        "api_key": "test-api-key",
        "project_id": "test-project-id",
        "url": "https://us-south.ml.cloud.ibm.com",
        "model_id": "ibm/granite-13b-instruct-v2",
    }
    if overrides:
        base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_model_inference():
    """
    Patch ibm_watsonx_ai so that no real HTTP call is ever made.
    Returns the mock ModelInference instance for further configuration.
    """
    with (
        patch("src.ai.watsonx_service.Credentials") as mock_creds,
        patch("src.ai.watsonx_service.APIClient") as mock_client_cls,
        patch("src.ai.watsonx_service.ModelInference") as mock_model_cls,
    ):
        mock_model = MagicMock()
        mock_model.generate.return_value = FAKE_SDK_RESPONSE
        mock_model_cls.return_value = mock_model
        yield {
            "model": mock_model,
            "model_cls": mock_model_cls,
            "client_cls": mock_client_cls,
            "creds_cls": mock_creds,
        }


# ---------------------------------------------------------------------------
# 1. Configuration validation
# ---------------------------------------------------------------------------


class TestWatsonxConfig:
    def test_missing_api_key_raises(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError

        cfg = WatsonxConfig(
            api_key="",
            project_id="pid",
            url="https://us-south.ml.cloud.ibm.com",
            model_id="ibm/granite-13b-instruct-v2",
        )
        with pytest.raises(WatsonxConfigError, match="WATSONX_APIKEY"):
            cfg.validate()

    def test_missing_project_id_raises(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError

        cfg = WatsonxConfig(
            api_key="key",
            project_id="",
            url="https://us-south.ml.cloud.ibm.com",
            model_id="ibm/granite-13b-instruct-v2",
        )
        with pytest.raises(WatsonxConfigError, match="WATSONX_PROJECT_ID"):
            cfg.validate()

    def test_missing_url_raises(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError

        cfg = WatsonxConfig(
            api_key="key",
            project_id="pid",
            url="",
            model_id="ibm/granite-13b-instruct-v2",
        )
        with pytest.raises(WatsonxConfigError, match="WATSONX_URL"):
            cfg.validate()

    def test_missing_model_id_raises(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError

        cfg = WatsonxConfig(
            api_key="key",
            project_id="pid",
            url="https://us-south.ml.cloud.ibm.com",
            model_id="",
        )
        with pytest.raises(WatsonxConfigError, match="WATSONX_MODEL_ID"):
            cfg.validate()

    def test_all_missing_lists_all_vars(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError

        cfg = WatsonxConfig(api_key="", project_id="", url="", model_id="")
        with pytest.raises(WatsonxConfigError) as exc_info:
            cfg.validate()
        msg = str(exc_info.value)
        assert "WATSONX_APIKEY" in msg
        assert "WATSONX_PROJECT_ID" in msg
        assert "WATSONX_URL" in msg
        assert "WATSONX_MODEL_ID" in msg

    def test_reads_from_env_vars(self, monkeypatch):
        from src.ai.watsonx_service import WatsonxConfig

        monkeypatch.setenv("WATSONX_APIKEY", "test-api-key")
        monkeypatch.setenv("WATSONX_PROJECT_ID", "test-project-id")
        monkeypatch.setenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
        monkeypatch.setenv("WATSONX_MODEL_ID", "ibm/granite-13b-instruct-v2")

        cfg = WatsonxConfig()
        assert cfg.api_key == "test-api-key"
        assert cfg.project_id == "test-project-id"
        assert cfg.model_id == "ibm/granite-13b-instruct-v2"


# ---------------------------------------------------------------------------
# 2. Service initialisation
# ---------------------------------------------------------------------------


class TestWatsonxServiceInit:
    def test_initialises_successfully(self, mock_model_inference, monkeypatch):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)
        assert svc is not None

    def test_model_inference_constructed_with_correct_args(
        self, mock_model_inference, monkeypatch
    ):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        WatsonxService(config=cfg)

        mock_model_inference["model_cls"].assert_called_once_with(
            model_id="ibm/granite-13b-instruct-v2",
            project_id="test-project-id",
            api_client=mock_model_inference["client_cls"].return_value,
        )

    def test_config_error_on_missing_key(self):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxConfigError, WatsonxService

        cfg = WatsonxConfig(api_key="", project_id="pid", url="url", model_id="m")
        with pytest.raises(WatsonxConfigError):
            WatsonxService(config=cfg)


# ---------------------------------------------------------------------------
# 3. Successful generation flow
# ---------------------------------------------------------------------------


class TestGenerateText:
    def test_returns_generation_result(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)
        result = svc.generate_text("Test prompt")

        assert result.generated_text == "This is a test response."  # strip() applied
        assert result.model_id == "ibm/granite-13b-instruct-v2"
        assert result.generated_token_count == 8
        assert result.input_token_count == 12
        assert result.stop_reason == "eos_token"

    def test_generate_calls_sdk_with_correct_prompt(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)
        svc.generate_text("Hello watsonx")

        call_kwargs = mock_model_inference["model"].generate.call_args
        assert call_kwargs.kwargs["prompt"] == "Hello watsonx"

    def test_max_new_tokens_forwarded(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)
        svc.generate_text("prompt", max_new_tokens=128)

        params = mock_model_inference["model"].generate.call_args.kwargs["params"]
        assert params.max_new_tokens == 128

    def test_raw_response_stored(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)
        result = svc.generate_text("prompt")

        assert result.raw_response == FAKE_SDK_RESPONSE


# ---------------------------------------------------------------------------
# 4. API error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    def test_sdk_exception_raises_watsonx_api_error(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxAPIError, WatsonxConfig, WatsonxService

        mock_model_inference["model"].generate.side_effect = RuntimeError(
            "Connection refused"
        )
        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)

        with pytest.raises(WatsonxAPIError, match="generation failed"):
            svc.generate_text("prompt")

    def test_original_exception_is_chained(self, mock_model_inference):
        from src.ai.watsonx_service import WatsonxAPIError, WatsonxConfig, WatsonxService

        original = ValueError("Bad request from IBM")
        mock_model_inference["model"].generate.side_effect = original
        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)

        with pytest.raises(WatsonxAPIError) as exc_info:
            svc.generate_text("prompt")

        assert exc_info.value.__cause__ is original


# ---------------------------------------------------------------------------
# 5. Secrets must not appear in logs
# ---------------------------------------------------------------------------


class TestSecretSafety:
    def test_api_key_not_logged_on_init(self, mock_model_inference, caplog):
        from src.ai.watsonx_service import WatsonxConfig, WatsonxService

        cfg = WatsonxConfig(**_make_config_kwargs())
        with caplog.at_level(logging.DEBUG, logger="src.ai.watsonx_service"):
            WatsonxService(config=cfg)

        full_log = caplog.text
        assert "test-api-key" not in full_log

    def test_api_key_not_logged_on_error(self, mock_model_inference, caplog):
        from src.ai.watsonx_service import WatsonxAPIError, WatsonxConfig, WatsonxService

        mock_model_inference["model"].generate.side_effect = RuntimeError("boom")
        cfg = WatsonxConfig(**_make_config_kwargs())
        svc = WatsonxService(config=cfg)

        with caplog.at_level(logging.DEBUG, logger="src.ai.watsonx_service"):
            with pytest.raises(WatsonxAPIError):
                svc.generate_text("prompt")

        assert "test-api-key" not in caplog.text
