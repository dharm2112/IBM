"""
src/backend/routers/engine_routes.py
──────────────────────────────────────
Endpoint for executing the Member 1 deterministic pipeline.

POST /run-engine
    1. Generates a DatasetBundle via the data generator.
    2. Runs TrialGuardRuleEngine.evaluate() to detect deviations.
    3. Runs score_all_sites() to produce deterministic SiteRiskScores.
    4. Persists EngineRun + DetectedDeviations + SiteRiskScores to the DB.
    5. Returns RunEngineResponse with per-site risk scores and a deviation sample.

Architecture contract
──────────────────────
The site_risk_scores in the response contain the exact risk_score and
risk_level values computed by the deterministic engine.  These values are
what the /ai/explain-risk and /ai/generate-capa endpoints expect as input.
The AI layer NEVER recalculates or overwrites risk_score, risk_level, or
severity.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.backend.database import get_db
from src.backend.engine_service import run_engine_pipeline
from src.backend.schemas import RunEngineRequest, RunEngineResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Rule Engine Pipeline"])


@router.post(
    "/run-engine",
    response_model=RunEngineResponse,
    summary="Execute the deterministic rule engine pipeline",
    description=(
        "Generates a synthetic clinical trial dataset, runs the TrialGuard "
        "deterministic rule engine to detect protocol deviations, computes "
        "site risk scores, and persists all results. "
        "The returned site_risk_scores contain the pre-computed risk_score and "
        "risk_level values that MUST be supplied verbatim to POST /ai/explain-risk. "
        "Deviation entries from deviation_sample MUST be supplied verbatim to "
        "POST /ai/generate-capa. The AI never calculates or modifies these values."
    ),
)
def run_engine(
    body: RunEngineRequest = RunEngineRequest(),
    db: Session = Depends(get_db),
) -> RunEngineResponse:
    """
    Execute the Member 1 → Member 2 integration pipeline.

    Returns a RunEngineResponse with per-site risk scores and a deviation sample.
    """
    logger.info(
        "POST /run-engine | sites=%d | patients_per_site=%d | seed=%d",
        body.num_sites,
        body.patients_per_site,
        body.random_seed,
    )

    try:
        result = run_engine_pipeline(
            db=db,
            num_sites=body.num_sites,
            patients_per_site=body.patients_per_site,
            random_seed=body.random_seed,
            protocol_id=body.protocol_id,
        )
    except Exception as exc:
        logger.error(
            "POST /run-engine FAILED | error=%s | type=%s",
            type(exc).__name__,
            str(exc)[:200],
        )
        raise HTTPException(
            status_code=500,
            detail=f"Engine pipeline failed: {type(exc).__name__}: {str(exc)[:300]}",
        ) from exc

    logger.info(
        "POST /run-engine complete | run_id=%s | deviations=%d | high_risk=%d",
        result.run_id,
        result.deviations_detected,
        result.high_risk_sites,
    )

    return RunEngineResponse(**result.to_dict())
