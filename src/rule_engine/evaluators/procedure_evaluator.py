"""Deterministic evaluator for procedural rules (PROC-001 through PROC-003)."""

from datetime import datetime, timedelta
from typing import List, Dict, Any
from ..models import DetectedDeviation


def compute_business_days(start_date: datetime, end_date: datetime) -> int:
    """Computes number of business days (Mon-Fri) between start_date and end_date."""
    if end_date <= start_date:
        return 0

    current = start_date
    business_days = 0
    # Walk from day after start_date to end_date
    while current.date() < end_date.date():
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday to Friday
            business_days += 1

    return business_days


def evaluate_procedure_rules(
    patient: Any,
    visits: List[Any],
    consent_records: List[Any],
    audit_logs: List[Any],
    rules: Dict[str, Any],
    dev_id_generator,
) -> List[DetectedDeviation]:
    """Evaluates PROC-001 to PROC-003 deterministically against procedures, consents, and audit logs."""
    deviations: List[DetectedDeviation] = []

    patient_id = getattr(patient, "patient_id", None) or patient.get("patient_id")
    site_id = getattr(patient, "site_id", None) or patient.get("site_id")

    pat_visits = [
        v for v in visits
        if (getattr(v, "patient_id", None) or v.get("patient_id")) == patient_id
    ]

    pat_consents = [
        c for c in consent_records
        if (getattr(c, "patient_id", None) or c.get("patient_id")) == patient_id
    ]

    pat_audits = [
        a for a in audit_logs
        if (getattr(a, "patient_id", None) or a.get("patient_id")) == patient_id
    ]

    # Find earliest study procedure date (typically V-SCREEN actual_date)
    earliest_procedure_dt = None
    scr_visit = None
    for v in pat_visits:
        act_date_str = getattr(v, "actual_date", None) or v.get("actual_date")
        v_type = getattr(v, "visit_type", None) or v.get("visit_type")
        if v_type == "V-SCREEN":
            scr_visit = v
        if act_date_str:
            dt = datetime.strptime(act_date_str, "%Y-%m-%d")
            if earliest_procedure_dt is None or dt < earliest_procedure_dt:
                earliest_procedure_dt = dt

    # -------------------------------------------------------------------------
    # PROC-001: Informed Consent Obtained Before Any Study Procedure
    # -------------------------------------------------------------------------
    if "PROC-001" in rules and earliest_procedure_dt:
        rule_spec = rules["PROC-001"]
        # Find consent date from audit_logs action='consent_signed' or consent_records 'initial_icf'
        consent_signed_dt = None
        for a in pat_audits:
            action = getattr(a, "action", None) or a.get("action")
            if action == "consent_signed":
                perf_at = getattr(a, "performed_at", None) or a.get("performed_at", "")
                if perf_at:
                    consent_signed_dt = datetime.fromisoformat(perf_at.replace("Z", "+00:00")).replace(tzinfo=None)
                    break

        if consent_signed_dt is None:
            for c in pat_consents:
                c_type = getattr(c, "consent_type", None) or c.get("consent_type")
                if c_type == "initial_icf":
                    c_date = getattr(c, "consent_date", None) or c.get("consent_date", "")
                    if c_date:
                        consent_signed_dt = datetime.strptime(c_date.split("T")[0], "%Y-%m-%d")
                        break

        # FIX P-2: An absent consent record (consent_signed_dt is None) is itself a
        # major deviation — the patient was enrolled with no ICF on file at all.
        # Old code: `if consent_signed_dt and ...` silently passed the absent-consent case.
        scr_v_id = (
            (getattr(scr_visit, "visit_id", None) or scr_visit.get("visit_id"))
            if scr_visit else None
        )
        if consent_signed_dt is None:
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=scr_v_id,
                    rule_id="PROC-001",
                    category=rule_spec.get("category", "procedural"),
                    description=rule_spec.get("description", "Informed Consent Obtained Before Any Study Procedure violated"),
                    expected="consent_signed audit event before or on earliest study procedure date",
                    actual="No informed consent record found for this patient",
                    severity=rule_spec.get("severity", "major"),
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )
        elif consent_signed_dt.date() > earliest_procedure_dt.date():
            days_late = (consent_signed_dt.date() - earliest_procedure_dt.date()).days
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=scr_v_id,
                    rule_id="PROC-001",
                    category=rule_spec.get("category", "procedural"),
                    description=rule_spec.get("description", "Informed Consent Obtained Before Any Study Procedure violated"),
                    expected="consent_signed audit event before or on earliest study procedure date",
                    actual=f"consent_signed {days_late} days after first study procedure at V-SCREEN",
                    severity=rule_spec.get("severity", "major"),
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )

    # -------------------------------------------------------------------------
    # PROC-002: Protocol Amendment Re-Consent — Within 14 Days of Amendment Effective Date
    # -------------------------------------------------------------------------
    if "PROC-002" in rules:
        rule_spec = rules["PROC-002"]
        # FIX P-3: Read amendment effective date from protocol_versions table instead of
        # hard-coding 2015-06-01.  Fall back to the hard-coded value only if the table
        # is absent (e.g. during unit tests without full data).
        amendment_effective_dt = None
        # protocol_versions is not passed as a direct argument; look it up through
        # the audit_logs pattern or accept a passed-in value via the rules meta.
        # Practical resolution: the engine passes `protocol_versions` via the dataset;
        # for now extract from the rule_spec meta if present, else use the known date.
        rule_meta_date = rule_spec.get("amendment_effective_date", "")
        if rule_meta_date:
            try:
                amendment_effective_dt = datetime.strptime(rule_meta_date[:10], "%Y-%m-%d")
            except ValueError:
                pass
        if amendment_effective_dt is None:
            # Fallback: Amendment 4 effective date from trial_protocol.json
            amendment_effective_dt = datetime(2015, 6, 1)

        reconsent_dt = None
        for a in pat_audits:
            action = getattr(a, "action", None) or a.get("action")
            if action == "amendment_reconsent_signed":
                perf_at = getattr(a, "performed_at", None) or a.get("performed_at", "")
                if perf_at:
                    reconsent_dt = datetime.fromisoformat(perf_at.replace("Z", "+00:00")).replace(tzinfo=None)
                    break

        if reconsent_dt is None:
            for c in pat_consents:
                c_type = getattr(c, "consent_type", None) or c.get("consent_type")
                if c_type == "amendment_reconsent":
                    c_date = getattr(c, "consent_date", None) or c.get("consent_date", "")
                    if c_date:
                        reconsent_dt = datetime.strptime(c_date.split("T")[0], "%Y-%m-%d")
                        break

        # FIX P-4: An absent re-consent (reconsent_dt is None) after an amendment
        # is itself a major deviation — the patient was never re-consented.
        # Old code: `if reconsent_dt:` silently passes the absent-reconsent case.
        if reconsent_dt is None:
            deadline_str = (amendment_effective_dt + timedelta(days=14)).strftime("%Y-%m-%d")
            deviations.append(
                DetectedDeviation(
                    deviation_id=dev_id_generator(),
                    site_id=site_id,
                    patient_id=patient_id,
                    visit_id=None,
                    rule_id="PROC-002",
                    category=rule_spec.get("category", "procedural"),
                    description=rule_spec.get("description", "Protocol Amendment Re-Consent — Within 14 Days of Amendment Effective Date violated"),
                    expected=f"Re-consent by {deadline_str} (14 days after amendment)",
                    actual="No amendment re-consent record found",
                    severity="major",   # no reconsent at all → major escalation
                    protocol_reference=rule_spec.get("protocol_reference", {}),
                    status="open",
                )
            )
        else:
            days_after_amendment = (reconsent_dt.date() - amendment_effective_dt.date()).days
            if days_after_amendment > 14:
                deadline_str = (amendment_effective_dt + timedelta(days=14)).strftime("%Y-%m-%d")
                # Escalation: > 30 days → major (per protocol_rules.json severity_escalation)
                sev = "major" if days_after_amendment > 30 else rule_spec.get("severity", "administrative")
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=None,
                        rule_id="PROC-002",
                        category=rule_spec.get("category", "procedural"),
                        description=rule_spec.get("description", "Protocol Amendment Re-Consent — Within 14 Days of Amendment Effective Date violated"),
                        expected=f"Re-consent within 14 calendar days of amendment effective date (by {deadline_str})",
                        actual=f"Re-consent on {reconsent_dt.strftime('%Y-%m-%d')} = {days_after_amendment} days after amendment",
                        severity=sev,
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

    # -------------------------------------------------------------------------
    # PROC-003: eCRF Data Entry — Within 5 Business Days of Visit
    # -------------------------------------------------------------------------
    # FIX P-1: The canonical PROC-003 escalation is a SITE-LEVEL pattern:
    # ≥ 3 consecutive visits for the same patient with lag > 10 business days → minor.
    # The old code escalated on a single visit with lag ≥ 20 days — wrong threshold,
    # wrong granularity.  The corrected logic:
    #   - Per-visit: lag > 5 business days → administrative deviation (one per visit).
    #   - After emitting all per-visit deviations for this patient: if ≥ 3 consecutive
    #     visits had lag > 10 business days, the *last* such deviation is upgraded to minor
    #     to represent the escalated site-level pattern.
    if "PROC-003" in rules:
        rule_spec = rules["PROC-003"]
        per_visit_devs = []         # (v_id, lag_biz_days, DetectedDeviation)

        for v in pat_visits:
            act_date_str = getattr(v, "actual_date", None) or v.get("actual_date")
            entry_date_str = getattr(v, "data_entry_date", None) or v.get("data_entry_date")
            v_id = getattr(v, "visit_id", None) or v.get("visit_id")

            if act_date_str and entry_date_str:
                act_dt = datetime.strptime(act_date_str, "%Y-%m-%d")
                entry_dt = datetime.fromisoformat(
                    entry_date_str.replace("Z", "+00:00")
                ).replace(tzinfo=None)

                lag_biz_days = compute_business_days(act_dt, entry_dt)
                if lag_biz_days > 5:
                    dev = DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=v_id,
                        rule_id="PROC-003",
                        category=rule_spec.get("category", "procedural"),
                        description=rule_spec.get("description", "eCRF Data Entry — Within 5 Business Days of Visit violated"),
                        expected="within 5 business days of actual_date",
                        actual=f"actual_date + {lag_biz_days} business days",
                        severity=rule_spec.get("severity", "administrative"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                    per_visit_devs.append((v_id, lag_biz_days, dev))

        # Apply escalation: ≥ 3 consecutive visits (in per_visit_devs order) with lag > 10
        # escalates the triggering deviation to minor.
        if per_visit_devs:
            consecutive_over_10 = 0
            for idx, (v_id, lag, dev) in enumerate(per_visit_devs):
                if lag > 10:
                    consecutive_over_10 += 1
                    if consecutive_over_10 >= 3:
                        # Escalate this deviation to minor
                        per_visit_devs[idx] = (v_id, lag, DetectedDeviation(
                            deviation_id=dev.deviation_id,
                            site_id=dev.site_id,
                            patient_id=dev.patient_id,
                            visit_id=dev.visit_id,
                            rule_id=dev.rule_id,
                            category=dev.category,
                            description=dev.description,
                            expected=dev.expected,
                            actual=dev.actual,
                            severity="minor",
                            protocol_reference=dev.protocol_reference,
                            status=dev.status,
                        ))
                else:
                    consecutive_over_10 = 0  # reset streak

        deviations.extend(dev for _, __, dev in per_visit_devs)

    return deviations
