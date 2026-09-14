"""
src/ai/risk_explainer.py
─────────────────────────
Uses IBM watsonx.ai to generate natural-language explanations of why a
clinical trial site has an elevated risk score.

Architecture constraint
───────────────────────
The deterministic rule engine (Member 1) owns ALL numeric decisions:
  • risk score
  • deviation severity (minor / major / critical)
  • whether a protocol deviation occurred

This module receives those already-computed facts and asks watsonx.ai to
translate them into plain English for:
  • clinical operations reviewers
  • site monitors
  • regulatory submissions

The AI MUST NOT:
  • recalculate or override the risk score
  • change deviation severity labels
  • invent deviations not present in the input
  • speculate about patient safety outcomes

Usage
─────
    from src.ai.watsonx_service import WatsonxService
    from src.ai.risk_explainer import RiskExplainer, SiteRiskContext

    svc       = WatsonxService()
    explainer = RiskExplainer(svc)

    context = SiteRiskContext(
        site_id="SITE-042",
        site_name="Metro General Hospital",
        risk_score=78.4,
        risk_level="high",
        total_patients=24,
        deviations=[
            DeviationSummary(
                deviation_id="DEV-101",
                rule_id="RULE-003",
                category="dosing",
                severity="major",
                description="Subject received 15 mg instead of 10 mg on Day 7",
                visit="Visit 3",
                affected_patients=3,
                occurrence_count=3,
            ),
        ],
        protocol_title="Phase II Study of Drug A in Adults",
        observation_period_days=90,
    )

    result = explainer.explain(context)
    print(result.explanation)          # plain-English paragraph(s)
    print(result.key_findings)         # list of bullet-point strings
    print(result.recommended_focus)    # short string — what to review first

FastAPI integration example
───────────────────────────
    @app.post("/ai/explain-risk")
    async def explain_risk(
        body: SiteRiskRequest,
        svc: WatsonxService = Depends(get_watsonx),
    ):
        explainer = RiskExplainer(svc)
        result = explainer.explain(body.to_context())
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


class RiskExplainerError(Exception):
    """Raised when risk explanation fails unrecoverably."""


class RiskExplainerParseError(RiskExplainerError):
    """Raised when the model response cannot be parsed into expected structure."""


# ---------------------------------------------------------------------------
# Input model — facts from the deterministic rule engine
# ---------------------------------------------------------------------------


@dataclass
class DeviationSummary:
    """
    A single deviation detected by the rule engine.

    All fields here are FACTS already determined deterministically.
    The AI receives these read-only and must not alter them.
    """

    deviation_id: str
    rule_id: str
    category: str                    # dosing | visit_window | lab | etc.
    severity: str                    # minor | major | critical  (set by rule engine)
    description: str                 # what the deviation was
    visit: str = ""                  # which visit it occurred at
    affected_patients: int = 0       # number of distinct patients
    occurrence_count: int = 0        # total occurrences at this site

    def to_dict(self) -> dict[str, Any]:
        return {
            "deviation_id": self.deviation_id,
            "rule_id": self.rule_id,
            "category": self.category,
            "severity": self.severity,
            "description": self.description,
            "visit": self.visit,
            "affected_patients": self.affected_patients,
            "occurrence_count": self.occurrence_count,
        }


@dataclass
class SiteRiskContext:
    """
    All factual context the AI needs to write a risk explanation.

    risk_score and risk_level come directly from the deterministic engine.
    The AI must reference them verbatim — it must NOT recompute them.
    """

    site_id: str
    risk_score: float                # 0–100, computed by rule engine
    risk_level: str                  # low | medium | high | critical
    total_patients: int
    deviations: list[DeviationSummary]
    site_name: str = ""
    protocol_title: str = ""
    observation_period_days: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "site_id": self.site_id,
            "site_name": self.site_name,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "total_patients": self.total_patients,
            "observation_period_days": self.observation_period_days,
            "protocol_title": self.protocol_title,
            "deviations": [d.to_dict() for d in self.deviations],
        }


# ---------------------------------------------------------------------------
# Output model
# ---------------------------------------------------------------------------


@dataclass
class RiskExplanation:
    """
    Structured natural-language output from the AI.

    explanation       : 1–3 paragraph plain-English summary suitable for a
                        clinical operations reviewer or regulatory document.
    key_findings      : Ordered list of bullet-point strings, most important first.
    recommended_focus : One sentence — the single highest-priority area to
                        investigate (derived from the deviation pattern).
    raw_model_output  : Preserved verbatim for audit.
    """

    explanation: str
    key_findings: list[str]
    recommended_focus: str
    raw_model_output: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "explanation": self.explanation,
            "key_findings": self.key_findings,
            "recommended_focus": self.recommended_focus,
        }


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTIONS = """\
You are a clinical trial risk analyst. Your task is to read structured data \
about a clinical trial site's protocol deviations and write a clear, accurate, \
professional explanation of why the site has elevated risk.

STRICT RULES YOU MUST FOLLOW:
1. Base your explanation ENTIRELY on the data provided. Do not invent deviations, \
   patients, or events not present in the input.
2. The risk_score and risk_level have already been calculated by a validated \
   deterministic system. You MUST report them as given — do NOT recalculate, \
   adjust, or question them.
3. The severity label (minor / major / critical) on each deviation was assigned \
   by the rule engine. Report it as given — do NOT upgrade, downgrade, or \
   reinterpret severity.
4. Do NOT speculate about patient harm, trial outcomes, or regulatory consequences \
   beyond what the data shows.
5. Write at a professional clinical operations level — clear, factual, concise.
6. Return ONLY a valid JSON object. No markdown fences, no extra text outside JSON.

REQUIRED JSON RESPONSE SCHEMA:
{
  "explanation": "<1-3 paragraphs of plain-English risk explanation>",
  "key_findings": ["<finding 1>", "<finding 2>", ...],
  "recommended_focus": "<one sentence — the single most important area to investigate>"
}

GUIDANCE FOR explanation:
  - Open with the site identifier, risk level, and risk score.
  - Summarise the deviation pattern (categories, severities, volume).
  - Note any repeated or cross-visit patterns if present.
  - Close with what this means for monitoring priority.

GUIDANCE FOR key_findings:
  - List 2–5 bullet points, most critical first.
  - Each bullet should be one concise sentence referencing specific deviation data.
  - Do not repeat the same point twice.

GUIDANCE FOR recommended_focus:
  - Name the single deviation category or pattern most warranting immediate attention.
  - One sentence only.
"""


def _build_prompt(context: SiteRiskContext) -> str:
    """Serialise the SiteRiskContext to JSON and embed it in the prompt."""
    context_json = json.dumps(context.to_dict(), indent=2)
    return (
        f"{_SYSTEM_INSTRUCTIONS}\n\n"
        "=== SITE RISK DATA BEGIN ===\n"
        f"{context_json}\n"
        "=== SITE RISK DATA END ===\n\n"
        "Write the risk explanation as a JSON object:"
    )


# ---------------------------------------------------------------------------
# Output parser / validator
# ---------------------------------------------------------------------------


def _extract_json_object(raw: str) -> dict[str, Any]:
    """
    Pull a JSON object out of the model's raw text output.

    Defensively strips markdown fences and leading prose before parsing.
    Raises RiskExplainerParseError on malformed / missing JSON.
    """
    text = raw.strip()

    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Find the outermost JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise RiskExplainerParseError(
            f"Model response does not contain a JSON object. "
            f"First 200 chars: {text[:200]!r}"
        )

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise RiskExplainerParseError(
            f"Model response contains malformed JSON: {exc}"
        ) from exc


def _validate_response(raw_obj: dict[str, Any]) -> tuple[RiskExplanation, list[str]]:
    """
    Validate and coerce the parsed JSON object into a RiskExplanation.

    Returns (RiskExplanation, warnings).  Never returns None — missing fields
    are filled with safe fallback strings so the caller always gets a usable result.
    """
    warnings: list[str] = []

    explanation = str(raw_obj.get("explanation", "")).strip()
    if not explanation:
        warnings.append("Model returned empty 'explanation' field; using fallback.")
        explanation = "No explanation was generated. Please review the site data manually."

    key_findings_raw = raw_obj.get("key_findings", [])
    if not isinstance(key_findings_raw, list):
        warnings.append(
            f"'key_findings' expected list, got {type(key_findings_raw).__name__}; coerced to []."
        )
        key_findings_raw = []
    key_findings = [str(f).strip() for f in key_findings_raw if str(f).strip()]
    if not key_findings:
        warnings.append("Model returned no key_findings entries.")

    recommended_focus = str(raw_obj.get("recommended_focus", "")).strip()
    if not recommended_focus:
        warnings.append("Model returned empty 'recommended_focus'; using fallback.")
        recommended_focus = "Review all deviations flagged as major or critical."

    return (
        RiskExplanation(
            explanation=explanation,
            key_findings=key_findings,
            recommended_focus=recommended_focus,
        ),
        warnings,
    )


# ---------------------------------------------------------------------------
# RiskExplainer
# ---------------------------------------------------------------------------


class RiskExplainer:
    """
    Generates natural-language risk explanations for clinical trial sites
    using IBM watsonx.ai via WatsonxService.

    The AI receives pre-computed facts from the deterministic rule engine and
    produces human-readable narrative.  It never overrides numeric scores or
    severity labels.

    Parameters
    ──────────
    svc : WatsonxService
        Shared watsonx.ai service instance (injected for testability).
    max_new_tokens : int
        Token budget for the model response (default 1024).
    temperature : float
        Low temperature keeps output factual and consistent (default 0.3).
        Slightly higher than protocol_extractor because fluent prose benefits
        from a small amount of variation.
    """

    def __init__(
        self,
        svc: WatsonxService,
        *,
        max_new_tokens: int = 1024,
        temperature: float = 0.3,
    ) -> None:
        self._svc = svc
        self._max_new_tokens = max_new_tokens
        self._temperature = temperature

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def explain(self, context: SiteRiskContext) -> RiskExplanation:
        """
        Generate a natural-language risk explanation for *context*.

        Parameters
        ──────────
        context : SiteRiskContext
            Factual site data produced by the deterministic rule engine.

        Returns
        ───────
        RiskExplanation with .explanation, .key_findings, .recommended_focus.

        Raises
        ──────
        RiskExplainerError      : context is invalid.
        RiskExplainerParseError : Model returned un-parseable JSON.
        WatsonxAPIError         : IBM API call failed (propagated).
        """
        self._validate_context(context)

        logger.info(
            "RiskExplainer.explain | site=%s | risk_score=%.1f | risk_level=%s | deviations=%d",
            context.site_id,
            context.risk_score,
            context.risk_level,
            len(context.deviations),
        )

        prompt = _build_prompt(context)

        generation = self._svc.generate_text(
            prompt=prompt,
            max_new_tokens=self._max_new_tokens,
            temperature=self._temperature,
            top_p=0.95,
            top_k=40,
            repetition_penalty=1.1,
        )

        raw_output = generation.generated_text
        logger.debug(
            "RiskExplainer.explain | raw_output_chars=%d | stop_reason=%s",
            len(raw_output),
            generation.stop_reason,
        )

        raw_obj = _extract_json_object(raw_output)
        explanation, warnings = _validate_response(raw_obj)
        explanation.raw_model_output = raw_output

        if warnings:
            logger.warning(
                "RiskExplainer: %d validation warning(s) | site=%s",
                len(warnings),
                context.site_id,
            )
            for w in warnings:
                logger.warning("  RiskExplainer warning: %s", w)

        logger.info(
            "RiskExplainer.explain complete | site=%s | key_findings=%d",
            context.site_id,
            len(explanation.key_findings),
        )

        return explanation

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_context(context: SiteRiskContext) -> None:
        """Raise RiskExplainerError if the context is unusable."""
        if not context.site_id or not context.site_id.strip():
            raise RiskExplainerError("SiteRiskContext.site_id must not be empty.")
        if not (0.0 <= context.risk_score <= 100.0):
            raise RiskExplainerError(
                f"risk_score must be in [0, 100], got {context.risk_score}."
            )
        valid_levels = {"low", "medium", "high", "critical"}
        if context.risk_level.lower() not in valid_levels:
            raise RiskExplainerError(
                f"risk_level must be one of {sorted(valid_levels)}, "
                f"got {context.risk_level!r}."
            )
