"""Deterministic evaluator for laboratory rules (LAB-001 through LAB-003)."""

from typing import List, Dict, Any
from ..models import DetectedDeviation


def evaluate_lab_rules(
    patient: Any,
    visits: List[Any],
    lab_results: List[Any],
    rules: Dict[str, Any],
    dev_id_generator,
) -> List[DetectedDeviation]:
    """Evaluates LAB-001 to LAB-003 deterministically against laboratory results."""
    deviations: List[DetectedDeviation] = []

    patient_id = getattr(patient, "patient_id", None) or patient.get("patient_id")
    site_id = getattr(patient, "site_id", None) or patient.get("site_id")

    pat_labs = [
        l for l in lab_results
        if (getattr(l, "patient_id", None) or l.get("patient_id")) == patient_id
    ]

    visit_type_map = {}
    visit_by_type = {}
    for v in visits:
        v_id = getattr(v, "visit_id", None) or v.get("visit_id")
        v_type = getattr(v, "visit_type", None) or v.get("visit_type")
        visit_type_map[v_id] = v_type
        if v_type:
            visit_type_map[v_type] = v_type
            visit_by_type[v_type] = v

    # -------------------------------------------------------------------------
    # LAB-001: Screening HbA1c (6.5 - 12.0 %)
    # -------------------------------------------------------------------------
    if "LAB-001" in rules:
        rule_spec = rules["LAB-001"]
        scr_visit = visit_by_type.get("V-SCREEN")
        scr_visit_id = (
            (getattr(scr_visit, "visit_id", None) or scr_visit.get("visit_id"))
            if scr_visit else None
        )

        # FIX L-2: Match labs to visits exclusively via visit_id join.
        # Removed "SCR" in lab_id substring heuristic — unreliable false-match source.
        scr_hba1c_results = [
            l for l in pat_labs
            if (getattr(l, "test_code", None) or l.get("test_code")) == "HBA1C"
            and (
                visit_type_map.get(getattr(l, "visit_id", None) or l.get("visit_id")) == "V-SCREEN"
                or (getattr(l, "visit_id", None) or l.get("visit_id", "")) == "V-SCREEN"
            )
        ]

        # FIX L-1: Use get_field / dict-safe access instead of direct .result_value attribute.
        first_val = None
        if scr_hba1c_results:
            r = scr_hba1c_results[0]
            first_val = getattr(r, "result_value", None) if not isinstance(r, dict) else r.get("result_value")

        if not scr_hba1c_results or first_val is None:
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=scr_visit_id,
                    rule_id="LAB-001",
                    category=rule_spec.get("category", "laboratory"),
                    description=rule_spec.get("description", "Screening HbA1c missing"),
                    expected="HbA1c present and within 6.5 - 12.0%",
                    actual="NULL (test not performed)",
                    severity=rule_spec.get("severity", "major"),
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )
        else:
            val = float(first_val)
            if val < 6.5 or val > 12.0:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=scr_visit_id,
                        rule_id="LAB-001",
                        category=rule_spec.get("category", "laboratory"),
                        description=rule_spec.get("description", "Screening HbA1c out of eligibility range 6.5 - 12.0%"),
                        expected={"field": "result_value", "low": 6.5, "high": 12.0, "unit": "%"},
                        actual={"field": "result_value", "value": val, "unit": "%"},
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    # -------------------------------------------------------------------------
    # LAB-002: Screening eGFR (>= 60 mL/min/1.73 m²)
    # -------------------------------------------------------------------------
    if "LAB-002" in rules:
        rule_spec = rules["LAB-002"]
        scr_visit = visit_by_type.get("V-SCREEN")
        scr_visit_id = (
            (getattr(scr_visit, "visit_id", None) or scr_visit.get("visit_id"))
            if scr_visit else None
        )

        # FIX L-2: visit_id join only; remove unreliable lab_id substring heuristic.
        scr_egfr_results = [
            l for l in pat_labs
            if (getattr(l, "test_code", None) or l.get("test_code")) == "eGFR_CKD_EPI"
            and (
                visit_type_map.get(getattr(l, "visit_id", None) or l.get("visit_id")) == "V-SCREEN"
                or (getattr(l, "visit_id", None) or l.get("visit_id", "")) == "V-SCREEN"
            )
        ]

        # FIX L-1: dict-safe value access.
        first_egfr_val = None
        if scr_egfr_results:
            r = scr_egfr_results[0]
            first_egfr_val = getattr(r, "result_value", None) if not isinstance(r, dict) else r.get("result_value")

        if not scr_egfr_results or first_egfr_val is None:
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=scr_visit_id,
                    rule_id="LAB-002",
                    category=rule_spec.get("category", "laboratory"),
                    description=rule_spec.get("description", "Screening eGFR missing"),
                    expected="eGFR (CKD-EPI) >= 60 mL/min/1.73m2",
                    actual="NULL (test not performed)",
                    severity=rule_spec.get("severity", "major"),
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )
        else:
            val = float(first_egfr_val)
            if val < 60.0:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=scr_visit_id,
                        rule_id="LAB-002",
                        category=rule_spec.get("category", "laboratory"),
                        description=rule_spec.get("description", "Screening eGFR — Must Be >= 60 mL/min/1.73 m² (CKD-EPI) violated"),
                        expected={"field": "result_value", "value": ">= 60.0", "unit": "mL/min/1.73m2"},
                        actual={"field": "result_value", "value": val, "unit": "mL/min/1.73m2"},
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    # -------------------------------------------------------------------------
    # LAB-003: eGFR Monitoring at Safety-Critical Visits (V-M6, V-M12, V-EOS)
    # -------------------------------------------------------------------------
    if "LAB-003" in rules:
        rule_spec = rules["LAB-003"]
        for target_v_type in ["V-M6", "V-M12", "V-EOS"]:
            # FIX L-3: Use the visit_id directly from the patient's visit list.
            # If the visit row is absent (e.g. deleted / never generated for a missed visit),
            # we must still fire — the eGFR is missing.  Build a fallback visit_id.
            target_v = visit_by_type.get(target_v_type)
            # Fallback: scan all patient visits for an id match
            if target_v is None:
                for v in visits:
                    if (getattr(v, "patient_id", None) or v.get("patient_id")) != patient_id:
                        continue
                    if (getattr(v, "visit_id", None) or v.get("visit_id", "")) == target_v_type:
                        target_v = v
                        break
            target_v_id = (
                (getattr(target_v, "visit_id", None) or target_v.get("visit_id"))
                if target_v else target_v_type   # use protocol visit_id as fallback
            )

            # FIX L-3 continued: fire even when target_v is None (visit row absent).
            # FIX L-2: match by visit_id join only; remove lab_id substring heuristic.
            matching_egfr = [
                l for l in pat_labs
                if (getattr(l, "test_code", None) or l.get("test_code")) == "eGFR_CKD_EPI"
                and (
                    visit_type_map.get(getattr(l, "visit_id", None) or l.get("visit_id")) == target_v_type
                    or (getattr(l, "visit_id", None) or l.get("visit_id", "")) == target_v_type
                    or (target_v_id and (getattr(l, "visit_id", None) or l.get("visit_id", "")) == target_v_id)
                )
            ]

            if not matching_egfr:
                # Completely missing / deleted record
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=target_v_id,
                        rule_id="LAB-003",
                        category=rule_spec.get("category", "laboratory"),
                        description=rule_spec.get("description", f"eGFR Monitoring at Safety-Critical Visit {target_v_type} absent"),
                        expected=f"eGFR (CKD-EPI) present at {target_v_type}",
                        actual="record deleted / test absent",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )
            else:
                # FIX L-1: dict-safe value access.
                r = matching_egfr[0]
                result_val = getattr(r, "result_value", None) if not isinstance(r, dict) else r.get("result_value")

            if matching_egfr and result_val is None:
                # Record present but result_value is None
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=target_v_id,
                        rule_id="LAB-003",
                        category=rule_spec.get("category", "laboratory"),
                        description=rule_spec.get("description", f"eGFR Monitoring at Safety-Critical Visit {target_v_type} — Result Value is NULL"),
                        expected=f"eGFR non-null measurement at {target_v_type}",
                        actual="result_value=NULL",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    return deviations
