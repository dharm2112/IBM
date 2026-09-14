"""
src/tests/backend/test_ai_routes.py
─────────────────────────────────────
API-level tests for the three AI endpoints.

All WatsonxService calls are mocked — no real IBM credentials are required.
Tests use FastAPI's TestClient (synchronous httpx-based) for simplicity.

Architecture invariants verified
──────────────────────────────────
• /ai/extract-protocol  — every rule in the response has status="pending"
• /ai/explain-risk      — risk_score / risk_level echoed verbatim from request
• /ai/generate-capa     — response always has status="draft" and
                          human_review_required=True

Run:
    pytest src/tests/backend/test_ai_routes.py -v
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Helpers — build mock WatsonxService return values
# ---------------------------------------------------------------------------

from src.ai.watsonx_service import GenerationResult, WatsonxAPIError, WatsonxConfigError


def _make_mock_svc() -> MagicMock:
    """Return a MagicMock WatsonxService that produces a neutral GenerationResult."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text="",
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=10,
        generated_token_count=50,
        stop_reason="eos_token",
    )
    return svc


# ---------------------------------------------------------------------------
# Fixture — TestClient with WatsonxService overridden
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_mock_svc():
    """
    Return a (TestClient, mock_svc) pair.

    WatsonxService is replaced via FastAPI's dependency_overrides so no
    real IBM API calls are ever made.
    """
    from src.backend.dependencies import get_watsonx
    from src.backend.main import app

    mock_svc = _make_mock_svc()
    app.dependency_overrides[get_watsonx] = lambda: mock_svc

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c, mock_svc

    # Clean up overrides after each test
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared test payloads
# ---------------------------------------------------------------------------

_PROTOCOL_TEXT = (
    "Subjects must receive Study Drug A at a dose of 10 mg orally once daily. "
    "Visit 2 must occur within ±3 days of Day 14. "
    "Haemoglobin must be ≥ 9.0 g/dL at screening."
)

_VALID_RULE_JSON = json.dumps([
    {
        "rule_id": "RULE-001",
        "category": "dosing",
        "description": "Subject must receive 10 mg orally once daily.",
        "condition": "",
        "expected_value": "10 mg",
        "allowed_range": "",
        "unit": "mg",
        "visit": "",
        "severity_hint": "must",
        "source_text": "Subjects must receive Study Drug A at a dose of 10 mg.",
        "confidence": "high",
        "status": "pending",
    }
])

_EXPLAIN_RISK_BODY = {
    "site_id": "SITE-042",
    "site_name": "Metro General Hospital",
    "risk_score": 78.4,
    "risk_level": "high",
    "total_patients": 24,
    "deviations": [
        {
            "deviation_id": "DEV-101",
            "rule_id": "RULE-003",
            "category": "dosing",
            "severity": "major",
            "description": "Subject received 15 mg instead of 10 mg on Day 7",
            "visit": "Visit 3",
            "affected_patients": 3,
            "occurrence_count": 3,
        }
    ],
    "protocol_title": "Phase II Study of Drug A",
    "observation_period_days": 90,
}

_EXPLAIN_RISK_AI_RESPONSE = json.dumps({
    "explanation": "Site SITE-042 has a high risk score of 78.4. "
                   "A major dosing deviation was detected at Visit 3.",
    "key_findings": [
        "1 major dosing deviation affecting 3 patients.",
        "Recurrence pattern observed across multiple occurrences.",
    ],
    "recommended_focus": "Review dosing procedures at Visit 3 immediately.",
})

_GENERATE_CAPA_BODY = {
    "deviation_id": "DEV-101",
    "rule_id": "RULE-003",
    "category": "dosing",
    "severity": "major",
    "description": "Subject received 15 mg instead of the required 10 mg on Day 7",
    "protocol_requirement": "Subjects must receive 10 mg orally once daily.",
    "site_id": "SITE-042",
    "site_name": "Metro General Hospital",
    "affected_patients": 3,
    "occurrence_count": 3,
    "visit": "Visit 3",
    "detection_date": "2024-03-15",
    "protocol_title": "Phase II Study of Drug A",
}

_GENERATE_CAPA_AI_RESPONSE = json.dumps({
    "root_cause_analysis": "Inadequate staff training on dosing protocol led to incorrect dose administration.",
    "immediate_actions": [
        "Notify Principal Investigator of major deviation DEV-101.",
        "Review affected patient records immediately.",
    ],
    "preventive_actions": [
        "Re-train site staff on dosing protocol section.",
        "Implement double-check procedure at each dose administration visit.",
    ],
    "timeline": [
        "Notify PI: within 1 day.",
        "Re-training: within 14 days.",
        "Verification checklist: within 30 days.",
    ],
    "effectiveness_check": "Zero dosing deviations in next 3 monitoring visits.",
})


# ===========================================================================
# 1. Health check
# ===========================================================================


class TestHealthCheck:
    def test_health_returns_200(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ===========================================================================
# 2. POST /ai/extract-protocol — happy path
# ===========================================================================


class TestExtractProtocolHappyPath:
    def test_returns_200(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert response.status_code == 200

    def test_rule_count_matches(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        body = response.json()
        assert body["rule_count"] == 1
        assert len(body["rules"]) == 1

    def test_all_rules_have_status_pending(self, client_with_mock_svc):
        """Architecture invariant: extracted rules are NEVER auto-approved."""
        client, mock_svc = client_with_mock_svc
        # Simulate model returning rules with status="approved" (should be overridden)
        rules_with_approved = json.dumps([
            {
                "rule_id": "RULE-001",
                "category": "dosing",
                "description": "10 mg once daily.",
                "condition": "",
                "expected_value": "10 mg",
                "allowed_range": "",
                "unit": "mg",
                "visit": "",
                "severity_hint": "must",
                "source_text": "must receive 10 mg",
                "confidence": "high",
                "status": "approved",   # Model tried to approve — must be overridden
            }
        ])
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=rules_with_approved,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert response.status_code == 200
        body = response.json()
        for rule in body["rules"]:
            assert rule["status"] == "pending", (
                f"Rule {rule.get('rule_id')} has status={rule['status']!r}; "
                "expected 'pending'"
            )

    def test_human_review_required_is_true(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert response.json()["human_review_required"] is True

    def test_response_contains_warnings_field(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert "warnings" in response.json()

    def test_watsonx_svc_called_once(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        mock_svc.generate_text.assert_called_once()


# ===========================================================================
# 3. POST /ai/extract-protocol — validation errors
# ===========================================================================


class TestExtractProtocolValidation:
    def test_missing_protocol_text_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post("/ai/extract-protocol", json={})
        assert response.status_code == 422

    def test_empty_protocol_text_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post(
            "/ai/extract-protocol", json={"protocol_text": ""}
        )
        assert response.status_code == 422

    def test_whitespace_only_protocol_text_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post(
            "/ai/extract-protocol", json={"protocol_text": "   \n\t  "}
        )
        assert response.status_code == 422


# ===========================================================================
# 4. POST /ai/extract-protocol — AI error handling
# ===========================================================================


class TestExtractProtocolErrors:
    def test_watsonx_api_error_returns_502(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert response.status_code == 502

    def test_watsonx_config_error_returns_503(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxConfigError("Missing creds")
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        assert response.status_code == 503

    def test_error_response_does_not_expose_api_key(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post(
            "/ai/extract-protocol",
            json={"protocol_text": _PROTOCOL_TEXT},
        )
        response_text = response.text
        # These strings should NEVER appear in any response
        assert "api_key" not in response_text
        assert "WATSONX_APIKEY" not in response_text
        assert "project_id" not in response_text



# ===========================================================================
# 4.5. POST /ai/extract-protocol-pdf
# ===========================================================================


class TestExtractProtocolPdf:
    def test_missing_file_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post("/ai/extract-protocol-pdf")
        assert response.status_code == 422

    def test_invalid_content_type_returns_400(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        files = {"file": ("test.txt", b"some text", "text/plain")}
        response = client.post("/ai/extract-protocol-pdf", files=files)
        assert response.status_code == 400
        assert "must be a PDF" in response.json()["detail"]

    @patch("src.backend.routers.ai_routes.pypdf.PdfReader")
    def test_empty_pdf_text_returns_400(self, mock_reader, client_with_mock_svc):
        client, _ = client_with_mock_svc
        
        # Mock PDF with no text
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "   \n  "
        mock_pdf.pages = [mock_page]
        mock_reader.return_value = mock_pdf

        files = {"file": ("test.pdf", b"%PDF-dummy", "application/pdf")}
        response = client.post("/ai/extract-protocol-pdf", files=files)
        assert response.status_code == 400
        assert "No extractable text" in response.json()["detail"]

    @patch("src.backend.routers.ai_routes.pypdf.PdfReader")
    def test_pdf_parse_error_returns_400(self, mock_reader, client_with_mock_svc):
        client, _ = client_with_mock_svc
        
        mock_reader.side_effect = Exception("Corrupt PDF file")

        files = {"file": ("test.pdf", b"garbage bytes", "application/pdf")}
        response = client.post("/ai/extract-protocol-pdf", files=files)
        assert response.status_code == 400
        assert "Failed to parse PDF" in response.json()["detail"]

    @patch("src.backend.routers.ai_routes.pypdf.PdfReader")
    def test_happy_path_extracts_and_delegates(self, mock_reader, client_with_mock_svc):
        client, svc = client_with_mock_svc
        
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "Mock Protocol Text from PDF"
        mock_pdf.pages = [mock_page]
        mock_reader.return_value = mock_pdf

        # Mock the protocol extractor result
        mock_result = MagicMock()
        mock_result.rule_count = 1
        mock_result.warnings = []
        mock_result.to_dict.return_value = {
            "rules": [
                {
                    "rule_id": "MED-001",
                    "category": "medication",
                    "description": "foo",
                    "severity": "major",
                }
            ]
        }

        with patch("src.backend.routers.ai_routes.ProtocolExtractor") as MockExtractor:
            mock_extractor_instance = MockExtractor.return_value
            mock_extractor_instance.extract.return_value = mock_result

            files = {"file": ("test.pdf", b"%PDF-1.4...", "application/pdf")}
            response = client.post("/ai/extract-protocol-pdf", files=files)

            assert response.status_code == 200
            data = response.json()
            assert data["rule_count"] == 1
            # Verify status is forced to "pending"
            assert data["rules"][0]["status"] == "pending"
            
            # Verify the extracted text was passed to the extractor
            mock_extractor_instance.extract.assert_called_once_with("Mock Protocol Text from PDF")


# ===========================================================================
# 5. POST /ai/explain-risk — happy path
# ===========================================================================


class TestExplainRiskHappyPath:
    def test_returns_200(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        assert response.status_code == 200

    def test_risk_score_echoed_verbatim(self, client_with_mock_svc):
        """Architecture invariant: risk_score must NOT be recalculated by the AI."""
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        body = response.json()
        assert body["risk_score"] == _EXPLAIN_RISK_BODY["risk_score"]

    def test_risk_level_echoed_verbatim(self, client_with_mock_svc):
        """Architecture invariant: risk_level must NOT be changed by the AI."""
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        body = response.json()
        assert body["risk_level"] == _EXPLAIN_RISK_BODY["risk_level"]

    def test_response_contains_explanation(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        body = response.json()
        assert "explanation" in body
        assert len(body["explanation"]) > 0

    def test_response_contains_key_findings_list(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        body = response.json()
        assert isinstance(body["key_findings"], list)

    def test_response_contains_recommended_focus(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        body = response.json()
        assert "recommended_focus" in body


# ===========================================================================
# 6. POST /ai/explain-risk — validation errors
# ===========================================================================


class TestExplainRiskValidation:
    def test_missing_body_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post("/ai/explain-risk", json={})
        assert response.status_code == 422

    def test_risk_score_out_of_range_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad_body = {**_EXPLAIN_RISK_BODY, "risk_score": 150.0}
        response = client.post("/ai/explain-risk", json=bad_body)
        assert response.status_code == 422

    def test_invalid_risk_level_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad_body = {**_EXPLAIN_RISK_BODY, "risk_level": "extreme"}
        response = client.post("/ai/explain-risk", json=bad_body)
        assert response.status_code == 422

    def test_negative_risk_score_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad_body = {**_EXPLAIN_RISK_BODY, "risk_score": -1.0}
        response = client.post("/ai/explain-risk", json=bad_body)
        assert response.status_code == 422


# ===========================================================================
# 7. POST /ai/explain-risk — AI error handling
# ===========================================================================


class TestExplainRiskErrors:
    def test_watsonx_api_error_returns_502(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        assert response.status_code == 502

    def test_watsonx_config_error_returns_503(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxConfigError("Missing creds")
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        assert response.status_code == 503

    def test_error_response_no_credentials(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        assert "api_key" not in response.text
        assert "WATSONX_APIKEY" not in response.text


# ===========================================================================
# 8. POST /ai/generate-capa — happy path
# ===========================================================================


class TestGenerateCapaHappyPath:
    def test_returns_200(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert response.status_code == 200

    def test_status_is_always_draft(self, client_with_mock_svc):
        """Architecture invariant: CAPA must NEVER be auto-approved."""
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        body = response.json()
        assert body["status"] == "draft"

    def test_human_review_required_is_true(self, client_with_mock_svc):
        """Architecture invariant: human review flag must always be True."""
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        body = response.json()
        assert body["human_review_required"] is True

    def test_deviation_id_echoed_in_response(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert response.json()["deviation_id"] == "DEV-101"

    def test_response_contains_structured_sections(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        body = response.json()
        assert "root_cause_analysis" in body
        assert "immediate_actions" in body
        assert "preventive_actions" in body
        assert "timeline" in body
        assert "effectiveness_check" in body
        assert "full_draft" in body

    def test_immediate_actions_is_list(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert isinstance(response.json()["immediate_actions"], list)

    def test_full_draft_contains_draft_marker(self, client_with_mock_svc):
        """full_draft must clearly indicate it is a draft requiring review."""
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        full_draft = response.json()["full_draft"]
        # The CapaGenerator always includes a draft header
        assert "DRAFT" in full_draft.upper()

    def test_message_mentions_human_review(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        message = response.json()["message"].lower()
        assert "review" in message


# ===========================================================================
# 9. POST /ai/generate-capa — validation errors
# ===========================================================================


class TestGenerateCapaValidation:
    def test_missing_body_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        response = client.post("/ai/generate-capa", json={})
        assert response.status_code == 422

    def test_invalid_severity_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad = {**_GENERATE_CAPA_BODY, "severity": "extreme"}
        response = client.post("/ai/generate-capa", json=bad)
        assert response.status_code == 422

    def test_invalid_category_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad = {**_GENERATE_CAPA_BODY, "category": "unknown_category"}
        response = client.post("/ai/generate-capa", json=bad)
        assert response.status_code == 422

    def test_empty_deviation_id_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad = {**_GENERATE_CAPA_BODY, "deviation_id": ""}
        response = client.post("/ai/generate-capa", json=bad)
        assert response.status_code == 422

    def test_empty_description_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad = {**_GENERATE_CAPA_BODY, "description": ""}
        response = client.post("/ai/generate-capa", json=bad)
        assert response.status_code == 422

    def test_empty_protocol_requirement_returns_422(self, client_with_mock_svc):
        client, _ = client_with_mock_svc
        bad = {**_GENERATE_CAPA_BODY, "protocol_requirement": ""}
        response = client.post("/ai/generate-capa", json=bad)
        assert response.status_code == 422


# ===========================================================================
# 10. POST /ai/generate-capa — AI error handling
# ===========================================================================


class TestGenerateCapaErrors:
    def test_watsonx_api_error_returns_502(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert response.status_code == 502

    def test_watsonx_config_error_returns_503(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxConfigError("Missing creds")
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert response.status_code == 503

    def test_error_response_no_credentials(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        assert "api_key" not in response.text
        assert "WATSONX_APIKEY" not in response.text

    def test_svc_called_exactly_once_per_request(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        mock_svc.generate_text.assert_called_once()


# ===========================================================================
# 11. Cross-cutting — secrets never leak
# ===========================================================================


class TestSecretSafety:
    """Verify that IBM credentials never appear in any API response."""

    _SENSITIVE_STRINGS = [
        "api_key",
        "WATSONX_APIKEY",
        "project_id",
        "WATSONX_PROJECT_ID",
    ]

    def _assert_no_secrets(self, response_text: str) -> None:
        for s in self._SENSITIVE_STRINGS:
            assert s not in response_text, (
                f"Sensitive string {s!r} found in API response."
            )

    def test_extract_protocol_response_no_secrets(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_VALID_RULE_JSON,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=100,
            generated_token_count=200,
            stop_reason="eos_token",
        )
        response = client.post(
            "/ai/extract-protocol", json={"protocol_text": _PROTOCOL_TEXT}
        )
        self._assert_no_secrets(response.text)

    def test_explain_risk_response_no_secrets(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_EXPLAIN_RISK_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=150,
            generated_token_count=120,
            stop_reason="eos_token",
        )
        response = client.post("/ai/explain-risk", json=_EXPLAIN_RISK_BODY)
        self._assert_no_secrets(response.text)

    def test_generate_capa_response_no_secrets(self, client_with_mock_svc):
        client, mock_svc = client_with_mock_svc
        mock_svc.generate_text.return_value = GenerationResult(
            generated_text=_GENERATE_CAPA_AI_RESPONSE,
            model_id="ibm/granite-13b-instruct-v2",
            input_token_count=200,
            generated_token_count=300,
            stop_reason="eos_token",
        )
        response = client.post("/ai/generate-capa", json=_GENERATE_CAPA_BODY)
        self._assert_no_secrets(response.text)
