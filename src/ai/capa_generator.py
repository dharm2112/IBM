"""
src/ai/capa_generator.py
─────────────────────────
Uses IBM watsonx.ai to draft a Corrective and Preventive Action (CAPA)
document for a confirmed clinical trial protocol deviation.

Architecture constraint
───────────────────────
The deterministic rule engine (Member 1) has already:
  • detected the deviation
  • assigned its severity (minor / major / critical)
  • identified the violated protocol rule

This module receives those confirmed facts and asks watsonx.ai to produce a
*draft* CAPA document.  The draft MUST:
  • be clearly marked as a draft requiring human review
  • stay within the facts provided — no invented details
  • follow the standard CAPA section structure

The AI MUST NOT:
  • re-classify deviation severity
  • decide whether a deviation occurred
  • guarantee regulatory compliance
  • remove the human-review requirement

The generated CAPA is a starting point for a clinical operations professional,
not a final regulatory submission.

Usage
─────
    from src.ai.watsonx_service import WatsonxService
    from src.ai.capa_generator import CapaGenerator, DeviationDetail

    svc       = WatsonxService()
    generator = CapaGenerator(svc)

    deviation = DeviationDetail(
        deviation_id="DEV-101",
        rule_id="RULE-003",
        category="dosing",
        severity="major",
        description="Subject received 15 mg instead of the required 10 mg on Day 7",
        protocol_requirement="Subjects must receive 10 mg orally once daily.",
        site_id="SITE-042",
        site_name="Metro General Hospital",
        affected_patients=3,
        occurrence_count=3,
        visit="Visit 3",
        detection_date="2024-03-15",
        protocol_title="Phase II Study of Drug A in Adults",
    )

    result = generator.generate(deviation)
    print(result.root_cause_analysis)
    print(result.immediate_actions)
    print(result.preventive_actions)
    print(result.timeline)
    print(result.full_draft)            # formatted plain-text CAPA document

FastAPI integration example
───────────────────────────
    @app.post("/ai/generate-capa")
    async def generate_capa(
        body: DeviationDetailRequest,
        svc: WatsonxService = Depends(get_watsonx),
    ):
        generator = CapaGenerator(svc)
        result = generator.generate(body.to_deviation_detail())
        return result.to_dict()
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from src.ai.watsonx_service import WatsonxService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------


class CapaGeneratorError(Exception):
    """Raised when CAPA generation fails unrecoverably (e.g. invalid input)."""


class CapaParseError(CapaGeneratorError):
    """Raised when the model response cannot be parsed into expected structure."""


# ---------------------------------------------------------------------------
# Input model — confirmed deviation facts from the rule engine
# ---------------------------------------------------------------------------

# Valid severity values as assigned by the rule engine
_VALID_SEVERITIES: frozenset[str] = frozenset({"minor", "major", "critical"})

# Valid deviation categories (mirrors protocol_extractor categories)
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


@dataclass
class DeviationDetail:
    """
    A fully confirmed protocol deviation, as produced by the rule engine.

    All fields are FACTS already determined deterministically.
    The AI receives these read-only and must not alter them.

    Required fields
    ───────────────
    deviation_id         : Unique identifier for this deviation record.
    rule_id              : The protocol rule that was violated.
    category             : Deviation category (dosing, lab, visit_window, …).
    severity             : minor | major | critical — assigned by rule engine.
    description          : What happened (factual, one sentence).
    protocol_requirement : The exact protocol requirement that was violated.
    site_id              : The site where this occurred.

    Optional enrichment fields
    ──────────────────────────
    site_name            : Human-readable site name.
    affected_patients    : Count of distinct patients affected.
    occurrence_count     : Total number of occurrences at this site.
    visit                : Visit name/number where deviation occurred.
    detection_date       : ISO date string when deviation was detected.
    protocol_title       : Name of the clinical trial protocol.
    additional_context   : Any free-text context the rule engine attaches.
    """

    deviation_id: str
    rule_id: str
    category: str
    severity: str                        # minor | major | critical
    description: str
    protocol_requirement: str
    site_id: str
    site_name: str = ""
    affected_patients: int = 0
    occurrence_count: int = 0
    visit: str = ""
    detection_date: str = ""
    protocol_title: str = ""
    additional_context: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "deviation_id": self.deviation_id,
            "rule_id": self.rule_id,
            "category": self.category,
            "severity": self.severity,
            "description": self.description,
            "protocol_requirement": self.protocol_requirement,
            "site_id": self.site_id,
            "site_name": self.site_name,
            "affected_patients": self.affected_patients,
            "occurrence_count": self.occurrence_count,
            "visit": self.visit,
            "detection_date": self.detection_date,
            "protocol_title": self.protocol_title,
            "additional_context": self.additional_context,
        }


# ---------------------------------------------------------------------------
# Output model — the drafted CAPA document
# ---------------------------------------------------------------------------

# Standard CAPA section keys the prompt instructs the model to return
_REQUIRED_SECTIONS: frozenset[str] = frozenset(
    {
        "root_cause_analysis",
        "immediate_actions",
        "preventive_actions",
        "timeline",
    }
)


@dataclass
class CapaDraft:
    """
    AI-generated draft CAPA document.

    All sections are clearly labelled as drafts.  A clinical operations
    professional must review and approve before regulatory submission.

    root_cause_analysis  : Probable root cause(s) based on deviation facts.
    immediate_actions    : Steps to take right now to address the deviation.
    preventive_actions   : Process changes to prevent recurrence.
    timeline             : Suggested completion dates for each action (relative,
                           e.g. "within 7 days", "within 30 days").
    effectiveness_check  : How to verify the CAPA worked (optional — fallback
                           if model omits it).
    full_draft           : Complete formatted plain-text CAPA document assembled
                           from the sections above.
    warnings             : Any issues detected during parsing/validation.
    raw_model_output     : Verbatim model text for audit.
    """

    root_cause_analysis: str
    immediate_actions: list[str]
    preventive_actions: list[str]
    timeline: list[str]
    effectiveness_check: str = ""
    full_draft: str = ""
    warnings: list[str] = field(default_factory=list)
    raw_model_output: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "root_cause_analysis": self.root_cause_analysis,
            "immediate_actions": self.immediate_actions,
            "preventive_actions": self.preventive_actions,
            "timeline": self.timeline,
            "effectiveness_check": self.effectiveness_check,
            "full_draft": self.full_draft,
            "warnings": self.warnings,
        }


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTIONS = """\
You are a clinical trial quality assurance specialist. Your task is to draft a \
Corrective and Preventive Action (CAPA) document for a confirmed protocol deviation.

STRICT RULES YOU MUST FOLLOW:
1. Base all content ENTIRELY on the deviation data provided. Do not invent \
   patients, events, or facts not present in the input.
2. The deviation severity ({severity}) has been assigned by a validated \
   deterministic rule engine. Do NOT change or reinterpret it.
3. This is a DRAFT document. It must be reviewed and approved by a clinical \
   operations professional before any regulatory submission.
4. Write at a professional clinical quality assurance level — precise, \
   actionable, regulatory-aware.
5. Return ONLY a valid JSON object. No markdown fences, no text outside the JSON.

REQUIRED JSON RESPONSE SCHEMA:
{{
  "root_cause_analysis": "<1-2 sentences: probable root cause(s) based on the \
deviation facts>",
  "immediate_actions": [
    "<action 1 — specific, assignable, time-bound>",
    "<action 2>",
    ...
  ],
  "preventive_actions": [
    "<systemic process change 1 to prevent recurrence>",
    "<systemic process change 2>",
    ...
  ],
  "timeline": [
    "<immediate_action_1>: within <N> days",
    "<preventive_action_1>: within <N> days",
    ...
  ],
  "effectiveness_check": "<how to verify this CAPA was effective — metric or \
observable outcome>"
}}

GUIDANCE FOR root_cause_analysis:
  - Focus on the most likely process, training, or communication failure.
  - Do not speculate beyond what the deviation data supports.
  - Reference the specific deviation category and protocol requirement.

GUIDANCE FOR immediate_actions:
  - List 2–4 specific steps. Each must be actionable today or this week.
  - Examples: notify principal investigator, review affected patient records,
    re-train site staff on specific protocol section, quarantine affected samples.

GUIDANCE FOR preventive_actions:
  - List 2–4 systemic changes. Each must address the root cause.
  - Examples: update SOPs, add verification checklist, schedule protocol
    re-training, implement double-check procedure at relevant visit.

GUIDANCE FOR timeline:
  - Pair each action with a realistic deadline (relative days from detection).
  - Immediate actions: 1–14 days. Preventive actions: 14–90 days.

GUIDANCE FOR effectiveness_check:
  - One sentence describing a measurable outcome that confirms the CAPA worked.
  - Example: "Zero recurrence of this deviation category in the next 3 monitoring visits."
"""


def _build_prompt(deviation: DeviationDetail) -> str:
    """Embed the deviation data JSON inside the filled system instructions."""
    instructions = _SYSTEM_INSTRUCTIONS.format(severity=deviation.severity.upper())
    deviation_json = json.dumps(deviation.to_dict(), indent=2)
    return (
        f"{instructions}\n\n"
        "=== DEVIATION DATA BEGIN ===\n"
        f"{deviation_json}\n"
        "=== DEVIATION DATA END ===\n\n"
        "Draft the CAPA document as a JSON object:"
    )


# ---------------------------------------------------------------------------
# Output parser / validator
# ---------------------------------------------------------------------------


def _extract_json_object(raw: str) -> dict[str, Any]:
    """
    Pull a JSON object from the model's raw output.
    Strips markdown fences and leading prose defensively.
    Raises CapaParseError on missing or malformed JSON.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise CapaParseError(
            f"Model response does not contain a JSON object. "
            f"First 200 chars: {text[:200]!r}"
        )

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise CapaParseError(
            f"Model response contains malformed JSON: {exc}"
        ) from exc


def _coerce_str_list(value: Any, field_name: str, warnings: list[str]) -> list[str]:
    """
    Ensure *value* is a list of non-empty strings.
    Coerces a plain string into a single-element list.
    Appends to *warnings* on type mismatch.
    """
    if isinstance(value, str) and value.strip():
        warnings.append(
            f"'{field_name}' was a string instead of a list — wrapped in a list."
        )
        return [value.strip()]
    if not isinstance(value, list):
        warnings.append(
            f"'{field_name}' expected list, got {type(value).__name__} — coerced to []."
        )
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _validate_and_assemble(
    raw_obj: dict[str, Any], deviation: DeviationDetail
) -> tuple[CapaDraft, list[str]]:
    """
    Validate and coerce the parsed JSON into a CapaDraft.
    Missing required sections get safe fallback values — never raises.
    Returns (CapaDraft, warnings).
    """
    warnings: list[str] = []

    root_cause = str(raw_obj.get("root_cause_analysis", "")).strip()
    if not root_cause:
        warnings.append("'root_cause_analysis' was empty; using fallback.")
        root_cause = (
            f"Root cause analysis pending human review for deviation "
            f"{deviation.deviation_id} ({deviation.category}, {deviation.severity})."
        )

    immediate_actions = _coerce_str_list(
        raw_obj.get("immediate_actions", []), "immediate_actions", warnings
    )
    if not immediate_actions:
        warnings.append("No immediate_actions returned; using fallback.")
        immediate_actions = [
            f"Notify Principal Investigator of {deviation.severity} deviation "
            f"{deviation.deviation_id}.",
            "Review affected patient records and document findings.",
        ]

    preventive_actions = _coerce_str_list(
        raw_obj.get("preventive_actions", []), "preventive_actions", warnings
    )
    if not preventive_actions:
        warnings.append("No preventive_actions returned; using fallback.")
        preventive_actions = [
            f"Re-train site staff on protocol section covering {deviation.category}.",
            "Implement verification checklist for affected procedures.",
        ]

    timeline = _coerce_str_list(
        raw_obj.get("timeline", []), "timeline", warnings
    )
    if not timeline:
        warnings.append("No timeline returned; using fallback.")
        timeline = [
            "Immediate actions: within 7 days of detection.",
            "Preventive actions: within 30 days of detection.",
        ]

    effectiveness_check = str(raw_obj.get("effectiveness_check", "")).strip()
    if not effectiveness_check:
        warnings.append("'effectiveness_check' was empty; using fallback.")
        effectiveness_check = (
            "Zero recurrence of this deviation category in the next "
            "3 consecutive monitoring visits."
        )

    full_draft = _format_full_draft(
        deviation=deviation,
        root_cause=root_cause,
        immediate_actions=immediate_actions,
        preventive_actions=preventive_actions,
        timeline=timeline,
        effectiveness_check=effectiveness_check,
    )

    return (
        CapaDraft(
            root_cause_analysis=root_cause,
            immediate_actions=immediate_actions,
            preventive_actions=preventive_actions,
            timeline=timeline,
            effectiveness_check=effectiveness_check,
            full_draft=full_draft,
            warnings=warnings,
        ),
        warnings,
    )


def _format_full_draft(
    *,
    deviation: DeviationDetail,
    root_cause: str,
    immediate_actions: list[str],
    preventive_actions: list[str],
    timeline: list[str],
    effectiveness_check: str,
) -> str:
    """Assemble a readable plain-text CAPA document from the parsed sections."""
    site_line = deviation.site_name or deviation.site_id
    visit_line = f" at {deviation.visit}" if deviation.visit else ""
    date_line = f"  Detection Date : {deviation.detection_date}\n" if deviation.detection_date else ""
    protocol_line = f"  Protocol       : {deviation.protocol_title}\n" if deviation.protocol_title else ""

    immediate_bullets = "\n".join(f"  • {a}" for a in immediate_actions)
    preventive_bullets = "\n".join(f"  • {a}" for a in preventive_actions)
    timeline_bullets = "\n".join(f"  • {t}" for t in timeline)

    return (
        "╔══════════════════════════════════════════════════════════════╗\n"
        "║          CORRECTIVE AND PREVENTIVE ACTION (CAPA)            ║\n"
        "║                    *** DRAFT — REQUIRES HUMAN REVIEW ***    ║\n"
        "╚══════════════════════════════════════════════════════════════╝\n\n"
        f"DEVIATION REFERENCE\n"
        f"  Deviation ID   : {deviation.deviation_id}\n"
        f"  Rule ID        : {deviation.rule_id}\n"
        f"  Category       : {deviation.category}\n"
        f"  Severity       : {deviation.severity.upper()}\n"
        f"  Site           : {site_line}\n"
        f"  Visit          : {deviation.visit or 'N/A'}\n"
        f"{date_line}"
        f"{protocol_line}"
        f"\n"
        f"DEVIATION DESCRIPTION\n"
        f"  {deviation.description}\n\n"
        f"PROTOCOL REQUIREMENT VIOLATED\n"
        f"  {deviation.protocol_requirement}\n\n"
        f"PATIENTS AFFECTED\n"
        f"  {deviation.affected_patients} patient(s), "
        f"{deviation.occurrence_count} occurrence(s){visit_line}\n\n"
        f"ROOT CAUSE ANALYSIS\n"
        f"  {root_cause}\n\n"
        f"IMMEDIATE CORRECTIVE ACTIONS\n"
        f"{immediate_bullets}\n\n"
        f"PREVENTIVE ACTIONS\n"
        f"{preventive_bullets}\n\n"
        f"IMPLEMENTATION TIMELINE\n"
        f"{timeline_bullets}\n\n"
        f"EFFECTIVENESS CHECK\n"
        f"  {effectiveness_check}\n\n"
        f"─────────────────────────────────────────────────────────────\n"
        f"STATUS: DRAFT — Awaiting review and approval by qualified\n"
        f"        clinical operations personnel before submission.\n"
    )


# ---------------------------------------------------------------------------
# CapaGenerator
# ---------------------------------------------------------------------------


class CapaGenerator:
    """
    Drafts a CAPA document for a confirmed clinical trial protocol deviation
    using IBM watsonx.ai via WatsonxService.

    The generated document is a structured starting point.  A clinical
    operations professional must review, amend, and approve it before any
    regulatory submission.

    Parameters
    ──────────
    svc : WatsonxService
        Shared watsonx.ai service instance (injected for testability).
    max_new_tokens : int
        Token budget for the model response (default 1024).
    temperature : float
        Low temperature keeps output factual and action-oriented (default 0.2).
    """

    def __init__(
        self,
        svc: WatsonxService,
        *,
        max_new_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> None:
        self._svc = svc
        self._max_new_tokens = max_new_tokens
        self._temperature = temperature

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(self, deviation: DeviationDetail) -> CapaDraft:
        """
        Generate a draft CAPA for *deviation*.

        Parameters
        ──────────
        deviation : DeviationDetail
            Confirmed deviation facts from the rule engine.

        Returns
        ───────
        CapaDraft with structured sections and assembled full_draft text.

        Raises
        ──────
        CapaGeneratorError  : Deviation input is invalid.
        CapaParseError      : Model returned un-parseable JSON.
        WatsonxAPIError     : IBM API call failed (propagated).
        """
        self._validate_deviation(deviation)

        logger.info(
            "CapaGenerator.generate | deviation=%s | category=%s | severity=%s | site=%s",
            deviation.deviation_id,
            deviation.category,
            deviation.severity,
            deviation.site_id,
        )

        prompt = _build_prompt(deviation)

        generation = self._svc.generate_text(
            prompt=prompt,
            max_new_tokens=self._max_new_tokens,
            temperature=self._temperature,
            top_p=0.95,
            top_k=20,              # tighter pool — CAPA language should be precise
            repetition_penalty=1.1,
        )

        raw_output = generation.generated_text
        logger.debug(
            "CapaGenerator.generate | raw_output_chars=%d | stop_reason=%s",
            len(raw_output),
            generation.stop_reason,
        )

        raw_obj = _extract_json_object(raw_output)
        draft, warnings = _validate_and_assemble(raw_obj, deviation)
        draft.raw_model_output = raw_output

        if warnings:
            logger.warning(
                "CapaGenerator: %d validation warning(s) | deviation=%s",
                len(warnings),
                deviation.deviation_id,
            )

        logger.info(
            "CapaGenerator.generate complete | deviation=%s | immediate_actions=%d | "
            "preventive_actions=%d",
            deviation.deviation_id,
            len(draft.immediate_actions),
            len(draft.preventive_actions),
        )

        return draft

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_deviation(deviation: DeviationDetail) -> None:
        """Raise CapaGeneratorError if the deviation input is unusable."""
        if not deviation.deviation_id or not deviation.deviation_id.strip():
            raise CapaGeneratorError("DeviationDetail.deviation_id must not be empty.")
        if not deviation.site_id or not deviation.site_id.strip():
            raise CapaGeneratorError("DeviationDetail.site_id must not be empty.")
        if not deviation.description or not deviation.description.strip():
            raise CapaGeneratorError("DeviationDetail.description must not be empty.")
        if not deviation.protocol_requirement or not deviation.protocol_requirement.strip():
            raise CapaGeneratorError(
                "DeviationDetail.protocol_requirement must not be empty."
            )
        if deviation.severity.lower() not in _VALID_SEVERITIES:
            raise CapaGeneratorError(
                f"DeviationDetail.severity must be one of "
                f"{sorted(_VALID_SEVERITIES)}, got {deviation.severity!r}."
            )
        if deviation.category.lower() not in _VALID_CATEGORIES:
            raise CapaGeneratorError(
                f"DeviationDetail.category must be one of "
                f"{sorted(_VALID_CATEGORIES)}, got {deviation.category!r}."
            )
