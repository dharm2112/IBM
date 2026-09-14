"""Data models for TrialGuard Deterministic Rule Engine."""

from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List, Union


@dataclass
class DetectedDeviation:
    """Represents a protocol deviation discovered by the deterministic rule engine."""

    deviation_id: str
    site_id: str
    patient_id: str
    visit_id: Optional[str]
    rule_id: str
    category: str
    description: str
    expected: Union[str, Dict[str, Any]]
    actual: Union[str, Dict[str, Any]]
    severity: str  # 'major', 'minor', 'administrative'
    protocol_reference: Dict[str, Any]
    status: str = "open"
    detected_at: Optional[str] = None
    detected_by: str = "system"

    def to_dict(self) -> Dict[str, Any]:
        """Serializes deviation to standard dictionary."""
        d = asdict(self)
        # Format expected and actual as clean strings if dict
        if isinstance(d["expected"], dict):
            d["expected"] = str(d["expected"])
        if isinstance(d["actual"], dict):
            d["actual"] = str(d["actual"])
        return d


@dataclass
class RiskComponent:
    """Contribution of a single factor to the overall site risk score."""

    raw_value: float          # The measured quantity (count, ratio, days …)
    normalized_score: float   # 0–100 linear normalisation of raw_value
    weight: float             # Fractional weight assigned to this component
    contribution: float       # normalized_score × weight  (additive to risk_score)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SiteRiskScore:
    """Deterministic, evidence-only site risk score for TrialGuard.

    Risk score is the weighted sum of five normalised component scores:
        risk_score = Σ(component.contribution)  ∈ [0, 100]

    Thresholds:
        LOW    0.00 – 39.99
        MEDIUM 40.00 – 69.99
        HIGH   70.00 – 100.00

    All arithmetic is purely derived from the DetectedDeviation list that the
    rule engine produces for the site; no field is hard-coded per site.
    """

    site_id: str
    risk_score: float                          # rounded to 2 d.p.
    risk_level: str                            # 'LOW' | 'MEDIUM' | 'HIGH'
    components: Dict[str, RiskComponent] = field(default_factory=dict)
    top_risk_drivers: List[str] = field(default_factory=list)
    # Audit counters (readable without unpacking components)
    total_deviations: int = 0
    major_count: int = 0
    minor_count: int = 0
    administrative_count: int = 0
    unique_rules_violated: int = 0
    dosing_rule_violations: int = 0
    missed_safety_visits: int = 0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d
