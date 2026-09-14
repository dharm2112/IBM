"""Data models representing clinical trial entities matching root.md Database Schema."""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any


@dataclass
class Site:
    site_id: str
    site_name: str
    country: str
    city: str
    investigator: str
    activation_date: str
    patient_count: int
    status: str  # 'active', 'suspended', 'closed'
    target_risk_level: str = "low"  # 'low', 'medium', 'high', 'critical'
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Patient:
    patient_id: str
    site_id: str
    patient_code: str
    enrollment_date: str
    arm: str  # 'ARM-ACTIVE' or 'ARM-PLACEBO'
    status: str  # 'enrolled', 'completed', 'withdrawn', 'lost_to_fu'
    date_of_birth: str
    sex: str  # 'M', 'F'
    baseline_hba1c: float
    baseline_egfr: float
    baseline_insulin: bool = False
    diabetes_type: str = "T2DM"
    has_established_cvd: bool = True
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Visit:
    visit_id: str
    patient_id: str
    site_id: str
    visit_number: int  # 0 to 5
    visit_type: str  # 'V-SCREEN', 'V-RAND', 'V-M2', 'V-M6', 'V-M12', 'V-EOS'
    scheduled_date: str
    actual_date: Optional[str]  # None if missed
    status: str  # 'completed', 'missed', 'rescheduled'
    data_entry_date: Optional[str] = None
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DosingEvent:
    dose_id: str
    visit_id: str
    patient_id: str
    drug_code: str  # 'DAPAGLI-10' or 'PLACEBO-0'
    scheduled_dose: float
    actual_dose: float
    dose_unit: str  # 'mg'
    administered_by: str
    administration_date: str
    route: str  # 'oral'
    compliance_pct: float = 100.0
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LabResult:
    lab_id: str
    visit_id: str
    patient_id: str
    test_code: str  # 'HBA1C', 'eGFR_CKD_EPI', 'CREATININE', etc.
    test_name: str
    result_value: Optional[float]
    result_unit: str
    normal_low: Optional[float]
    normal_high: Optional[float]
    result_date: str
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Medication:
    med_id: str
    patient_id: str
    drug_name: str
    drug_class: str
    start_date: str
    end_date: Optional[str]
    dose: str
    indication: str
    reported_by: str
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ConsentRecord:
    consent_id: str
    patient_id: str
    consent_type: str  # 'initial_icf', 'amendment_reconsent'
    consent_date: str
    version: str
    signed: bool = True
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AuditLog:
    log_id: str
    entity_type: str
    entity_id: str
    action: str
    performed_by: str
    performed_at: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    patient_id: Optional[str] = None
    site_id: Optional[str] = None
    ip_address: Optional[str] = "10.0.0.1"
    session_id: Optional[str] = "sess-001"
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Deviation:
    deviation_id: str
    patient_id: str
    site_id: str
    visit_id: Optional[str]
    rule_id: str  # e.g., 'DOSE-003', 'VISIT-003'
    deviation_date: str
    description: str
    expected_value: str
    actual_value: str
    severity: str  # 'administrative', 'minor', 'major'
    severity_source: str = "rule_engine"
    status: str = "open"  # 'open', 'acknowledged', 'resolved', 'closed'
    detected_at: Optional[str] = None
    detected_by: str = "system"  # 'system', 'manual'
    created_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DatasetBundle:
    sites: List[Site] = field(default_factory=list)
    patients: List[Patient] = field(default_factory=list)
    visits: List[Visit] = field(default_factory=list)
    dosing_events: List[DosingEvent] = field(default_factory=list)
    lab_results: List[LabResult] = field(default_factory=list)
    medications: List[Medication] = field(default_factory=list)
    consent_records: List[ConsentRecord] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    deviations: List[Deviation] = field(default_factory=list)
    protocol_meta: Dict[str, Any] = field(default_factory=dict)
    rules_meta: List[Dict[str, Any]] = field(default_factory=list)

    def summary(self) -> Dict[str, int]:
        return {
            "sites": len(self.sites),
            "patients": len(self.patients),
            "visits": len(self.visits),
            "dosing_events": len(self.dosing_events),
            "lab_results": len(self.lab_results),
            "medications": len(self.medications),
            "consent_records": len(self.consent_records),
            "audit_logs": len(self.audit_logs),
            "deviations": len(self.deviations),
        }
