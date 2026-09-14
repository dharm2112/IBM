"""
src/tests/ai/test_protocol_extractor.py
────────────────────────────────────────
Unit tests for src/ai/protocol_extractor.py.

WatsonxService is mocked throughout — no real IBM credentials are needed.

Run:
    pytest src/tests/ai/test_protocol_extractor.py -v
"""

from __future__ import annotations

import json
import logging
from unittest.mock import MagicMock

import pytest

from src.ai.protocol_extractor import (
    ExtractionResult,
    ExtractedRule,
    ProtocolExtractionError,
    ProtocolExtractor,
    ProtocolParseError,
    _build_prompt,
    _extract_json_array,
    _validate_and_coerce,
)
from src.ai.watsonx_service import GenerationResult

# ---------------------------------------------------------------------------
# Shared fixtures & helpers
# ---------------------------------------------------------------------------

_SAMPLE_PROTOCOL = """\
Subjects must receive Study Drug A at a dose of 10 mg orally once daily.
Dose reductions to 5 mg are permitted for Grade 2 toxicity.
Visit 2 must occur within 7 days (±3 days) of Day 14.
Haemoglobin must be ≥ 9.0 g/dL at screening.
Subjects must not take any CYP3A4 inhibitor within 14 days prior to first dose.
"""

_MINIMAL_VALID_RULE: dict = {
    "rule_id": "RULE-001",
    "category": "dosing",
    "description": "Subject must receive 10 mg orally once daily.",
    "condition": "",
    "expected_value": "10 mg",
    "allowed_range": "",
    "unit": "mg",
    "visit": "",
    "severity_hint": "must",
    "source_text": "Subjects must receive Study Drug A at a dose of 10 mg orally once daily.",
    "confidence": "high",
    "status": "pending",
}


def _make_svc(generated_text: str) -> MagicMock:
    """Return a mock WatsonxService that returns *generated_text*."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text=generated_text,
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=50,
        generated_token_count=100,
        stop_reason="eos_token",
    )
    return svc


def _json_response(rules: list[dict]) -> str:
    return json.dumps(rules)


# ---------------------------------------------------------------------------
# 1. Prompt builder
# ---------------------------------------------------------------------------


class TestBuildPrompt:
    def test_contains_protocol_text(self):
        prompt = _build_prompt("DOSE: 10 mg once daily.")
        assert "DOSE: 10 mg once daily." in prompt

    def test_contains_schema_instructions(self):
        prompt = _build_prompt("text")
        assert "rule_id" in prompt
        assert "category" in prompt
        assert "status" in prompt
        assert "confidence" in prompt

    def test_instructs_pending_status(self):
        prompt = _build_prompt("text")
        assert '"pending"' in prompt

    def test_prohibits_severity_assignment(self):
        prompt = _build_prompt("text")
        assert "NOT" in prompt
        # Ensure the model is told NOT to decide severity
        assert "severity" in prompt.lower()

    def test_instructs_never_invent(self):
        prompt = _build_prompt("text")
        assert "NEVER" in prompt

    def test_protocol_text_boundaries_present(self):
        prompt = _build_prompt("ABC")
        assert "=== PROTOCOL TEXT BEGIN ===" in prompt
        assert "=== PROTOCOL TEXT END ===" in prompt


# ---------------------------------------------------------------------------
# 2. JSON array extractor
# ---------------------------------------------------------------------------


class TestExtractJsonArray:
    def test_plain_json_array(self):
        raw = '[{"a": 1}]'
        result = _extract_json_array(raw)
        assert result == [{"a": 1}]

    def test_strips_markdown_fences(self):
        raw = "```json\n[{\"a\": 1}]\n```"
        result = _extract_json_array(raw)
        assert result == [{"a": 1}]

    def test_strips_plain_fences(self):
        raw = "```\n[{\"b\": 2}]\n```"
        result = _extract_json_array(raw)
        assert result == [{"b": 2}]

    def test_leading_text_trimmed(self):
        raw = "Here are the rules:\n[{\"x\": 9}]"
        result = _extract_json_array(raw)
        assert result == [{"x": 9}]

    def test_no_array_raises_parse_error(self):
        with pytest.raises(ProtocolParseError, match="does not contain a JSON array"):
            _extract_json_array("This is not JSON at all.")

    def test_malformed_json_raises_parse_error(self):
        with pytest.raises(ProtocolParseError, match="malformed JSON"):
            _extract_json_array("[{broken json}]")

    def test_empty_array_allowed(self):
        result = _extract_json_array("[]")
        assert result == []

    def test_multiple_rules(self):
        rules = [{"rule_id": "RULE-001"}, {"rule_id": "RULE-002"}]
        result = _extract_json_array(json.dumps(rules))
        assert len(result) == 2


# ---------------------------------------------------------------------------
# 3. Rule validator / coercer
# ---------------------------------------------------------------------------


class TestValidateAndCoerce:
    def test_valid_rule_accepted(self):
        rule, warnings = _validate_and_coerce(dict(_MINIMAL_VALID_RULE), 0)
        assert rule is not None
        assert rule.rule_id == "RULE-001"
        assert warnings == []

    def test_status_always_forced_to_pending(self):
        raw = dict(_MINIMAL_VALID_RULE)
        raw["status"] = "approved"          # model should not set this
        rule, _ = _validate_and_coerce(raw, 0)
        assert rule.status == "pending"

    def test_missing_rule_id_gets_generated(self):
        raw = dict(_MINIMAL_VALID_RULE)
        raw["rule_id"] = ""
        rule, warnings = _validate_and_coerce(raw, 0)
        assert rule is not None
        assert rule.rule_id.startswith("RULE-")
        assert any("assigned generated id" in w for w in warnings)

    def test_missing_required_field_returns_none(self):
        raw = {"rule_id": "RULE-001", "category": "dosing"}  # missing description
        rule, warnings = _validate_and_coerce(raw, 0)
        assert rule is None
        assert any("missing required field" in w for w in warnings)

    def test_unknown_category_coerced_to_other(self):
        raw = dict(_MINIMAL_VALID_RULE)
        raw["category"] = "exotic_category"
        rule, warnings = _validate_and_coerce(raw, 0)
        assert rule.category == "other"
        assert any("unknown category" in w for w in warnings)

    def test_unknown_confidence_coerced_to_medium(self):
        raw = dict(_MINIMAL_VALID_RULE)
        raw["confidence"] = "very_high"
        rule, warnings = _validate_and_coerce(raw, 0)
        assert rule.confidence == "medium"
        assert any("unknown confidence" in w for w in warnings)

    def test_non_dict_returns_none(self):
        rule, warnings = _validate_and_coerce("not a dict", 0)
        assert rule is None
        assert any("not a JSON object" in w for w in warnings)

    def test_all_valid_categories_accepted(self):
        from src.ai.protocol_extractor import _VALID_CATEGORIES
        for cat in _VALID_CATEGORIES:
            raw = dict(_MINIMAL_VALID_RULE)
            raw["category"] = cat
            rule, warnings = _validate_and_coerce(raw, 0)
            assert rule is not None
            assert not any("unknown category" in w for w in warnings)

    def test_all_valid_confidence_values_accepted(self):
        from src.ai.protocol_extractor import _VALID_CONFIDENCE
        for conf in _VALID_CONFIDENCE:
            raw = dict(_MINIMAL_VALID_RULE)
            raw["confidence"] = conf
            rule, _ = _validate_and_coerce(raw, 0)
            assert rule.confidence == conf


# ---------------------------------------------------------------------------
# 4. ProtocolExtractor — successful extraction
# ---------------------------------------------------------------------------


class TestProtocolExtractorSuccess:
    def test_returns_extraction_result(self):
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        extractor = ProtocolExtractor(svc)
        result = extractor.extract(_SAMPLE_PROTOCOL)
        assert isinstance(result, ExtractionResult)

    def test_single_rule_extracted(self):
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        extractor = ProtocolExtractor(svc)
        result = extractor.extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 1
        assert len(result.rules) == 1

    def test_multiple_rules_extracted(self):
        rules = [
            dict(_MINIMAL_VALID_RULE),
            {**_MINIMAL_VALID_RULE, "rule_id": "RULE-002", "category": "visit_window"},
            {**_MINIMAL_VALID_RULE, "rule_id": "RULE-003", "category": "lab"},
        ]
        svc = _make_svc(_json_response(rules))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 3

    def test_rule_fields_populated(self):
        rule_data = dict(_MINIMAL_VALID_RULE)
        svc = _make_svc(_json_response([rule_data]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        r = result.rules[0]
        assert r.rule_id == "RULE-001"
        assert r.category == "dosing"
        assert r.description == "Subject must receive 10 mg orally once daily."
        assert r.expected_value == "10 mg"
        assert r.unit == "mg"
        assert r.source_text != ""
        assert r.confidence == "high"

    def test_all_rules_have_status_pending(self):
        rules = [
            {**_MINIMAL_VALID_RULE, "rule_id": "RULE-001", "status": "approved"},
            {**_MINIMAL_VALID_RULE, "rule_id": "RULE-002", "status": "active"},
        ]
        svc = _make_svc(_json_response(rules))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert all(r.status == "pending" for r in result.rules)

    def test_prompt_passed_to_svc(self):
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        call_kwargs = svc.generate_text.call_args
        assert _SAMPLE_PROTOCOL.strip() in call_kwargs.kwargs["prompt"]

    def test_low_temperature_used(self):
        """Extraction should use near-deterministic temperature."""
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        temp = svc.generate_text.call_args.kwargs["temperature"]
        assert temp <= 0.2

    def test_empty_array_response_gives_zero_rules(self):
        svc = _make_svc("[]")
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 0
        assert result.rules == []

    def test_to_dict_shape(self):
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        d = result.to_dict()
        assert "rule_count" in d
        assert "rules" in d
        assert "warnings" in d
        assert d["rules"][0]["status"] == "pending"

    def test_raw_model_output_stored(self):
        raw_json = _json_response([_MINIMAL_VALID_RULE])
        svc = _make_svc(raw_json)
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.raw_model_output == raw_json

    def test_markdown_fenced_response_handled(self):
        fenced = f"```json\n{_json_response([_MINIMAL_VALID_RULE])}\n```"
        svc = _make_svc(fenced)
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 1


# ---------------------------------------------------------------------------
# 5. ProtocolExtractor — validation warnings
# ---------------------------------------------------------------------------


class TestProtocolExtractorWarnings:
    def test_bad_category_generates_warning(self):
        rule = {**_MINIMAL_VALID_RULE, "category": "unknown_cat"}
        svc = _make_svc(_json_response([rule]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert any("unknown category" in w for w in result.warnings)
        assert result.rule_count == 1   # rule still accepted after coercion

    def test_missing_required_field_generates_warning_and_skips_rule(self):
        bad_rule = {"rule_id": "RULE-X", "category": "dosing"}  # no description
        good_rule = dict(_MINIMAL_VALID_RULE)
        svc = _make_svc(_json_response([bad_rule, good_rule]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 1
        assert any("missing required field" in w for w in result.warnings)

    def test_all_invalid_rules_gives_zero_with_warnings(self):
        bad = {"rule_id": "X"}      # missing description, category
        svc = _make_svc(_json_response([bad]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert result.rule_count == 0
        assert len(result.warnings) > 0

    def test_empty_rule_id_triggers_warning(self):
        rule = {**_MINIMAL_VALID_RULE, "rule_id": ""}
        svc = _make_svc(_json_response([rule]))
        result = ProtocolExtractor(svc).extract(_SAMPLE_PROTOCOL)
        assert any("assigned generated id" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# 6. ProtocolExtractor — error handling
# ---------------------------------------------------------------------------


class TestProtocolExtractorErrors:
    def test_empty_text_raises_extraction_error(self):
        svc = _make_svc("")
        extractor = ProtocolExtractor(svc)
        with pytest.raises(ProtocolExtractionError, match="must not be empty"):
            extractor.extract("")

    def test_whitespace_only_text_raises_extraction_error(self):
        svc = _make_svc("")
        extractor = ProtocolExtractor(svc)
        with pytest.raises(ProtocolExtractionError):
            extractor.extract("   \n\t  ")

    def test_non_json_response_raises_parse_error(self):
        svc = _make_svc("I could not extract any rules from this text.")
        extractor = ProtocolExtractor(svc)
        with pytest.raises(ProtocolParseError):
            extractor.extract(_SAMPLE_PROTOCOL)

    def test_malformed_json_raises_parse_error(self):
        svc = _make_svc("[{rule_id: RULE-001}]")   # invalid JSON
        extractor = ProtocolExtractor(svc)
        with pytest.raises(ProtocolParseError):
            extractor.extract(_SAMPLE_PROTOCOL)

    def test_watsonx_api_error_propagates(self):
        from src.ai.watsonx_service import WatsonxAPIError
        svc = MagicMock()
        svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        extractor = ProtocolExtractor(svc)
        with pytest.raises(WatsonxAPIError):
            extractor.extract(_SAMPLE_PROTOCOL)

    def test_svc_called_exactly_once_per_extract(self):
        svc = _make_svc(_json_response([_MINIMAL_VALID_RULE]))
        extractor = ProtocolExtractor(svc)
        extractor.extract(_SAMPLE_PROTOCOL)
        svc.generate_text.assert_called_once()


# ---------------------------------------------------------------------------
# 7. ExtractedRule.to_dict()
# ---------------------------------------------------------------------------


class TestExtractedRuleToDict:
    def test_to_dict_contains_all_public_fields(self):
        rule = ExtractedRule(
            rule_id="RULE-001",
            category="dosing",
            description="10 mg daily",
            status="pending",
            confidence="high",
            source_text="Subjects must receive 10 mg.",
        )
        d = rule.to_dict()
        expected_keys = {
            "rule_id", "category", "description", "status",
            "condition", "expected_value", "allowed_range",
            "unit", "visit", "severity_hint", "source_text", "confidence",
        }
        assert set(d.keys()) == expected_keys

    def test_to_dict_status_is_pending(self):
        rule = ExtractedRule(rule_id="R", category="other", description="x")
        assert rule.to_dict()["status"] == "pending"

    def test_raw_field_not_in_to_dict(self):
        rule = ExtractedRule(rule_id="R", category="other", description="x")
        assert "_raw" not in rule.to_dict()
