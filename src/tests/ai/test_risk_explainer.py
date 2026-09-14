"""
src/tests/ai/test_risk_explainer.py
─────────────────────────────────────
Unit tests for src/ai/risk_explainer.py.

WatsonxService is fully mocked — no real IBM credentials required.

Run:
    pytest src/tests/ai/test_risk_explainer.py -v
"""

from __future__ import annotations

import json
import logging
from unittest.mock import MagicMock

import pytest

from src.ai.risk_explainer import (
    DeviationSummary,
    RiskExplainerError,
    RiskExplainerParseError,
    RiskExplainer,
    RiskExplanation,
    SiteRiskContext,
    _build_prompt,
    _extract_json_object,
    _validate_response,
)
from src.ai.watsonx_service import GenerationResult

# ---------------------------------------------------------------------------
# Shared fixtures & helpers
# ---------------------------------------------------------------------------

_SAMPLE_DEVIATION = DeviationSummary(
    deviation_id="DEV-101",
    rule_id="RULE-003",
    category="dosing",
    severity="major",
    description="Subject received 15 mg instead of 10 mg on Day 7",
    visit="Visit 3",
    affected_patients=3,
    occurrence_count=3,
)

_SAMPLE_CONTEXT = SiteRiskContext(
    site_id="SITE-042",
    site_name="Metro General Hospital",
    risk_score=78.4,
    risk_level="high",
    total_patients=24,
    deviations=[_SAMPLE_DEVIATION],
    protocol_title="Phase II Study of Drug A in Adults",
    observation_period_days=90,
)

_VALID_MODEL_RESPONSE: dict = {
    "explanation": (
        "Site SITE-042 (Metro General Hospital) has been assigned a HIGH risk score "
        "of 78.4 out of 100 based on 1 detected protocol deviation over the 90-day "
        "observation period. A major dosing deviation was recorded at Visit 3, where "
        "3 subjects received 15 mg instead of the required 10 mg dose. This pattern "
        "indicates a systematic administration error requiring immediate investigation."
    ),
    "key_findings": [
        "1 major dosing deviation affected 3 of 24 enrolled patients (12.5%).",
        "Deviation DEV-101 occurred at Visit 3, suggesting a visit-specific protocol gap.",
        "Risk score of 78.4 places this site in the HIGH risk tier.",
    ],
    "recommended_focus": (
        "Immediate review of Visit 3 drug dispensing procedures and staff training records."
    ),
}


def _make_svc(response_obj: dict) -> MagicMock:
    """Return a mock WatsonxService returning the given dict as JSON text."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text=json.dumps(response_obj),
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=80,
        generated_token_count=200,
        stop_reason="eos_token",
    )
    return svc


def _make_svc_raw(text: str) -> MagicMock:
    """Return a mock WatsonxService returning raw text verbatim."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text=text,
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=80,
        generated_token_count=50,
        stop_reason="eos_token",
    )
    return svc


# ---------------------------------------------------------------------------
# 1. Prompt builder
# ---------------------------------------------------------------------------


class TestBuildPrompt:
    def test_contains_site_id(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "SITE-042" in prompt

    def test_contains_risk_score(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "78.4" in prompt

    def test_contains_risk_level(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "high" in prompt

    def test_contains_deviation_description(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "15 mg instead of 10 mg" in prompt

    def test_contains_required_output_fields(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "explanation" in prompt
        assert "key_findings" in prompt
        assert "recommended_focus" in prompt

    def test_instructs_not_to_recalculate_score(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "NOT" in prompt
        assert "recalculate" in prompt.lower() or "do not" in prompt.lower()

    def test_instructs_not_to_change_severity(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "severity" in prompt.lower()

    def test_prohibits_inventing_data(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "invent" in prompt.lower() or "do not" in prompt.lower()

    def test_data_boundaries_present(self):
        prompt = _build_prompt(_SAMPLE_CONTEXT)
        assert "=== SITE RISK DATA BEGIN ===" in prompt
        assert "=== SITE RISK DATA END ===" in prompt

    def test_no_deviations_context_still_builds_prompt(self):
        ctx = SiteRiskContext(
            site_id="SITE-001",
            risk_score=10.0,
            risk_level="low",
            total_patients=5,
            deviations=[],
        )
        prompt = _build_prompt(ctx)
        assert "SITE-001" in prompt


# ---------------------------------------------------------------------------
# 2. JSON object extractor
# ---------------------------------------------------------------------------


class TestExtractJsonObject:
    def test_plain_json_object(self):
        raw = '{"explanation": "test", "key_findings": [], "recommended_focus": "x"}'
        result = _extract_json_object(raw)
        assert result["explanation"] == "test"

    def test_strips_markdown_fences(self):
        raw = '```json\n{"a": 1}\n```'
        result = _extract_json_object(raw)
        assert result == {"a": 1}

    def test_strips_plain_fences(self):
        raw = '```\n{"b": 2}\n```'
        result = _extract_json_object(raw)
        assert result == {"b": 2}

    def test_leading_prose_trimmed(self):
        raw = 'Here is the explanation:\n{"x": 9}'
        result = _extract_json_object(raw)
        assert result == {"x": 9}

    def test_no_object_raises_parse_error(self):
        with pytest.raises(RiskExplainerParseError, match="does not contain a JSON object"):
            _extract_json_object("This is plain text, no JSON here.")

    def test_malformed_json_raises_parse_error(self):
        with pytest.raises(RiskExplainerParseError, match="malformed JSON"):
            _extract_json_object("{broken: json}")

    def test_empty_string_raises_parse_error(self):
        with pytest.raises(RiskExplainerParseError):
            _extract_json_object("")

    def test_nested_object_parsed_correctly(self):
        raw = '{"explanation": "text", "key_findings": ["a", "b"], "recommended_focus": "c"}'
        result = _extract_json_object(raw)
        assert result["key_findings"] == ["a", "b"]


# ---------------------------------------------------------------------------
# 3. Response validator
# ---------------------------------------------------------------------------


class TestValidateResponse:
    def test_valid_response_accepted(self):
        explanation, warnings = _validate_response(dict(_VALID_MODEL_RESPONSE))
        assert isinstance(explanation, RiskExplanation)
        assert warnings == []

    def test_explanation_field_populated(self):
        explanation, _ = _validate_response(dict(_VALID_MODEL_RESPONSE))
        assert "SITE-042" in explanation.explanation

    def test_key_findings_populated(self):
        explanation, _ = _validate_response(dict(_VALID_MODEL_RESPONSE))
        assert len(explanation.key_findings) == 3

    def test_recommended_focus_populated(self):
        explanation, _ = _validate_response(dict(_VALID_MODEL_RESPONSE))
        assert len(explanation.recommended_focus) > 0

    def test_empty_explanation_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "explanation": ""}
        explanation, warnings = _validate_response(raw)
        assert "manually" in explanation.explanation
        assert any("empty 'explanation'" in w for w in warnings)

    def test_empty_key_findings_list_generates_warning(self):
        raw = {**_VALID_MODEL_RESPONSE, "key_findings": []}
        _, warnings = _validate_response(raw)
        assert any("no key_findings" in w for w in warnings)

    def test_non_list_key_findings_coerced_to_empty(self):
        raw = {**_VALID_MODEL_RESPONSE, "key_findings": "not a list"}
        explanation, warnings = _validate_response(raw)
        assert explanation.key_findings == []
        assert any("expected list" in w for w in warnings)

    def test_empty_recommended_focus_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "recommended_focus": ""}
        explanation, warnings = _validate_response(raw)
        assert len(explanation.recommended_focus) > 0
        assert any("empty 'recommended_focus'" in w for w in warnings)

    def test_blank_key_findings_entries_stripped(self):
        raw = {**_VALID_MODEL_RESPONSE, "key_findings": ["valid finding", "  ", ""]}
        explanation, _ = _validate_response(raw)
        assert explanation.key_findings == ["valid finding"]


# ---------------------------------------------------------------------------
# 4. SiteRiskContext validation
# ---------------------------------------------------------------------------


class TestContextValidation:
    def test_empty_site_id_raises(self):
        ctx = SiteRiskContext(
            site_id="", risk_score=50.0, risk_level="medium",
            total_patients=10, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        explainer = RiskExplainer(svc)
        with pytest.raises(RiskExplainerError, match="site_id must not be empty"):
            explainer.explain(ctx)

    def test_risk_score_above_100_raises(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=101.0, risk_level="high",
            total_patients=10, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(RiskExplainerError, match="risk_score must be in"):
            RiskExplainer(svc).explain(ctx)

    def test_negative_risk_score_raises(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=-1.0, risk_level="low",
            total_patients=5, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(RiskExplainerError, match="risk_score must be in"):
            RiskExplainer(svc).explain(ctx)

    def test_invalid_risk_level_raises(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=50.0, risk_level="extreme",
            total_patients=10, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(RiskExplainerError, match="risk_level must be one of"):
            RiskExplainer(svc).explain(ctx)

    def test_all_valid_risk_levels_accepted(self):
        for level in ("low", "medium", "high", "critical"):
            ctx = SiteRiskContext(
                site_id="SITE-001", risk_score=50.0, risk_level=level,
                total_patients=5, deviations=[]
            )
            svc = _make_svc(_VALID_MODEL_RESPONSE)
            result = RiskExplainer(svc).explain(ctx)
            assert isinstance(result, RiskExplanation)

    def test_zero_deviations_context_accepted(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=5.0, risk_level="low",
            total_patients=3, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(ctx)
        assert isinstance(result, RiskExplanation)

    def test_risk_score_boundary_zero(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=0.0, risk_level="low",
            total_patients=1, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(ctx)
        assert result is not None

    def test_risk_score_boundary_100(self):
        ctx = SiteRiskContext(
            site_id="SITE-001", risk_score=100.0, risk_level="critical",
            total_patients=1, deviations=[]
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(ctx)
        assert result is not None


# ---------------------------------------------------------------------------
# 5. RiskExplainer — successful explain flow
# ---------------------------------------------------------------------------


class TestRiskExplainerSuccess:
    def test_returns_risk_explanation(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert isinstance(result, RiskExplanation)

    def test_explanation_text_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert len(result.explanation) > 0

    def test_key_findings_list_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert len(result.key_findings) == 3

    def test_recommended_focus_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert len(result.recommended_focus) > 0

    def test_raw_model_output_stored(self):
        raw_json = json.dumps(_VALID_MODEL_RESPONSE)
        svc = _make_svc_raw(raw_json)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert result.raw_model_output == raw_json

    def test_context_site_id_passed_in_prompt(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        prompt = svc.generate_text.call_args.kwargs["prompt"]
        assert "SITE-042" in prompt

    def test_context_risk_score_passed_in_prompt(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        prompt = svc.generate_text.call_args.kwargs["prompt"]
        assert "78.4" in prompt

    def test_temperature_is_low(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        temp = svc.generate_text.call_args.kwargs["temperature"]
        assert temp <= 0.5

    def test_svc_called_exactly_once(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        svc.generate_text.assert_called_once()

    def test_markdown_fenced_response_handled(self):
        fenced = f"```json\n{json.dumps(_VALID_MODEL_RESPONSE)}\n```"
        svc = _make_svc_raw(fenced)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert isinstance(result, RiskExplanation)
        assert len(result.explanation) > 0

    def test_to_dict_shape(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        d = result.to_dict()
        assert set(d.keys()) == {"explanation", "key_findings", "recommended_focus"}

    def test_to_dict_raw_output_not_exposed(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        d = result.to_dict()
        assert "raw_model_output" not in d


# ---------------------------------------------------------------------------
# 6. RiskExplainer — error handling
# ---------------------------------------------------------------------------


class TestRiskExplainerErrors:
    def test_non_json_response_raises_parse_error(self):
        svc = _make_svc_raw("I cannot explain this site.")
        with pytest.raises(RiskExplainerParseError):
            RiskExplainer(svc).explain(_SAMPLE_CONTEXT)

    def test_malformed_json_raises_parse_error(self):
        svc = _make_svc_raw("{explanation: missing quotes}")
        with pytest.raises(RiskExplainerParseError):
            RiskExplainer(svc).explain(_SAMPLE_CONTEXT)

    def test_watsonx_api_error_propagates(self):
        from src.ai.watsonx_service import WatsonxAPIError
        svc = MagicMock()
        svc.generate_text.side_effect = WatsonxAPIError("IBM API unavailable")
        with pytest.raises(WatsonxAPIError):
            RiskExplainer(svc).explain(_SAMPLE_CONTEXT)


# ---------------------------------------------------------------------------
# 7. DeviationSummary.to_dict()
# ---------------------------------------------------------------------------


class TestDeviationSummaryToDict:
    def test_all_fields_present(self):
        d = _SAMPLE_DEVIATION.to_dict()
        expected = {
            "deviation_id", "rule_id", "category", "severity",
            "description", "visit", "affected_patients", "occurrence_count",
        }
        assert set(d.keys()) == expected

    def test_values_correct(self):
        d = _SAMPLE_DEVIATION.to_dict()
        assert d["deviation_id"] == "DEV-101"
        assert d["severity"] == "major"
        assert d["affected_patients"] == 3


# ---------------------------------------------------------------------------
# 8. SiteRiskContext.to_dict()
# ---------------------------------------------------------------------------


class TestSiteRiskContextToDict:
    def test_all_top_level_fields_present(self):
        d = _SAMPLE_CONTEXT.to_dict()
        expected = {
            "site_id", "site_name", "risk_score", "risk_level",
            "total_patients", "observation_period_days",
            "protocol_title", "deviations",
        }
        assert set(d.keys()) == expected

    def test_deviations_serialised(self):
        d = _SAMPLE_CONTEXT.to_dict()
        assert isinstance(d["deviations"], list)
        assert len(d["deviations"]) == 1
        assert d["deviations"][0]["deviation_id"] == "DEV-101"

    def test_risk_score_value(self):
        d = _SAMPLE_CONTEXT.to_dict()
        assert d["risk_score"] == 78.4


# ---------------------------------------------------------------------------
# 9. RiskExplainer — partial/degraded model responses still return usable result
# ---------------------------------------------------------------------------


class TestDegradedModelResponses:
    def test_missing_key_findings_still_returns_explanation(self):
        partial = {
            "explanation": "Site has high risk.",
            "recommended_focus": "Review dosing procedures.",
            # key_findings missing entirely
        }
        svc = _make_svc(partial)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert result.explanation == "Site has high risk."
        assert result.key_findings == []

    def test_missing_recommended_focus_gets_fallback(self):
        partial = {
            "explanation": "Some explanation.",
            "key_findings": ["Finding 1"],
            # recommended_focus missing
        }
        svc = _make_svc(partial)
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert len(result.recommended_focus) > 0

    def test_all_fields_missing_still_returns_fallbacks(self):
        svc = _make_svc({})
        result = RiskExplainer(svc).explain(_SAMPLE_CONTEXT)
        assert isinstance(result, RiskExplanation)
        assert len(result.explanation) > 0
        assert len(result.recommended_focus) > 0
