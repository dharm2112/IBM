"""
src/backend/db_models.py
─────────────────────────
SQLAlchemy ORM models for integration-layer persistence.

Design principles
─────────────────
• These models persist only the OUTPUTS of Member 1's deterministic pipeline:
  DetectedDeviation results and SiteRiskScore results.
• They do NOT duplicate Member 1's domain dataclasses — they are thin storage
  wrappers that map dataclass fields to table columns.
• Severity and risk_score are stored verbatim from the rule engine.
  The AI layer reads them; it NEVER writes back to these columns.

Tables
──────
  detected_deviations  — one row per DetectedDeviation from the rule engine
  site_risk_scores     — one row per SiteRiskScore (latest run per site)

Run-tracking
─────────────
  engine_runs — lightweight log of each /run-engine execution with summary stats.
"""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from src.backend.database import Base


# ---------------------------------------------------------------------------
# EngineRun — audit log of /run-engine executions
# ---------------------------------------------------------------------------


class EngineRun(Base):
    """Lightweight record of each rule-engine execution."""

    __tablename__ = "engine_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(16), default="running", nullable=False)  # running|completed|failed

    # Summary stats
    sites_count = Column(Integer, default=0)
    patients_count = Column(Integer, default=0)
    deviations_detected = Column(Integer, default=0)
    sites_scored = Column(Integer, default=0)
    high_risk_sites = Column(Integer, default=0)

    error_message = Column(Text, nullable=True)

    protocol_id = Column(String(128), nullable=True)
    protocol_version = Column(String(64), nullable=True)
    executable_rule_ids = Column(Text, nullable=True) # JSON list of executed rule IDs

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "sites_count": self.sites_count,
            "patients_count": self.patients_count,
            "deviations_detected": self.deviations_detected,
            "sites_scored": self.sites_scored,
            "high_risk_sites": self.high_risk_sites,
            "error_message": self.error_message,
            "protocol_id": self.protocol_id,
            "protocol_version": self.protocol_version,
            "executable_rule_ids": json.loads(self.executable_rule_ids or "[]"),
        }


# ---------------------------------------------------------------------------
# DetectedDeviationRecord — persisted output of TrialGuardRuleEngine
# ---------------------------------------------------------------------------


class DetectedDeviationRecord(Base):
    """
    Stores one DetectedDeviation as produced by TrialGuardRuleEngine.evaluate().

    severity is written once by the rule engine and NEVER overwritten by AI.
    """

    __tablename__ = "detected_deviations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)

    # Fields from rule_engine.models.DetectedDeviation
    deviation_id = Column(String(64), nullable=False, index=True)
    site_id = Column(String(64), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    visit_id = Column(String(64), nullable=True)
    rule_id = Column(String(64), nullable=False)
    category = Column(String(64), nullable=False)
    description = Column(Text, nullable=False)
    expected = Column(Text, nullable=True)    # serialised as string
    actual = Column(Text, nullable=True)      # serialised as string
    severity = Column(String(32), nullable=False)   # 'major'|'minor'|'administrative'
    protocol_reference = Column(Text, nullable=True)  # JSON string
    status = Column(String(32), default="open")
    detected_at = Column(String(64), nullable=True)
    detected_by = Column(String(64), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "deviation_id": self.deviation_id,
            "site_id": self.site_id,
            "patient_id": self.patient_id,
            "visit_id": self.visit_id,
            "rule_id": self.rule_id,
            "category": self.category,
            "description": self.description,
            "expected": self.expected,
            "actual": self.actual,
            "severity": self.severity,
            "status": self.status,
            "detected_at": self.detected_at,
            "detected_by": self.detected_by,
        }


# ---------------------------------------------------------------------------
# SiteRiskScoreRecord — persisted output of score_all_sites()
# ---------------------------------------------------------------------------


class SiteRiskScoreRecord(Base):
    """
    Stores one SiteRiskScore as produced by score_all_sites().

    risk_score and risk_level are written once by the deterministic engine.
    The AI layer reads them from here; it NEVER modifies these columns.
    """

    __tablename__ = "site_risk_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)

    # Fields from rule_engine.models.SiteRiskScore
    site_id = Column(String(64), nullable=False, index=True)
    risk_score = Column(Float, nullable=False)        # 0.0 – 100.0
    risk_level = Column(String(16), nullable=False)   # 'LOW'|'MEDIUM'|'HIGH'
    total_deviations = Column(Integer, default=0)
    major_count = Column(Integer, default=0)
    minor_count = Column(Integer, default=0)
    administrative_count = Column(Integer, default=0)
    unique_rules_violated = Column(Integer, default=0)
    dosing_rule_violations = Column(Integer, default=0)
    missed_safety_visits = Column(Integer, default=0)
    top_risk_drivers = Column(Text, nullable=True)    # JSON array string
    components = Column(Text, nullable=True)           # JSON object string
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "site_id": self.site_id,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "total_deviations": self.total_deviations,
            "major_count": self.major_count,
            "minor_count": self.minor_count,
            "administrative_count": self.administrative_count,
            "unique_rules_violated": self.unique_rules_violated,
            "dosing_rule_violations": self.dosing_rule_violations,
            "missed_safety_visits": self.missed_safety_visits,
            "top_risk_drivers": json.loads(self.top_risk_drivers or "[]"),
            "components": json.loads(self.components or "{}"),
        }


# Generated synthetic source data is run-scoped.  These tables are storage
# projections of src.data_generator dataclasses; they do not make decisions.
class SiteRecord(Base):
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    site_id = Column(String(64), nullable=False, index=True)
    site_name = Column(String(255), nullable=False)
    country = Column(String(64)); city = Column(String(128)); investigator = Column(String(255))
    activation_date = Column(String(32)); patient_count = Column(Integer); status = Column(String(32))


class PatientRecord(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True); site_id = Column(String(64), nullable=False, index=True)
    patient_code = Column(String(64)); enrollment_date = Column(String(32)); arm = Column(String(64)); status = Column(String(32))
    date_of_birth = Column(String(32)); sex = Column(String(16)); baseline_hba1c = Column(Float); baseline_egfr = Column(Float)


class VisitRecord(Base):
    __tablename__ = "visits"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    visit_id = Column(String(64), nullable=False, index=True); patient_id = Column(String(64), nullable=False, index=True); site_id = Column(String(64), nullable=False)
    visit_number = Column(Integer); visit_type = Column(String(32)); scheduled_date = Column(String(32)); actual_date = Column(String(32)); status = Column(String(32)); data_entry_date = Column(String(64))


class LabRecord(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    lab_id = Column(String(64), nullable=False); visit_id = Column(String(64), nullable=False, index=True); patient_id = Column(String(64), nullable=False, index=True)
    test_code = Column(String(64)); test_name = Column(String(128)); result_value = Column(Float); result_unit = Column(String(32)); result_date = Column(String(32))


class DoseRecord(Base):
    __tablename__ = "doses"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    dose_id = Column(String(64), nullable=False); visit_id = Column(String(64), nullable=False, index=True); patient_id = Column(String(64), nullable=False, index=True)
    drug_code = Column(String(64)); scheduled_dose = Column(Float); actual_dose = Column(Float); dose_unit = Column(String(32)); administration_date = Column(String(64)); route = Column(String(32)); compliance_pct = Column(Float)


class MedicationRecord(Base):
    __tablename__ = "medications"
    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), ForeignKey("engine_runs.run_id"), nullable=False, index=True)
    med_id = Column(String(64), nullable=False); patient_id = Column(String(64), nullable=False, index=True)
    drug_name = Column(String(255)); drug_class = Column(String(128)); start_date = Column(String(32)); end_date = Column(String(32)); dose = Column(String(64)); indication = Column(String(255))


class CapaRecord(Base):
    __tablename__ = "capas"
    id = Column(Integer, primary_key=True); capa_id = Column(String(64), unique=True, nullable=False, index=True)
    deviation_id = Column(String(64), nullable=False, index=True); site_id = Column(String(64)); patient_id = Column(String(64))
    root_cause_analysis = Column(Text); immediate_actions = Column(Text); preventive_actions = Column(Text); timeline = Column(Text); effectiveness_check = Column(Text); full_draft = Column(Text)
    status = Column(String(32), nullable=False, default="draft"); human_review_required = Column(Boolean, nullable=False, default=True)
    provider = Column(String(64), default="watsonx.ai"); model_id = Column(String(128)); created_at = Column(DateTime, default=datetime.utcnow); updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProtocolRuleRecord(Base):
    __tablename__ = "protocol_rules_review"
    id = Column(Integer, primary_key=True); rule_id = Column(String(128), unique=True, nullable=False, index=True)
    protocol_id = Column(String(128), index=True)
    category = Column(String(64)); description = Column(Text); condition = Column(Text); expected_value = Column(Text); allowed_range = Column(Text); unit = Column(String(64)); visit = Column(String(64)); severity_hint = Column(String(64)); source_text = Column(Text); confidence = Column(String(32))
    status = Column(String(32), nullable=False, default="pending"); created_at = Column(DateTime, default=datetime.utcnow); updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProtocolRuleMappingRecord(Base):
    __tablename__ = "protocol_rule_mappings"
    id = Column(Integer, primary_key=True)
    extracted_rule_id = Column(String(128), ForeignKey("protocol_rules_review.rule_id"), nullable=False, index=True)
    canonical_rule_id = Column(String(128), nullable=True)
    mapping_status = Column(String(32), nullable=False, default="pending") # pending, approved, rejected, unsupported
    confidence = Column(String(32), default="medium")
    mapping_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLogRecord(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True); event_id = Column(String(64), unique=True, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False); event_type = Column(String(64), nullable=False); entity_type = Column(String(64), nullable=False); entity_id = Column(String(128), nullable=False)
    previous_status = Column(String(32)); new_status = Column(String(32)); source = Column(String(64)); details = Column(Text)


def add_audit_event(db, event_type: str, entity_type: str, entity_id: str, *, previous_status=None, new_status=None, source="system", details=None):
    import uuid
    db.add(AuditLogRecord(event_id=f"AUD-{uuid.uuid4().hex[:12].upper()}", event_type=event_type, entity_type=entity_type, entity_id=entity_id, previous_status=previous_status, new_status=new_status, source=source, details=details))
