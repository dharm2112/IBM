"""Deterministic evaluator for dosing rules (DOSE-001 through DOSE-005)."""

# FIX M-5 / code-hygiene: import re at module level, not inside loop
import re
from collections import Counter
from datetime import datetime
from typing import List, Dict, Any
from ..models import DetectedDeviation

# Canonical visit IDs that carry a compliance_pct check (DOSE-002).
# Source: protocol_rules.json DOSE-002 applies_to_visits.
_DOSE002_VISIT_IDS = {"V-M12", "V-EOS"}


def get_field(obj: Any, field_name: str, default: Any = None) -> Any:
    """Safely retrieves field from object or dict."""
    if isinstance(obj, dict):
        val = obj.get(field_name, default)
    else:
        val = getattr(obj, field_name, default)
    return default if val is None else val


def evaluate_dosing_rules(
    patient: Any,
    visits: List[Any],
    dosing_events: List[Any],
    rules: Dict[str, Any],
    dev_id_generator,
) -> List[DetectedDeviation]:
    """Evaluates DOSE-001 to DOSE-005 deterministically against dosing events."""
    deviations: List[DetectedDeviation] = []

    patient_id = get_field(patient, "patient_id")
    site_id = get_field(patient, "site_id")
    arm = get_field(patient, "arm")

    pat_doses = [
        d for d in dosing_events
        if get_field(d, "patient_id") == patient_id
    ]

    # FIX D-1: Build two maps —
    #   visit_id_map : visit_id  → canonical visit_id  (e.g. "V-RAND")
    #   visit_id_set : set of visit_ids that belong to this patient
    # The visit_type field in the data model stores the protocol visit *type*
    # (e.g. "randomisation"), not the visit_id ("V-RAND").  DOSE-001 must match
    # on visit_id, not visit_type, to avoid a permanent false negative.
    patient_visit_ids: set = set()
    visit_id_by_type: Dict[str, str] = {}   # visit_type → visit_id
    for v in visits:
        if get_field(v, "patient_id") != patient_id:
            continue
        v_id = get_field(v, "visit_id", "")
        v_type = get_field(v, "visit_type", "")
        if v_id:
            patient_visit_ids.add(v_id)
        if v_type and v_id:
            visit_id_by_type[v_type] = v_id

    # Resolve the actual visit_id of the randomisation visit for this patient.
    # Primary: look for visit_id == "V-RAND".
    # Fallback: look for visit_type in ("V-RAND", "randomisation").
    rand_visit_id = None
    for v in visits:
        if get_field(v, "patient_id") != patient_id:
            continue
        v_id = get_field(v, "visit_id", "")
        v_type = get_field(v, "visit_type", "")
        if v_id == "V-RAND" or v_type in ("V-RAND", "randomisation"):
            rand_visit_id = v_id
            break

    # -------------------------------------------------------------------------
    # DOSE-001: First Dose Dispensed at Randomisation (ARM-ACTIVE only)
    # -------------------------------------------------------------------------
    if arm == "ARM-ACTIVE" and "DOSE-001" in rules:
        rule_spec = rules["DOSE-001"]
        # FIX D-1: match dose records whose visit_id equals the resolved rand_visit_id
        # rather than relying on visit_type_map which maps visit_type, not visit_id.
        v_rand_doses = [
            d for d in pat_doses
            if (
                get_field(d, "visit_id") == "V-RAND"
                or (rand_visit_id and get_field(d, "visit_id") == rand_visit_id)
            )
        ]
        has_first_dose = any(
            get_field(d, "drug_code") == "DAPAGLI-10"
            and float(get_field(d, "actual_dose", 0.0)) > 0
            for d in v_rand_doses
        )
        if not has_first_dose:
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=rand_visit_id,
                    rule_id="DOSE-001",
                    category=rule_spec.get("category", "dosing"),
                    description=rule_spec.get("description", "First Dose Dispensed at Randomisation missing"),
                    expected="dosing_events row present with drug_code='DAPAGLI-10' at V-RAND",
                    actual="no dispensing record at randomisation",
                    severity=rule_spec.get("severity", "major"),
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )

    # -------------------------------------------------------------------------
    # Iterate through each dosing event for DOSE-002, DOSE-003, DOSE-004
    # -------------------------------------------------------------------------
    for dose in pat_doses:
        v_id = get_field(dose, "visit_id", "")
        drug_code = get_field(dose, "drug_code")
        actual_dose = float(get_field(dose, "actual_dose", 0.0))
        route = str(get_field(dose, "route", "")).lower().strip()

        # DOSE-003: Fixed dose 10 mg for active study drug
        if drug_code == "DAPAGLI-10" and "DOSE-003" in rules:
            if actual_dose != 10.0:
                rule_spec = rules["DOSE-003"]
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="DOSE-003",
                        category=rule_spec.get("category", "dosing"),
                        description=rule_spec.get("description", "Dapagliflozin Fixed Dose Integrity — 10 mg Only violated"),
                        expected={"field": "actual_dose", "value": 10.0, "unit": "mg"},
                        actual={"field": "actual_dose", "value": actual_dose, "unit": "mg"},
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

        # DOSE-004: Oral route mandatory
        if drug_code == "DAPAGLI-10" and "DOSE-004" in rules:
            if route != "oral":
                rule_spec = rules["DOSE-004"]
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="DOSE-004",
                        category=rule_spec.get("category", "dosing"),
                        description=rule_spec.get("description", "Oral Route Mandatory — No Route Substitution violated"),
                        expected={"field": "route", "value": "oral"},
                        actual={"field": "route", "value": route},
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

        # FIX D-2: DOSE-002 fires only at V-M12 and V-EOS (not V-M6).
        # Source: protocol_rules.json DOSE-002 applies_to_visits: ["V-M12", "V-EOS"].
        if v_id in _DOSE002_VISIT_IDS and "DOSE-002" in rules:
            compliance_raw = get_field(dose, "compliance_pct", None)
            # FIX D-3: Skip records where compliance_pct is absent — these are not
            # annual-assessment accountability records.
            if compliance_raw is None:
                continue
            compliance = float(compliance_raw)
            if compliance < 70.0:
                rule_spec = rules["DOSE-002"]
                # Escalation: < 50 % → major (per protocol_rules.json severity_escalation)
                sev = "major" if compliance < 50.0 else rule_spec.get("severity", "minor")
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="DOSE-002",
                        category=rule_spec.get("category", "dosing"),
                        description=rule_spec.get("description", "Drug Compliance >= 70% at Annual Assessment violated"),
                        expected={"field": "compliance_pct", "value": ">= 70%"},
                        actual={"field": "compliance_pct", "value": f"{compliance}%"},
                        severity=sev,
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    # -------------------------------------------------------------------------
    # DOSE-005: Once-Daily Frequency — No Double-Dosing Within 24-Hour Window
    # -------------------------------------------------------------------------
    if "DOSE-005" in rules:
        rule_spec = rules["DOSE-005"]
        # Group active drug doses by calendar date
        # FIX D-4: sort active_doses_dates by (cal_date, dose_id) so the representative
        # dose picked for the deviation record is deterministic regardless of input order.
        active_doses_dates = []
        for d in pat_doses:
            if get_field(d, "drug_code") == "DAPAGLI-10":
                admin_date_str = str(get_field(d, "administration_date", ""))
                cal_date = admin_date_str.split("T")[0]
                if cal_date:
                    dose_id = get_field(d, "dose_id", "")
                    active_doses_dates.append((cal_date, dose_id, d))

        active_doses_dates.sort(key=lambda t: (t[0], t[1]))

        date_counts = Counter(cal_date for cal_date, _, __ in active_doses_dates)
        for cal_date, count in sorted(date_counts.items()):   # sorted for determinism
            if count > 1:
                # Deterministic: first record in sorted order for this date
                matched_dose = next(d for cd, _, d in active_doses_dates if cd == cal_date)
                v_id = get_field(matched_dose, "visit_id")
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="DOSE-005",
                        category=rule_spec.get("category", "dosing"),
                        description=rule_spec.get("description", "Once-Daily Frequency — No Double-Dosing Within 24-Hour Window violated"),
                        expected="1 dose per calendar day",
                        actual=f"{count} doses on calendar date {cal_date}",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    return deviations
