"""
src/tests/ai/test_capa_generator.py
─────────────────────────────────────
Unit tests for src/ai/capa_generator.py.

WatsonxService is fully mocked — no real IBM credentials required.

Run:
    pytest src/tests/ai/test_capa_generator.py -v
"""

from __future__ import annotations

import json
import logging
from unittest.mock import MagicMock

import pytest

from src.ai.capa_generator import (
    CapaDraft,
    CapaGeneratorError,
    CapaGenerator,
    CapaParseError,
    DeviationDetail,
    _build_prompt,
    _extract_json_object,
    _validate_and_assemble,
    _coerce_str_list,
)
from src.ai.watsonx_service import GenerationResult

# ---------------------------------------------------------------------------
# Shared fixtures & helpers
# ---------------------------------------------------------------------------

_SAMPLE_DEVIATION = DeviationDetail(
    deviation_id="DEV-101",
    rule_id="RULE-003",
    category="dosing",
    severity="major",
    description="Subject received 15 mg instead of the required 10 mg on Day 7",
    protocol_requirement="Subjects must receive Study Drug A at 10 mg orally once daily.",
    site_id="SITE-042",
    site_name="Metro General Hospital",
    affected_patients=3,
    occurrence_count=3,
    visit="Visit 3",
    detection_date="2024-03-15",
    protocol_title="Phase II Study of Drug A in Adults",
)

_VALID_MODEL_RESPONSE: dict = {
    "root_cause_analysis": (
        "The dosing deviation likely resulted from inadequate staff training on "
        "protocol-specific dose requirements following an amendment. The discrepancy "
        "between the administered dose (15 mg) and the required dose (10 mg) indicates "
        "a systematic dispensing process failure at Visit 3."
    ),
    "immediate_actions": [
        "Notify the Principal Investigator and Sponsor immediately about DEV-101.",
        "Review medical records for all 3 affected patients and document findings.",
        "Quarantine remaining drug supply at Visit 3 dosing station pending review.",
        "Conduct urgent re-training for all site staff on Section 5.2 of the protocol.",
    ],
    "preventive_actions": [
        "Update the site SOP to include a double-check verification step before dispensing.",
        "Implement a protocol-specific dose checklist at each dispensing station.",
        "Schedule mandatory quarterly protocol compliance training for all site staff.",
    ],
    "timeline": [
        "PI notification: within 24 hours of detection.",
        "Patient record review: within 3 days.",
        "Staff re-training: within 7 days.",
        "SOP update: within 30 days.",
        "Dose checklist implementation: within 14 days.",
    ],
    "effectiveness_check": (
        "Zero recurrence of dosing deviations in the next 3 consecutive monitoring "
        "visits, confirmed by independent data review."
    ),
}


def _make_svc(response_obj: dict) -> MagicMock:
    """Return a mock WatsonxService returning the dict as JSON text."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text=json.dumps(response_obj),
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=100,
        generated_token_count=250,
        stop_reason="eos_token",
    )
    return svc


def _make_svc_raw(text: str) -> MagicMock:
    """Return a mock WatsonxService returning raw text verbatim."""
    svc = MagicMock()
    svc.generate_text.return_value = GenerationResult(
        generated_text=text,
        model_id="ibm/granite-13b-instruct-v2",
        input_token_count=100,
        generated_token_count=50,
        stop_reason="eos_token",
    )
    return svc


# ---------------------------------------------------------------------------
# 1. Prompt builder
# ---------------------------------------------------------------------------


class TestBuildPrompt:
    def test_contains_deviation_id(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "DEV-101" in prompt

    def test_contains_severity(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "major" in prompt.lower()

    def test_contains_description(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "15 mg instead of the required 10 mg" in prompt

    def test_contains_protocol_requirement(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "10 mg orally once daily" in prompt

    def test_contains_site_id(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "SITE-042" in prompt

    def test_contains_required_output_sections(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        for section in (
            "root_cause_analysis",
            "immediate_actions",
            "preventive_actions",
            "timeline",
            "effectiveness_check",
        ):
            assert section in prompt

    def test_severity_in_instructions(self):
        """Prompt must reference the severity so model knows not to change it."""
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "MAJOR" in prompt or "major" in prompt.lower()

    def test_draft_disclaimer_in_instructions(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "DRAFT" in prompt or "draft" in prompt.lower()

    def test_prohibits_inventing_data(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "invent" in prompt.lower() or "do not" in prompt.lower()

    def test_data_boundaries_present(self):
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "=== DEVIATION DATA BEGIN ===" in prompt
        assert "=== DEVIATION DATA END ===" in prompt

    def test_severity_format_placeholder_filled(self):
        """The {severity} placeholder must be substituted, not left as literal."""
        prompt = _build_prompt(_SAMPLE_DEVIATION)
        assert "{severity}" not in prompt


# ---------------------------------------------------------------------------
# 2. JSON object extractor
# ---------------------------------------------------------------------------


class TestExtractJsonObject:
    def test_plain_json_object(self):
        raw = '{"root_cause_analysis": "test"}'
        result = _extract_json_object(raw)
        assert result["root_cause_analysis"] == "test"

    def test_strips_markdown_fences(self):
        raw = '```json\n{"a": 1}\n```'
        result = _extract_json_object(raw)
        assert result == {"a": 1}

    def test_strips_plain_fences(self):
        raw = '```\n{"b": 2}\n```'
        result = _extract_json_object(raw)
        assert result == {"b": 2}

    def test_leading_prose_trimmed(self):
        raw = 'Here is the CAPA:\n{"x": 9}'
        result = _extract_json_object(raw)
        assert result == {"x": 9}

    def test_no_object_raises_capa_parse_error(self):
        with pytest.raises(CapaParseError, match="does not contain a JSON object"):
            _extract_json_object("Plain text, no JSON.")

    def test_malformed_json_raises_capa_parse_error(self):
        with pytest.raises(CapaParseError, match="malformed JSON"):
            _extract_json_object("{broken: json}")

    def test_empty_string_raises_parse_error(self):
        with pytest.raises(CapaParseError):
            _extract_json_object("")


# ---------------------------------------------------------------------------
# 3. _coerce_str_list helper
# ---------------------------------------------------------------------------


class TestCoerceStrList:
    def test_valid_list_returned_unchanged(self):
        warnings: list[str] = []
        result = _coerce_str_list(["a", "b"], "field", warnings)
        assert result == ["a", "b"]
        assert warnings == []

    def test_string_wrapped_in_list(self):
        warnings: list[str] = []
        result = _coerce_str_list("single item", "field", warnings)
        assert result == ["single item"]
        assert any("wrapped in a list" in w for w in warnings)

    def test_non_list_non_string_coerced_to_empty(self):
        warnings: list[str] = []
        result = _coerce_str_list(42, "field", warnings)
        assert result == []
        assert any("coerced to []" in w for w in warnings)

    def test_blank_entries_stripped(self):
        warnings: list[str] = []
        result = _coerce_str_list(["valid", "  ", ""], "field", warnings)
        assert result == ["valid"]

    def test_none_coerced_to_empty(self):
        warnings: list[str] = []
        result = _coerce_str_list(None, "field", warnings)
        assert result == []


# ---------------------------------------------------------------------------
# 4. Validate and assemble
# ---------------------------------------------------------------------------


class TestValidateAndAssemble:
    def test_valid_response_accepted(self):
        draft, warnings = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert isinstance(draft, CapaDraft)
        assert warnings == []

    def test_all_sections_populated(self):
        draft, _ = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert len(draft.root_cause_analysis) > 0
        assert len(draft.immediate_actions) > 0
        assert len(draft.preventive_actions) > 0
        assert len(draft.timeline) > 0
        assert len(draft.effectiveness_check) > 0

    def test_full_draft_generated(self):
        draft, _ = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert len(draft.full_draft) > 0

    def test_full_draft_contains_deviation_id(self):
        draft, _ = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert "DEV-101" in draft.full_draft

    def test_full_draft_contains_draft_label(self):
        draft, _ = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert "DRAFT" in draft.full_draft

    def test_full_draft_contains_severity(self):
        draft, _ = _validate_and_assemble(
            dict(_VALID_MODEL_RESPONSE), _SAMPLE_DEVIATION
        )
        assert "MAJOR" in draft.full_draft

    def test_empty_root_cause_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "root_cause_analysis": ""}
        draft, warnings = _validate_and_assemble(raw, _SAMPLE_DEVIATION)
        assert "pending human review" in draft.root_cause_analysis
        assert any("root_cause_analysis" in w for w in warnings)

    def test_empty_immediate_actions_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "immediate_actions": []}
        draft, warnings = _validate_and_assemble(raw, _SAMPLE_DEVIATION)
        assert len(draft.immediate_actions) > 0
        assert any("immediate_actions" in w for w in warnings)

    def test_empty_preventive_actions_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "preventive_actions": []}
        draft, warnings = _validate_and_assemble(raw, _SAMPLE_DEVIATION)
        assert len(draft.preventive_actions) > 0
        assert any("preventive_actions" in w for w in warnings)

    def test_empty_timeline_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "timeline": []}
        draft, warnings = _validate_and_assemble(raw, _SAMPLE_DEVIATION)
        assert len(draft.timeline) > 0
        assert any("timeline" in w for w in warnings)

    def test_empty_effectiveness_check_gets_fallback(self):
        raw = {**_VALID_MODEL_RESPONSE, "effectiveness_check": ""}
        draft, warnings = _validate_and_assemble(raw, _SAMPLE_DEVIATION)
        assert len(draft.effectiveness_check) > 0
        assert any("effectiveness_check" in w for w in warnings)

    def test_completely_empty_response_all_fallbacks(self):
        draft, warnings = _validate_and_assemble({}, _SAMPLE_DEVIATION)
        assert isinstance(draft, CapaDraft)
        assert len(draft.root_cause_analysis) > 0
        assert len(draft.immediate_actions) > 0
        assert len(draft.preventive_actions) > 0
        assert len(draft.timeline) > 0
        assert len(draft.effectiveness_check) > 0
        assert len(warnings) >= 4


# ---------------------------------------------------------------------------
# 5. DeviationDetail input validation
# ---------------------------------------------------------------------------


class TestDeviationDetailValidation:
    def test_empty_deviation_id_raises(self):
        dev = DeviationDetail(
            deviation_id="", rule_id="R", category="dosing", severity="major",
            description="desc", protocol_requirement="req", site_id="S"
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="deviation_id must not be empty"):
            CapaGenerator(svc).generate(dev)

    def test_empty_site_id_raises(self):
        dev = DeviationDetail(
            deviation_id="DEV-1", rule_id="R", category="dosing", severity="major",
            description="desc", protocol_requirement="req", site_id=""
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="site_id must not be empty"):
            CapaGenerator(svc).generate(dev)

    def test_empty_description_raises(self):
        dev = DeviationDetail(
            deviation_id="DEV-1", rule_id="R", category="dosing", severity="major",
            description="", protocol_requirement="req", site_id="S"
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="description must not be empty"):
            CapaGenerator(svc).generate(dev)

    def test_empty_protocol_requirement_raises(self):
        dev = DeviationDetail(
            deviation_id="DEV-1", rule_id="R", category="dosing", severity="major",
            description="desc", protocol_requirement="", site_id="S"
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="protocol_requirement must not be empty"):
            CapaGenerator(svc).generate(dev)

    def test_invalid_severity_raises(self):
        dev = DeviationDetail(
            deviation_id="DEV-1", rule_id="R", category="dosing", severity="extreme",
            description="desc", protocol_requirement="req", site_id="S"
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="severity must be one of"):
            CapaGenerator(svc).generate(dev)

    def test_invalid_category_raises(self):
        dev = DeviationDetail(
            deviation_id="DEV-1", rule_id="R", category="unknown_cat", severity="major",
            description="desc", protocol_requirement="req", site_id="S"
        )
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        with pytest.raises(CapaGeneratorError, match="category must be one of"):
            CapaGenerator(svc).generate(dev)

    def test_all_valid_severities_accepted(self):
        for sev in ("minor", "major", "critical"):
            dev = DeviationDetail(
                deviation_id="DEV-1", rule_id="R", category="dosing", severity=sev,
                description="desc", protocol_requirement="req", site_id="S"
            )
            svc = _make_svc(_VALID_MODEL_RESPONSE)
            result = CapaGenerator(svc).generate(dev)
            assert isinstance(result, CapaDraft)

    def test_all_valid_categories_accepted(self):
        from src.ai.capa_generator import _VALID_CATEGORIES
        for cat in _VALID_CATEGORIES:
            dev = DeviationDetail(
                deviation_id="DEV-1", rule_id="R", category=cat, severity="minor",
                description="desc", protocol_requirement="req", site_id="S"
            )
            svc = _make_svc(_VALID_MODEL_RESPONSE)
            result = CapaGenerator(svc).generate(dev)
            assert isinstance(result, CapaDraft)


# ---------------------------------------------------------------------------
# 6. CapaGenerator — successful generation flow
# ---------------------------------------------------------------------------


class TestCapaGeneratorSuccess:
    def test_returns_capa_draft(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert isinstance(result, CapaDraft)

    def test_root_cause_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.root_cause_analysis) > 0

    def test_immediate_actions_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.immediate_actions) == 4

    def test_preventive_actions_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.preventive_actions) == 3

    def test_timeline_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.timeline) == 5

    def test_effectiveness_check_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.effectiveness_check) > 0

    def test_full_draft_populated(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert len(result.full_draft) > 100

    def test_full_draft_contains_key_elements(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert "DEV-101" in result.full_draft
        assert "SITE-042" in result.full_draft or "Metro General Hospital" in result.full_draft
        assert "DRAFT" in result.full_draft
        assert "MAJOR" in result.full_draft

    def test_raw_model_output_stored(self):
        raw_json = json.dumps(_VALID_MODEL_RESPONSE)
        svc = _make_svc_raw(raw_json)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert result.raw_model_output == raw_json

    def test_deviation_data_in_prompt(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        prompt = svc.generate_text.call_args.kwargs["prompt"]
        assert "DEV-101" in prompt
        assert "SITE-042" in prompt

    def test_low_temperature_used(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        temp = svc.generate_text.call_args.kwargs["temperature"]
        assert temp <= 0.3

    def test_svc_called_exactly_once(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        svc.generate_text.assert_called_once()

    def test_markdown_fenced_response_handled(self):
        fenced = f"```json\n{json.dumps(_VALID_MODEL_RESPONSE)}\n```"
        svc = _make_svc_raw(fenced)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert isinstance(result, CapaDraft)
        assert len(result.root_cause_analysis) > 0

    def test_to_dict_shape(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        d = result.to_dict()
        expected_keys = {
            "root_cause_analysis", "immediate_actions", "preventive_actions",
            "timeline", "effectiveness_check", "full_draft", "warnings",
        }
        assert set(d.keys()) == expected_keys

    def test_to_dict_raw_output_not_exposed(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert "raw_model_output" not in result.to_dict()


# ---------------------------------------------------------------------------
# 7. CapaGenerator — error handling
# ---------------------------------------------------------------------------


class TestCapaGeneratorErrors:
    def test_non_json_response_raises_parse_error(self):
        svc = _make_svc_raw("I cannot draft this CAPA.")
        with pytest.raises(CapaParseError):
            CapaGenerator(svc).generate(_SAMPLE_DEVIATION)

    def test_malformed_json_raises_parse_error(self):
        svc = _make_svc_raw("{root_cause: missing quotes}")
        with pytest.raises(CapaParseError):
            CapaGenerator(svc).generate(_SAMPLE_DEVIATION)

    def test_watsonx_api_error_propagates(self):
        from src.ai.watsonx_service import WatsonxAPIError
        svc = MagicMock()
        svc.generate_text.side_effect = WatsonxAPIError("IBM API down")
        with pytest.raises(WatsonxAPIError):
            CapaGenerator(svc).generate(_SAMPLE_DEVIATION)


# ---------------------------------------------------------------------------
# 8. DeviationDetail.to_dict()
# ---------------------------------------------------------------------------


class TestDeviationDetailToDict:
    def test_all_fields_present(self):
        d = _SAMPLE_DEVIATION.to_dict()
        expected = {
            "deviation_id", "rule_id", "category", "severity", "description",
            "protocol_requirement", "site_id", "site_name", "affected_patients",
            "occurrence_count", "visit", "detection_date", "protocol_title",
            "additional_context",
        }
        assert set(d.keys()) == expected

    def test_values_correct(self):
        d = _SAMPLE_DEVIATION.to_dict()
        assert d["deviation_id"] == "DEV-101"
        assert d["severity"] == "major"
        assert d["site_id"] == "SITE-042"
        assert d["affected_patients"] == 3


# ---------------------------------------------------------------------------
# 9. Full draft format
# ---------------------------------------------------------------------------


class TestFullDraftFormat:
    def test_draft_contains_all_section_headers(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        for header in (
            "DEVIATION REFERENCE",
            "DEVIATION DESCRIPTION",
            "PROTOCOL REQUIREMENT VIOLATED",
            "PATIENTS AFFECTED",
            "ROOT CAUSE ANALYSIS",
            "IMMEDIATE CORRECTIVE ACTIONS",
            "PREVENTIVE ACTIONS",
            "IMPLEMENTATION TIMELINE",
            "EFFECTIVENESS CHECK",
        ):
            assert header in result.full_draft, f"Missing header: {header}"

    def test_draft_contains_visit_info(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert "Visit 3" in result.full_draft

    def test_draft_contains_detection_date(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert "2024-03-15" in result.full_draft

    def test_draft_contains_protocol_title(self):
        svc = _make_svc(_VALID_MODEL_RESPONSE)
        result = CapaGenerator(svc).generate(_SAMPLE_DEVIATION)
        assert "Phase II Study" in result.full_draft
