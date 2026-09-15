"""
src/ai/protocol_extractor.py
─────────────────────────────
Uses IBM watsonx.ai to extract structured protocol rules from clinical trial
protocol text (e.g. sourced from AACT / ClinicalTrials.gov or a study PDF).

Architecture constraint
───────────────────────
The AI extracts and DESCRIBES rules it finds verbatim in the protocol.
It does NOT:
  • decide whether a deviation occurred
  • assign final severity to any deviation
  • calculate site risk scores
  • invent requirements not present in the source text

Every extracted rule carries  status = "pending"  and must be reviewed and
approved by a human before the deterministic rule engine (Member 1) may use it.

Usage
─────
    from src.ai.watsonx_service import WatsonxService
    from src.ai.protocol_extractor import ProtocolExtractor

    svc = WatsonxService()                      # reads env vars
    extractor = ProtocolExtractor(svc)

    result = extractor.extract(protocol_text)   # plain string from PDF / DB
    for rule in result.rules:
        print(rule.rule_id, rule.category, rule.description)

    # Rules with validation warnings
    for w in result.warnings:
        print(w)

FastAPI integration example
───────────────────────────
    @app.post("/ai/extract-protocol")
    async def extract_protocol(
        body: ProtocolTextRequest,
        svc: WatsonxService = Depends(get_watsonx),
    ):
        extractor = ProtocolExtractor(svc)
        result = extractor.extract(body.text)
        return result
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from src.ai.watsonx_service import WatsonxService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------


class ProtocolExtractionError(Exception):
    """Raised when extraction fails unrecoverably (e.g. empty protocol text)."""


class ProtocolParseError(ProtocolExtractionError):
    """Raised when the model response cannot be parsed as valid JSON."""


# ---------------------------------------------------------------------------
# Domain model — one extracted rule
# ---------------------------------------------------------------------------

# Fields that MUST be present for a rule to be accepted
_REQUIRED_FIELDS: frozenset[str] = frozenset(
    {"rule_id", "category", "description", "status"}
)

# All recognised fields (others are silently ignored)
_ALL_FIELDS: frozenset[str] = frozenset(
    {
        "rule_id",
        "category",
        "description",
        "condition",
        "expected_value",
        "allowed_range",
        "unit",
        "visit",
        "severity_hint",
        "source_text",
        "confidence",
        "status",
    }
)

# Valid category values the prompt instructs the model to use
_VALID_CATEGORIES: frozenset[str] = frozenset(
    {
        "dosing",
        "visit_window",
        "lab",
        "eligibility",
        "medication",
        "procedure",
        "safety",
        "other",
    }
)

# Valid confidence values
_VALID_CONFIDENCE: frozenset[str] = frozenset({"high", "medium", "low"})


@dataclass
class ExtractedRule:
    """
    A single protocol rule extracted by the AI.

    status is ALWAYS "pending" — the rule is not active until a human
    approves it and it is loaded into the deterministic rule engine.
    """

    rule_id: str
    category: str
    description: str
    status: str = "pending"               # immutable by design
    condition: str = ""
    expected_value: str = ""
    allowed_range: str = ""
    unit: str = ""
    visit: str = ""
    severity_hint: str = ""               # informational only — NOT final severity
    source_text: str = ""
    confidence: str = "medium"
    # Raw dict preserved for audit / debugging
    _raw: dict[str, Any] = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "category": self.category,
            "description": self.description,
            "status": self.status,
            "condition": self.condition,
            "expected_value": self.expected_value,
            "allowed_range": self.allowed_range,
            "unit": self.unit,
            "visit": self.visit,
            "severity_hint": self.severity_hint,
            "source_text": self.source_text,
            "confidence": self.confidence,
        }


@dataclass
class ExtractionResult:
    """Return value of ProtocolExtractor.extract()."""

    rules: list[ExtractedRule] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    raw_model_output: str = ""
    rule_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_count": self.rule_count,
            "rules": [r.to_dict() for r in self.rules],
            "warnings": self.warnings,
        }


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTIONS = """\
You are a clinical trial protocol analyst. Your job is to read a clinical trial \
protocol document and extract every concrete, measurable rule or requirement \
that could be checked against patient data.

STRICT RULES YOU MUST FOLLOW:
1. Extract ONLY information that is explicitly stated in the protocol text provided.
2. NEVER invent, infer, or assume requirements that are not present in the text.
3. Preserve exact numeric values, ranges, units, and timeframes exactly as written.
4. If a value is ambiguous or unclear, set confidence to "low" and note the \
   ambiguity in source_text.
5. Do NOT decide whether a deviation is major, minor, or critical — that is \
   determined by a separate deterministic engine.
6. Do NOT calculate risk scores or site risk.
7. Return ONLY a valid JSON array. Do not include any explanation, commentary, \
   markdown fences, or text outside the JSON array.

CATEGORIES you must assign (choose exactly one per rule):
  dosing         — drug dose, route, frequency, timing
  visit_window   — allowed visit timing windows
  lab            — laboratory test requirements or acceptable ranges
  eligibility    — inclusion/exclusion criteria
  medication     — concomitant medication restrictions
  procedure      — required clinical procedures
  safety         — safety monitoring, stopping rules, adverse event reporting
  other          — anything that does not fit the above

CONFIDENCE values:
  high   — exact numeric value/range stated explicitly in the text
  medium — requirement is clear but some interpretation was needed
  low    — text is ambiguous; human review especially important

REQUIRED JSON SCHEMA — return an array of objects, each with these keys:
  rule_id        : string  — unique identifier, format "RULE-001", "RULE-002", …
  category       : string  — one of the categories listed above
  description    : string  — one-sentence description of the requirement
  condition      : string  — when/where this rule applies (leave "" if global)
  expected_value : string  — the required value (leave "" if a range is used)
  allowed_range  : string  — e.g. "80–120%" or "±3 days" (leave "" if not applicable)
  unit           : string  — measurement unit (leave "" if not applicable)
  visit          : string  — visit name/number this rule applies to ("" = all visits)
  severity_hint  : string  — word from the protocol describing importance, \
e.g. "must", "required", "critical", "should" — copy the protocol's own language; \
do NOT add your own severity judgment
  source_text    : string  — verbatim sentence(s) from the protocol that support \
this rule (max 200 characters)
  confidence     : string  — "high", "medium", or "low"
  status         : string  — ALWAYS set to "pending"
"""


def _build_prompt(protocol_text: str) -> str:
    """Combine system instructions with the protocol text into a single prompt."""
    return (
        f"{_SYSTEM_INSTRUCTIONS}\n\n"
        "=== PROTOCOL TEXT BEGIN ===\n"
        f"{protocol_text.strip()}\n"
        "=== PROTOCOL TEXT END ===\n\n"
        "Extract all protocol rules as a JSON array:"
    )


# ---------------------------------------------------------------------------
# Output parser / validator
# ---------------------------------------------------------------------------


def _extract_json_array(raw: str) -> list[dict]:
    """
    Pull a JSON array out of the model's raw text output.

    The model is instructed to return only JSON, but it may occasionally
    include markdown fences or a short preamble.  We strip those defensively.

    Raises ProtocolParseError on malformed / missing JSON.
    """
    text = raw.strip()

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Find the outermost JSON array
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1 or end <= start:
        raise ProtocolParseError(
            f"Model response does not contain a JSON array. "
            f"First 200 chars: {text[:200]!r}"
        )

    candidate = text[start : end + 1]

    # First attempt: parse as-is
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Second attempt: fix trailing commas before ] or }
    fixed = re.sub(r',\s*([\]}])', r'\1', candidate)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Third attempt: replace literal unescaped newlines inside strings
    # (model sometimes emits multi-line string values without escaping)
    fixed2 = re.sub(r'(?<!\\)\n', r'\\n', fixed)
    fixed2 = re.sub(r'(?<!\\)\r', '', fixed2)
    try:
        return json.loads(fixed2)
    except json.JSONDecodeError as exc:
        logger.error(
            "_extract_json_array: all parse attempts failed. "
            "Raw candidate (first 400 chars): %r",
            candidate[:400],
        )
        raise ProtocolParseError(
            f"Model response contains malformed JSON: {exc}"
        ) from exc


def _validate_and_coerce(
    raw_rule: dict[str, Any],
    index: int,
) -> tuple[ExtractedRule | None, list[str]]:
    """
    Validate a single raw rule dict and return (ExtractedRule, warnings).

    Returns (None, warnings) if the rule is missing required fields and
    cannot be salvaged.
    """
    warnings: list[str] = []

    if not isinstance(raw_rule, dict):
        warnings.append(f"Rule[{index}] is not a JSON object — skipped.")
        return None, warnings

    # Check required fields
    missing = _REQUIRED_FIELDS - raw_rule.keys()
    if missing:
        warnings.append(
            f"Rule[{index}] missing required field(s) {sorted(missing)} — skipped."
        )
        return None, warnings

    # Always override status to "pending" regardless of what the model returned
    raw_rule["status"] = "pending"

    # Ensure rule_id is a non-empty string; generate one if blank
    rule_id = str(raw_rule.get("rule_id", "")).strip()
    if not rule_id:
        rule_id = f"RULE-{str(uuid.uuid4())[:8].upper()}"
        warnings.append(
            f"Rule[{index}] had empty rule_id — assigned generated id {rule_id!r}."
        )

    # Normalise category
    category = str(raw_rule.get("category", "other")).strip().lower()
    if category not in _VALID_CATEGORIES:
        warnings.append(
            f"Rule[{index}] ({rule_id}): unknown category {category!r} — "
            f"coerced to 'other'."
        )
        category = "other"

    # Normalise confidence
    confidence = str(raw_rule.get("confidence", "medium")).strip().lower()
    if confidence not in _VALID_CONFIDENCE:
        warnings.append(
            f"Rule[{index}] ({rule_id}): unknown confidence {confidence!r} — "
            f"coerced to 'medium'."
        )
        confidence = "medium"

    rule = ExtractedRule(
        rule_id=rule_id,
        category=category,
        description=str(raw_rule.get("description", "")).strip(),
        status="pending",
        condition=str(raw_rule.get("condition", "")).strip(),
        expected_value=str(raw_rule.get("expected_value", "")).strip(),
        allowed_range=str(raw_rule.get("allowed_range", "")).strip(),
        unit=str(raw_rule.get("unit", "")).strip(),
        visit=str(raw_rule.get("visit", "")).strip(),
        severity_hint=str(raw_rule.get("severity_hint", "")).strip(),
        source_text=str(raw_rule.get("source_text", "")).strip(),
        confidence=confidence,
        _raw=raw_rule,
    )
    return rule, warnings


# ---------------------------------------------------------------------------
# ProtocolExtractor
# ---------------------------------------------------------------------------


class ProtocolExtractor:
    """
    Extracts structured protocol rules from clinical trial protocol text
    using IBM watsonx.ai via WatsonxService.

    Every extracted rule is assigned status="pending" and requires human
    review before being loaded into the deterministic rule engine.

    Parameters
    ──────────
    svc : WatsonxService
        The shared watsonx.ai service instance.  Injected so that callers
        (FastAPI, tests) control the service lifecycle.
    max_new_tokens : int
        Token budget for the model response.  Large protocols may need 2048+.
    temperature : float
        Low temperature (default 0.1) keeps output deterministic / factual.
    """

    def __init__(
        self,
        svc: WatsonxService,
        *,
        max_new_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> None:
        self._svc = svc
        self._max_new_tokens = max_new_tokens
        self._temperature = temperature

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract(self, protocol_text: str) -> ExtractionResult:
        """
        Extract protocol rules from *protocol_text*.

        Parameters
        ──────────
        protocol_text : str
            Raw text of the clinical trial protocol (from PDF, AACT, etc.).

        Returns
        ───────
        ExtractionResult containing validated ExtractedRule objects and any
        warnings generated during parsing/validation.

        Raises
        ──────
        ProtocolExtractionError : Input text is empty.
        ProtocolParseError      : Model returned un-parseable JSON.
        WatsonxAPIError         : IBM API call failed (propagated from service).
        """
        if not protocol_text or not protocol_text.strip():
            raise ProtocolExtractionError("protocol_text must not be empty.")

        logger.info(
            "ProtocolExtractor.extract | text_chars=%d | max_new_tokens=%d",
            len(protocol_text),
            self._max_new_tokens,
        )

        prompt = _build_prompt(protocol_text)

        generation = self._svc.generate_text(
            prompt=prompt,
            max_new_tokens=self._max_new_tokens,
            temperature=self._temperature,
            top_p=0.95,
            top_k=1,               # near-greedy — we want factual extraction
            repetition_penalty=1.0, # Disable repetition penalty for mistral models
        )

        raw_output = generation.generated_text
        logger.debug(
            "ProtocolExtractor.extract | raw_output_chars=%d | stop_reason=%s",
            len(raw_output),
            generation.stop_reason,
        )

        raw_rules = _extract_json_array(raw_output)
        return self._validate_rules(raw_rules, raw_output)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_rules(
        self, raw_rules: list[Any], raw_output: str
    ) -> ExtractionResult:
        rules: list[ExtractedRule] = []
        all_warnings: list[str] = []

        for i, raw_rule in enumerate(raw_rules):
            rule, warnings = _validate_and_coerce(raw_rule, i)
            all_warnings.extend(warnings)
            if rule is not None:
                rules.append(rule)

        if all_warnings:
            logger.warning(
                "ProtocolExtractor: %d validation warning(s) during extraction.",
                len(all_warnings),
            )

        logger.info(
            "ProtocolExtractor.extract complete | accepted=%d | skipped=%d | warnings=%d",
            len(rules),
            len(raw_rules) - len(rules),
            len(all_warnings),
        )

        return ExtractionResult(
            rules=rules,
            warnings=all_warnings,
            raw_model_output=raw_output,
            rule_count=len(rules),
        )
