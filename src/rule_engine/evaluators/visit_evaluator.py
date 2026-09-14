"""Deterministic evaluator for visit window rules (VISIT-001 through VISIT-005)."""

from datetime import datetime
from typing import List, Dict, Any
from ..models import DetectedDeviation


def _parse_date(date_str: str) -> datetime:
    """Parse ISO-8601 date or datetime string to a naive datetime.

    FIX V-4: strptime("%Y-%m-%d") raises ValueError on full datetime strings
    (e.g. "2015-06-01T00:00:00").  Accept both formats.
    """
    if not date_str:
        raise ValueError("empty date string")
    ds = date_str.strip()
    # Normalise timezone marker so fromisoformat works on Python 3.6-3.10
    ds = ds.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(ds)
        return dt.replace(tzinfo=None)
    except ValueError:
        pass
    # Bare date only
    return datetime.strptime(ds[:10], "%Y-%m-%d")


def evaluate_visit_rules(
    patient: Any,
    visits: List[Any],
    rules: Dict[str, Any],
    dev_id_generator,
) -> List[DetectedDeviation]:
    """Evaluates VISIT-001 to VISIT-005 deterministically against visit timeline."""
    deviations: List[DetectedDeviation] = []

    patient_id = getattr(patient, "patient_id", None) or patient.get("patient_id")
    site_id = getattr(patient, "site_id", None) or patient.get("site_id")
    enrollment_str = getattr(patient, "enrollment_date", None) or patient.get("enrollment_date")
    if not enrollment_str:
        return deviations

    # FIX V-4: use _parse_date to handle full datetime strings from the generator.
    enrollment_dt = _parse_date(enrollment_str)

    pat_visits = [
        v for v in visits
        if (getattr(v, "patient_id", None) or v.get("patient_id")) == patient_id
    ]

    for v in pat_visits:
        v_id = getattr(v, "visit_id", None) or v.get("visit_id")
        v_type = getattr(v, "visit_type", None) or v.get("visit_type")
        status = getattr(v, "status", None) or v.get("status", "completed")
        actual_date_str = getattr(v, "actual_date", None) or v.get("actual_date")

        # ---------------------------------------------------------------------
        # VISIT-001: Screening Visit Timing (Within 14 Days Pre-Randomisation)
        # ---------------------------------------------------------------------
        if (v_type == "V-SCREEN" or v_id == "V-SCREEN") and "VISIT-001" in rules:
            rule_spec = rules["VISIT-001"]
            if actual_date_str:
                actual_dt = _parse_date(actual_date_str)  # FIX V-4
                actual_day_offset = (actual_dt - enrollment_dt).days
                # FIX V-1: The canonical rule window_absolute is earliest_day=-21, latest_day=-1.
                # The 7-day grace extends the nominal -14 day window to -21 days.
                # Day 0 (randomisation itself) is not a valid screening day (latest = -1).
                # Old code: actual_day_offset < -14 → fired on days -15 through -21 (inside grace window).
                # Old code: actual_day_offset > 0  → correct for impossible post-rand screening.
                # Corrected boundary: fire when offset < -21 OR offset > -1.
                if actual_day_offset < -21 or actual_day_offset > -1:
                    sev = rule_spec.get("severity", "minor")
                    # Escalation: > 30 days before randomisation → major (stale eligibility labs)
                    if actual_day_offset < -30:
                        sev = "major"
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=v_id,
                            rule_id="VISIT-001",
                            category=rule_spec.get("category", "visit_window"),
                            description=rule_spec.get("description", "Screening Visit Timing — Within 14 Days Pre-Randomisation violated"),
                            expected="within 21 days pre-randomisation (Day -21 to Day -1)",
                            actual=f"Day {actual_day_offset} ({abs(actual_day_offset)} days relative to randomisation)",
                            severity=sev,
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

        # ---------------------------------------------------------------------
        # VISIT-002: Month 2 Visit Window (Day 53 to Day 67)
        # ---------------------------------------------------------------------
        if (v_type == "V-M2" or v_id == "V-M2") and "VISIT-002" in rules:
            rule_spec = rules["VISIT-002"]
            if actual_date_str:
                actual_dt = _parse_date(actual_date_str)  # FIX V-4
                actual_day = (actual_dt - enrollment_dt).days
                if actual_day < 53 or actual_day > 67:
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=v_id,
                            rule_id="VISIT-002",
                            category=rule_spec.get("category", "visit_window"),
                            description=rule_spec.get("description", "Month 2 Visit Window — Day 53 to Day 67 violated"),
                            expected="Day 53 to Day 67 post-randomisation",
                            actual=f"Day {actual_day}",
                            severity=rule_spec.get("severity", "minor"),
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

        # ---------------------------------------------------------------------
        # VISIT-003: Month 6 Safety Visit Window (Day 168 to Day 196, Safety-Critical)
        # ---------------------------------------------------------------------
        if (v_type == "V-M6" or v_id == "V-M6") and "VISIT-003" in rules:
            rule_spec = rules["VISIT-003"]
            if status == "missed" or not actual_date_str:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="VISIT-003",
                        category=rule_spec.get("category", "visit_window"),
                        description=rule_spec.get("description", "Month 6 Safety Visit missed"),
                        expected="Completed within Day 168 to Day 196",
                        actual="Visit missed / not performed",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )
            else:
                actual_dt = _parse_date(actual_date_str)  # FIX V-4
                actual_day = (actual_dt - enrollment_dt).days
                if actual_day < 168 or actual_day > 196:
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=v_id,
                            rule_id="VISIT-003",
                            category=rule_spec.get("category", "visit_window"),
                            description=rule_spec.get("description", "Month 6 Safety Visit Window — Day 168 to Day 196 violated"),
                            expected="Day 168 to Day 196 post-randomisation",
                            actual=f"Day {actual_day}",
                            severity=rule_spec.get("severity", "major"),
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

        # ---------------------------------------------------------------------
        # VISIT-004: Month 12 Annual Assessment Window (Day 351 to Day 379)
        # ---------------------------------------------------------------------
        if (v_type == "V-M12" or v_id == "V-M12") and "VISIT-004" in rules:
            rule_spec = rules["VISIT-004"]
            if status == "missed" or not actual_date_str:
                # FIX V-2: A missed Month 12 visit is MAJOR (missed_visit_severity in
                # protocol_rules.json), not minor (base severity).  The base severity
                # "minor" applies only to a window-exceeded visit that was still attended.
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="VISIT-004",
                        category=rule_spec.get("category", "visit_window"),
                        description=rule_spec.get("description", "Month 12 Annual Assessment Visit missed"),
                        expected="Completed within Day 351 to Day 379",
                        actual="Visit missed",
                        severity=rule_spec.get("missed_visit_severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )
            else:
                actual_dt = _parse_date(actual_date_str)  # FIX V-4
                actual_day = (actual_dt - enrollment_dt).days
                if actual_day < 351 or actual_day > 379:
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=v_id,
                            rule_id="VISIT-004",
                            category=rule_spec.get("category", "visit_window"),
                            description=rule_spec.get("description", "Month 12 Annual Assessment Window — Day 351 to Day 379 violated"),
                            expected="Day 351 to Day 379 post-randomisation",
                            actual=f"Day {actual_day}",
                            severity=rule_spec.get("severity", "minor"),
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

        # ---------------------------------------------------------------------
        # VISIT-005: End-of-Study Visit (Day 1431 to Day 1461)
        # ---------------------------------------------------------------------
        if (v_type == "V-EOS" or v_id == "V-EOS") and "VISIT-005" in rules:
            rule_spec = rules["VISIT-005"]
            if status == "missed" or not actual_date_str:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="VISIT-005",
                        category=rule_spec.get("category", "visit_window"),
                        description=rule_spec.get("description", "End-of-Study Visit missed"),
                        expected="Completed on or before Day 1461",
                        actual="Visit missed",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )
            else:
                actual_dt = _parse_date(actual_date_str)  # FIX V-4
                actual_day = (actual_dt - enrollment_dt).days
                # FIX V-3: window_absolute is earliest_day=1431, latest_day=1461.
                # Old code only checked actual_day > 1461, missing visits before Day 1431.
                if actual_day < 1431 or actual_day > 1461:
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=v_id,
                            rule_id="VISIT-005",
                            category=rule_spec.get("category", "visit_window"),
                            description=rule_spec.get("description", "End-of-Study Visit — Must Occur Within Day 1431 to Day 1461 violated"),
                            expected="Day 1431 to Day 1461 post-randomisation",
                            actual=f"Day {actual_day}",
                            severity=rule_spec.get("severity", "major"),
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

    return deviations
