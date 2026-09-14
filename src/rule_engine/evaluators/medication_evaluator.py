"""Deterministic evaluator for medication rules (MED-001 through MED-004)."""

# FIX M-5: import re at module level, not inside the medication loop.
import re
from typing import List, Dict, Any
from ..models import DetectedDeviation


def evaluate_medication_rules(
    patient: Any,
    medications: List[Any],
    rules: Dict[str, Any],
    dev_id_generator,
) -> List[DetectedDeviation]:
    """Evaluates MED-001 to MED-004 deterministically against patient medications."""
    deviations: List[DetectedDeviation] = []

    patient_id = getattr(patient, "patient_id", None) or patient.get("patient_id")
    site_id = getattr(patient, "site_id", None) or patient.get("site_id")
    baseline_insulin = getattr(patient, "baseline_insulin", False)
    if isinstance(patient, dict):
        baseline_insulin = patient.get("baseline_insulin", False)

    pat_meds = [
        m for m in medications
        if (getattr(m, "patient_id", None) or m.get("patient_id")) == patient_id
    ]

    for med in pat_meds:
        drug_name = (getattr(med, "drug_name", "") or med.get("drug_name", "")).lower()
        drug_class = (getattr(med, "drug_class", "") or med.get("drug_class", "")).lower()
        dose_str = getattr(med, "dose", "") or med.get("dose", "")
        start_date = getattr(med, "start_date", "") or med.get("start_date", "")

        # ---------------------------------------------------------------------
        # MED-001: Prohibited Concomitant SGLT2 Inhibitors
        # ---------------------------------------------------------------------
        if "MED-001" in rules:
            rule_spec = rules["MED-001"]
            prohibited_sglt2 = ["canagliflozin", "empagliflozin", "ertugliflozin",
                                 "ipragliflozin", "luseogliflozin", "sotagliflozin"]
            is_prohibited_sglt2 = (
                drug_class in ("sglt2 inhibitor", "sglt2_inhibitor")
                and "dapagliflozin" not in drug_name
            ) or any(p_drug in drug_name for p_drug in prohibited_sglt2)

            # FIX M-2: Only flag medications that overlap with the study period.
            # A pre-study canagliflozin prescription (switched before enrolment)
            # must not fire. Require start_date >= enrollment_date OR
            # end_date IS NULL / end_date >= enrollment_date.
            enrollment_date = (getattr(patient, "enrollment_date", "")
                               or patient.get("enrollment_date", ""))
            end_date = med.get("end_date", None) if isinstance(med, dict) else getattr(med, "end_date", None)

            overlaps_study = (
                not start_date  # no date → conservative: assume overlap
                or not enrollment_date
                or start_date >= enrollment_date
                or (end_date is None or end_date >= enrollment_date)
            )

            if is_prohibited_sglt2 and overlaps_study:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=None,
                        rule_id="MED-001",
                        category=rule_spec.get("category", "medication"),
                        description=rule_spec.get("description", "Prohibited Concomitant SGLT2 Inhibitors violated"),
                        expected="No concomitant SGLT2 inhibitors other than study drug",
                        actual=f"{drug_name} ({drug_class})",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

        # ---------------------------------------------------------------------
        # MED-003: Warfarin Initiation — Requires Medical Monitor Notification
        # ---------------------------------------------------------------------
        if "MED-003" in rules:
            rule_spec = rules["MED-003"]
            vka_drugs = ["warfarin", "acenocoumarol", "phenprocoumon", "fluindione"]
            is_vka = (
                drug_class in ("vitamin_k_antagonist", "vka")
                or any(vka in drug_name for vka in vka_drugs)
            )

            # FIX M-1: Only flag VKA medications started AFTER enrolment (new initiation).
            # The canonical rule condition: medications.start_date >= patients.enrollment_date.
            # Pre-enrolment VKA use is not a protocol deviation under MED-003.
            enrollment_date = (getattr(patient, "enrollment_date", "")
                               or patient.get("enrollment_date", ""))
            is_new_initiation = (
                bool(start_date)
                and bool(enrollment_date)
                and start_date >= enrollment_date
            )

            if is_vka and is_new_initiation:
                deviations.append(
                    DetectedDeviation(
                        deviation_id=dev_id_generator(),
                        site_id=site_id,
                        patient_id=patient_id,
                        visit_id=None,
                        rule_id="MED-003",
                        category=rule_spec.get("category", "medication"),
                        description=rule_spec.get("description", "Warfarin Initiation — Requires Medical Monitor Notification and INR Monitoring violated"),
                        expected="Medical Monitor notification and INR monitoring documentation",
                        actual=f"{drug_name} without documented medical monitor notification",
                        severity=rule_spec.get("severity", "major"),
                        protocol_reference=rule_spec.get("protocol_reference", {}),
                        status="open",
                    )
                )

        # ---------------------------------------------------------------------
        # MED-004: New Insulin Initiation — Requires Medical Monitor Approval
        # ---------------------------------------------------------------------
        if "MED-004" in rules:
            rule_spec = rules["MED-004"]
            is_insulin = drug_class == "insulin" or "insulin" in drug_name
            # If patient had no baseline insulin, starting insulin is a deviation without approval
            if is_insulin and not baseline_insulin:
                # Check if it was started post-enrollment
                enrollment_date = getattr(patient, "enrollment_date", "") or patient.get("enrollment_date", "")
                if start_date and enrollment_date and start_date >= enrollment_date:
                    deviations.append(
                        DetectedDeviation(
                            deviation_id=dev_id_generator(),
                            site_id=site_id,
                            patient_id=patient_id,
                            visit_id=None,
                            rule_id="MED-004",
                            category=rule_spec.get("category", "medication"),
                            description=rule_spec.get("description", "New Insulin Initiation — Requires Medical Monitor Approval violated"),
                            expected="Prior Medical Monitor approval for new insulin initiation in baseline-naive patient",
                            actual=f"{drug_name} initiated on {start_date} without documented approval",
                            severity=rule_spec.get("severity", "minor"),
                            protocol_reference=rule_spec.get("protocol_reference", {}),
                            status="open",
                        )
                    )

        # ---------------------------------------------------------------------
        # MED-002: High-Dose Loop Diuretic (>= 80 mg/day furosemide equivalent)
        # ---------------------------------------------------------------------
        if "MED-002" in rules:
            rule_spec = rules["MED-002"]
            loop_diuretics = {"furosemide", "frusemide", "torsemide", "torasemide",
                              "bumetanide", "ethacrynic acid"}
            is_loop_diuretic = (
                drug_class == "loop_diuretic"
                or any(ld in drug_name for ld in loop_diuretics)
            )
            if is_loop_diuretic:
                # FIX M-4: Extract the numeric dose and convert to furosemide-equivalent
                # before comparing against the 80 mg threshold.
                # Equivalences (approximate): torasemide 20 mg ≡ furosemide 80 mg,
                #                             bumetanide 2 mg ≡ furosemide 80 mg.
                m_dose = re.search(r"(\d+(?:\.\d+)?)", dose_str)
                if m_dose:
                    raw_dose = float(m_dose.group(1))
                    # Determine furosemide-equivalent dose
                    if "bumetanide" in drug_name:
                        furo_equiv = raw_dose * 40.0   # 1 mg bumetanide ≡ 40 mg furosemide
                    elif "torasemide" in drug_name or "torsemide" in drug_name:
                        furo_equiv = raw_dose * 4.0    # 1 mg torasemide ≡ 4 mg furosemide
                    else:
                        furo_equiv = raw_dose           # furosemide: 1:1
                    if furo_equiv >= 80.0:
                        sev = "major" if furo_equiv >= 160.0 else "minor"
                        deviations.append(
                            DetectedDeviation(
                                deviation_id=dev_id_generator(),
                                site_id=site_id,
                                patient_id=patient_id,
                                visit_id=None,
                                rule_id="MED-002",
                                category=rule_spec.get("category", "medication"),
                                description=rule_spec.get("description", "High-Dose Loop Diuretic — Requires Medical Monitor Notification violated"),
                                expected=f"Medical Monitor notification for loop diuretic >= 80 mg furosemide-equivalent (actual equiv: {furo_equiv:.0f} mg)",
                                actual=f"{drug_name} at {dose_str} without notification",
                                severity=sev,
                                protocol_reference=rule_spec.get("protocol_reference", {}),
                                status="open",
                            )
                        )

    return deviations
