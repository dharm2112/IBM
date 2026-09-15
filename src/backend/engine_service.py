"""
src/backend/engine_service.py
──────────────────────────────
Orchestrates the Member 1 → Member 2 pipeline:

    DatasetBundle
        ↓  TrialGuardRuleEngine.evaluate()
    DetectedDeviation[]
        ↓  score_all_sites()
    SiteRiskScore[]
        ↓  persist to SQLite/Postgres
    EngineRunResult  ← returned to caller / HTTP response

This module is the ONLY integration glue between Member 1 and Member 2.
It does NOT re-implement any rule engine logic, risk scoring, or AI logic.
All Member 1 classes are imported and called as-is.

Architecture guarantees
────────────────────────
• severity on every DetectedDeviation comes from the rule engine only.
• risk_score and risk_level on every SiteRiskScore come from score_all_sites() only.
• This service writes those values to the database; the AI layer reads them.
• The AI layer NEVER updates severity, risk_score, or risk_level columns.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import asdict
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from src.data_generator import DatasetBundle, GeneratorConfig, generate_dataset
from src.rule_engine import TrialGuardRuleEngine, DetectedDeviation, SiteRiskScore, score_all_sites
from src.backend.db_models import DetectedDeviationRecord, EngineRun, SiteRiskScoreRecord

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclass (plain dict-serialisable, no ORM dependency)
# ---------------------------------------------------------------------------


class EngineRunResult:
    """
    Summary of a completed /run-engine execution.

    Designed to be directly JSON-serialisable for the HTTP response.
    """

    def __init__(
        self,
        run_id: str,
        started_at: str,
        completed_at: str,
        status: str,
        sites_count: int,
        patients_count: int,
        deviations_detected: int,
        sites_scored: int,
        high_risk_sites: int,
        site_risk_scores: List[dict],
        deviation_sample: List[dict],
        error_message: Optional[str] = None,
    ):
        self.run_id = run_id
        self.started_at = started_at
        self.completed_at = completed_at
        self.status = status
        self.sites_count = sites_count
        self.patients_count = patients_count
        self.deviations_detected = deviations_detected
        self.sites_scored = sites_scored
        self.high_risk_sites = high_risk_sites
        self.site_risk_scores = site_risk_scores
        self.deviation_sample = deviation_sample
        self.error_message = error_message

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "sites_count": self.sites_count,
            "patients_count": self.patients_count,
            "deviations_detected": self.deviations_detected,
            "sites_scored": self.sites_scored,
            "high_risk_sites": self.high_risk_sites,
            "site_risk_scores": self.site_risk_scores,
            "deviation_sample": self.deviation_sample,
            "error_message": self.error_message,
        }


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def run_engine_pipeline(
    db: Session,
    num_sites: int = 5,
    patients_per_site: int = 5,
    random_seed: int = 42,
) -> EngineRunResult:
    """
    Execute the full Member 1 pipeline and persist results.

    Steps
    ──────
    1. Generate a synthetic DatasetBundle (GeneratorConfig → generate_dataset).
    2. Run TrialGuardRuleEngine.evaluate() → DetectedDeviation[].
    3. Run score_all_sites() → SiteRiskScore[].
    4. Persist EngineRun + DetectedDeviationRecord + SiteRiskScoreRecord.
    5. Return EngineRunResult.

    Parameters
    ──────────
    db              : SQLAlchemy session (injected via Depends(get_db))
    num_sites       : sites to generate (default 5 for fast demo)
    patients_per_site: patients per site (default 5)
    random_seed     : RNG seed for reproducibility

    Returns
    ───────
    EngineRunResult with full summary and per-site risk scores.
    """
    run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
    started_at = datetime.utcnow()

    logger.info(
        "run_engine_pipeline start | run_id=%s | sites=%d | patients_per_site=%d",
        run_id,
        num_sites,
        patients_per_site,
    )

    # ── Create audit record ────────────────────────────────────────────────
    run_record = EngineRun(
        run_id=run_id,
        started_at=started_at,
        status="running",
    )
    db.add(run_record)
    db.commit()

    try:
        # ── Step 1: Generate dataset ───────────────────────────────────────
        config = GeneratorConfig(
            num_sites=num_sites,
            patients_per_site=patients_per_site,
            random_seed=random_seed,
        )
        # Pass scenarios_path=None so generate_dataset searches for the default
        # deviation_scenarios.json. If it is not found the injector is skipped
        # automatically — no fake path needed (and /dev/null doesn't exist on Windows).
        bundle: DatasetBundle = generate_dataset(config, scenarios_path=None)

        logger.info(
            "run_engine_pipeline | run_id=%s | dataset generated | summary=%s",
            run_id,
            bundle.summary(),
        )

        # ── Step 2: Rule engine evaluation ────────────────────────────────
        engine = TrialGuardRuleEngine()
        deviations: List[DetectedDeviation] = engine.evaluate(bundle)

        logger.info(
            "run_engine_pipeline | run_id=%s | deviations detected: %d",
            run_id,
            len(deviations),
        )

        # ── Step 3: Site risk scoring ──────────────────────────────────────
        # score_all_sites() is the SOLE source of risk_score and risk_level.
        risk_scores: List[SiteRiskScore] = score_all_sites(deviations)

        logger.info(
            "run_engine_pipeline | run_id=%s | sites scored: %d | high_risk: %d",
            run_id,
            len(risk_scores),
            sum(1 for s in risk_scores if s.risk_level == "HIGH"),
        )

        # ── Step 4: Persist DetectedDeviations ────────────────────────────
        for dev in deviations:
            record = DetectedDeviationRecord(
                run_id=run_id,
                deviation_id=dev.deviation_id,
                site_id=dev.site_id,
                patient_id=dev.patient_id,
                visit_id=dev.visit_id,
                rule_id=dev.rule_id,
                category=dev.category,
                description=dev.description,
                expected=str(dev.expected) if dev.expected is not None else None,
                actual=str(dev.actual) if dev.actual is not None else None,
                severity=dev.severity,      # verbatim from rule engine — NEVER overwritten by AI
                protocol_reference=json.dumps(dev.protocol_reference or {}),
                status=dev.status,
                detected_at=dev.detected_at,
                detected_by=dev.detected_by,
            )
            db.add(record)

        # ── Step 5: Persist SiteRiskScores ────────────────────────────────
        for score in risk_scores:
            # Serialise RiskComponent dict for storage
            components_dict = {
                k: asdict(v) if hasattr(v, "__dataclass_fields__") else v
                for k, v in (score.components or {}).items()
            }
            score_record = SiteRiskScoreRecord(
                run_id=run_id,
                site_id=score.site_id,
                risk_score=score.risk_score,     # verbatim from score_all_sites()
                risk_level=score.risk_level,     # verbatim from score_all_sites()
                total_deviations=score.total_deviations,
                major_count=score.major_count,
                minor_count=score.minor_count,
                administrative_count=score.administrative_count,
                unique_rules_violated=score.unique_rules_violated,
                dosing_rule_violations=score.dosing_rule_violations,
                missed_safety_visits=score.missed_safety_visits,
                top_risk_drivers=json.dumps(score.top_risk_drivers or []),
                components=json.dumps(components_dict),
            )
            db.add(score_record)

        # ── Step 6: Update run record ──────────────────────────────────────
        completed_at = datetime.utcnow()
        run_record.completed_at = completed_at
        run_record.status = "completed"
        run_record.sites_count = len(bundle.sites)
        run_record.patients_count = len(bundle.patients)
        run_record.deviations_detected = len(deviations)
        run_record.sites_scored = len(risk_scores)
        run_record.high_risk_sites = sum(1 for s in risk_scores if s.risk_level == "HIGH")
        db.commit()

        # ── Step 7: Build response ─────────────────────────────────────────
        # Include up to 10 deviations as a sample for inspection
        deviation_sample = [d.to_dict() for d in deviations[:10]]

        site_risk_dicts = []
        for score in risk_scores:
            d = score.to_dict()
            # Convert RiskComponent objects to plain dicts
            if isinstance(d.get("components"), dict):
                d["components"] = {
                    k: (asdict(v) if hasattr(v, "__dataclass_fields__") else v)
                    for k, v in d["components"].items()
                }
            site_risk_dicts.append(d)

        logger.info(
            "run_engine_pipeline complete | run_id=%s | elapsed=%.2fs",
            run_id,
            (completed_at - started_at).total_seconds(),
        )

        return EngineRunResult(
            run_id=run_id,
            started_at=started_at.isoformat(),
            completed_at=completed_at.isoformat(),
            status="completed",
            sites_count=len(bundle.sites),
            patients_count=len(bundle.patients),
            deviations_detected=len(deviations),
            sites_scored=len(risk_scores),
            high_risk_sites=sum(1 for s in risk_scores if s.risk_level == "HIGH"),
            site_risk_scores=site_risk_dicts,
            deviation_sample=deviation_sample,
        )

    except Exception as exc:
        # Mark run as failed and re-raise so the HTTP layer can handle it
        run_record.status = "failed"
        run_record.completed_at = datetime.utcnow()
        run_record.error_message = str(exc)[:500]
        db.commit()
        logger.error(
            "run_engine_pipeline FAILED | run_id=%s | error=%s",
            run_id,
            type(exc).__name__,
        )
        raise
