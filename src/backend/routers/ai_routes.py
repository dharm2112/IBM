"""
src/backend/routers/ai_routes.py
──────────────────────────────────
FastAPI router exposing the three IBM watsonx.ai endpoints.

Endpoints
─────────
POST /ai/extract-protocol  — calls ProtocolExtractor.extract()
POST /ai/explain-risk      — calls RiskExplainer.explain()
POST /ai/generate-capa     — calls CapaGenerator.generate()

Architecture invariants enforced here
──────────────────────────────────────
1. extract-protocol: Every rule returned has status="pending".
   The route does not approve any rule automatically.

2. explain-risk: risk_score and risk_level are taken verbatim from the
   request body (pre-computed by the deterministic rule engine).
   The route never calculates or modifies those values.

3. generate-capa: Response always carries
     "status": "draft"
     "human_review_required": True
   The route never auto-approves or closes a CAPA.

IBM credentials stay server-side — WatsonxService reads them from
environment variables.  Nothing from WatsonxConfig is serialised into
any response body.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from src.ai.capa_generator import CapaGenerator, DeviationDetail
from src.ai.protocol_extractor import ProtocolExtractor
from src.ai.risk_explainer import (
    DeviationSummary,
    RiskExplainer,
    SiteRiskContext,
)
from src.ai.watsonx_service import WatsonxService
from src.backend.dependencies import get_watsonx
from src.backend.schemas import (
    ExtractProtocolRequest,
    ExtractProtocolResponse,
    ExplainRiskRequest,
    ExplainRiskResponse,
    GenerateCapaRequest,
    GenerateCapaResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI — IBM watsonx.ai"])


# ---------------------------------------------------------------------------
# POST /ai/extract-protocol
# ---------------------------------------------------------------------------


@router.post(
    "/extract-protocol",
    response_model=ExtractProtocolResponse,
    summary="Extract protocol rules from clinical trial text",
    description=(
        "Uses IBM watsonx.ai to extract structured protocol rules from raw "
        "clinical trial protocol text. Every extracted rule is assigned "
        "status='pending' and MUST be reviewed and approved by a human before "
        "the deterministic rule engine may use it. The AI does NOT decide "
        "whether a deviation occurred, assign final severity, or calculate "
        "site risk scores."
    ),
)
def extract_protocol(
    body: ExtractProtocolRequest,
    svc: WatsonxService = Depends(get_watsonx),
) -> ExtractProtocolResponse:
    """
    Extract structured protocol rules from *body.protocol_text*.

    Returns an ExtractionResult with all rules at status='pending'.
    Extraction warnings are included for transparency.
    """
    logger.info(
        "POST /ai/extract-protocol | text_chars=%d", len(body.protocol_text)
    )

    extractor = ProtocolExtractor(svc)
    result = extractor.extract(body.protocol_text)

    # Defensive: ensure status="pending" on every rule regardless of AI output.
    # (ProtocolExtractor already enforces this, but we assert it at the
    #  boundary for belt-and-braces safety.)
    rules_out = result.to_dict()["rules"]
    for rule in rules_out:
        rule["status"] = "pending"

    logger.info(
        "POST /ai/extract-protocol complete | rules=%d | warnings=%d",
        result.rule_count,
        len(result.warnings),
    )

    return ExtractProtocolResponse(
        rule_count=result.rule_count,
        rules=rules_out,
        warnings=result.warnings,
    )


# ---------------------------------------------------------------------------
# POST /ai/explain-risk
# ---------------------------------------------------------------------------


@router.post(
    "/explain-risk",
    response_model=ExplainRiskResponse,
    summary="Generate natural-language explanation of site risk",
    description=(
        "Uses IBM watsonx.ai to generate a plain-English explanation of why a "
        "clinical trial site has an elevated risk score. The risk_score and "
        "risk_level in the request body MUST have been computed by the "
        "deterministic rule engine — this endpoint never recalculates or "
        "modifies them. The AI translates pre-computed facts into narrative "
        "for clinical operations reviewers."
    ),
)
def explain_risk(
    body: ExplainRiskRequest,
    svc: WatsonxService = Depends(get_watsonx),
) -> ExplainRiskResponse:
    """
    Generate a risk explanation for *body.site_id*.

    Accepts pre-computed risk_score and risk_level from the rule engine.
    Returns an explanation, key_findings, and recommended_focus.
    """
    logger.info(
        "POST /ai/explain-risk | site=%s | risk_score=%.1f | risk_level=%s | "
        "deviations=%d",
        body.site_id,
        body.risk_score,
        body.risk_level,
        len(body.deviations),
    )

    # Build the AI input context from the request (rule-engine facts)
    context = SiteRiskContext(
        site_id=body.site_id,
        site_name=body.site_name,
        risk_score=body.risk_score,       # verbatim from rule engine
        risk_level=body.risk_level,       # verbatim from rule engine
        total_patients=body.total_patients,
        deviations=[
            DeviationSummary(
                deviation_id=d.deviation_id,
                rule_id=d.rule_id,
                category=d.category,
                severity=d.severity,      # verbatim from rule engine
                description=d.description,
                visit=d.visit,
                affected_patients=d.affected_patients,
                occurrence_count=d.occurrence_count,
            )
            for d in body.deviations
        ],
        protocol_title=body.protocol_title,
        observation_period_days=body.observation_period_days,
    )

    explainer = RiskExplainer(svc)
    explanation = explainer.explain(context)

    logger.info(
        "POST /ai/explain-risk complete | site=%s | key_findings=%d",
        body.site_id,
        len(explanation.key_findings),
    )

    return ExplainRiskResponse(
        site_id=body.site_id,
        risk_score=body.risk_score,       # echo back unchanged
        risk_level=body.risk_level,       # echo back unchanged
        explanation=explanation.explanation,
        key_findings=explanation.key_findings,
        recommended_focus=explanation.recommended_focus,
    )


# ---------------------------------------------------------------------------
# POST /ai/generate-capa
# ---------------------------------------------------------------------------


@router.post(
    "/generate-capa",
    response_model=GenerateCapaResponse,
    summary="Draft a CAPA document for a confirmed protocol deviation",
    description=(
        "Uses IBM watsonx.ai to draft a Corrective and Preventive Action (CAPA) "
        "document for a deviation that has already been confirmed by the "
        "deterministic rule engine. The response is ALWAYS a draft requiring "
        "human review — it is never auto-approved or auto-closed. The AI does "
        "not re-classify severity or decide whether the deviation occurred."
    ),
)
def generate_capa(
    body: GenerateCapaRequest,
    svc: WatsonxService = Depends(get_watsonx),
) -> GenerateCapaResponse:
    """
    Draft a CAPA for the confirmed deviation described in *body*.

    Returns a structured CapaDraft with all sections populated.
    The response always carries status='draft' and human_review_required=True.
    """
    logger.info(
        "POST /ai/generate-capa | deviation=%s | category=%s | severity=%s | site=%s",
        body.deviation_id,
        body.category,
        body.severity,
        body.site_id,
    )

    deviation = DeviationDetail(
        deviation_id=body.deviation_id,
        rule_id=body.rule_id,
        category=body.category,
        severity=body.severity,           # verbatim from rule engine
        description=body.description,
        protocol_requirement=body.protocol_requirement,
        site_id=body.site_id,
        site_name=body.site_name,
        affected_patients=body.affected_patients,
        occurrence_count=body.occurrence_count,
        visit=body.visit,
        detection_date=body.detection_date,
        protocol_title=body.protocol_title,
        additional_context=body.additional_context,
    )

    generator = CapaGenerator(svc)
    draft = generator.generate(deviation)

    logger.info(
        "POST /ai/generate-capa complete | deviation=%s | immediate_actions=%d | "
        "preventive_actions=%d",
        body.deviation_id,
        len(draft.immediate_actions),
        len(draft.preventive_actions),
    )

    return GenerateCapaResponse(
        deviation_id=body.deviation_id,
        # status and human_review_required are always "draft" / True (schema default)
        root_cause_analysis=draft.root_cause_analysis,
        immediate_actions=draft.immediate_actions,
        preventive_actions=draft.preventive_actions,
        timeline=draft.timeline,
        effectiveness_check=draft.effectiveness_check,
        full_draft=draft.full_draft,
        warnings=draft.warnings,
    )
