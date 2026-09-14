"""Injects controlled protocol deviations traceable to protocol_rules.json and root.md Section J."""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from .models import Patient, Visit, DosingEvent, LabResult, Medication, ConsentRecord, Deviation
from .protocol_loader import ProtocolLoader
from .visit_schedule_generator import add_business_days


class DeviationInjector:
    """Modifies clinical records and emits ground truth deviation records."""

    def __init__(self, loader: ProtocolLoader, rng: random.Random):
        self.loader = loader
        self.rng = rng
        self.rules = self.loader.rules_by_id

    def inject_all(
        self,
        patients: List[Patient],
        visits: List[Visit],
        dosing_events: List[DosingEvent],
        lab_results: List[LabResult],
        medications: List[Medication],
        consent_records: List[ConsentRecord],
    ) -> List[Deviation]:
        """Injects targeted protocol deviations and returns ground truth Deviation records."""
        deviations: List[Deviation] = []

        # Index data by patient_id and site_id
        patient_map = {p.patient_id: p for p in patients}
        visits_by_patient: Dict[str, Dict[str, Visit]] = {}
        visit_type_by_id: Dict[str, str] = {}
        for v in visits:
            visits_by_patient.setdefault(v.patient_id, {})[v.visit_type] = v
            visit_type_by_id[v.visit_id] = v.visit_type

        dosing_by_patient: Dict[str, Dict[str, DosingEvent]] = {}
        for d in dosing_events:
            v_type = visit_type_by_id.get(d.visit_id)
            if v_type:
                dosing_by_patient.setdefault(d.patient_id, {})[v_type] = d

        labs_by_patient: Dict[str, List[LabResult]] = {}
        for l in lab_results:
            labs_by_patient.setdefault(l.patient_id, []).append(l)

        dev_counter = 1

        def make_dev(
            patient: Patient,
            rule_id: str,
            visit: Visit = None,
            dev_date: str = None,
            custom_desc: str = None,
            expected: str = None,
            actual: str = None,
            severity_override: str = None,
        ) -> Deviation:
            nonlocal dev_counter
            rule = self.rules.get(rule_id, {})
            sev = severity_override or rule.get("severity", "minor")
            desc = custom_desc or rule.get("description", "")
            d_date = dev_date or (visit.actual_date if visit else patient.enrollment_date)

            dev = Deviation(
                deviation_id=f"DEV-{dev_counter:04d}",
                patient_id=patient.patient_id,
                site_id=patient.site_id,
                visit_id=visit.visit_id if visit else None,
                rule_id=rule_id,
                deviation_date=d_date,
                description=desc,
                expected_value=expected or str(rule.get("expected_value", "")),
                actual_value=actual or "Violated",
                severity=sev,
                severity_source="rule_engine",
                status="open",
                detected_at=f"{d_date}T18:00:00Z",
                detected_by="system",
                created_at=f"{d_date}T18:05:00Z",
            )
            dev_counter += 1
            return dev

        # =========================================================================
        # 1. SITE 104 (HIGH RISK): 6 Major Dosing, 2 Prohibited Meds, 4 Missed Visits
        # =========================================================================
        s104_patients = [p for p in patients if p.site_id == "SITE-104"]

        if len(s104_patients) >= 10:
            # Dosing Anomaly 1: DOSE-003 - Dose 15 mg instead of 10 mg (PT-104-001 at V-M2)
            p1 = s104_patients[0]
            v_m2 = visits_by_patient[p1.patient_id]["V-M2"]
            dose1 = dosing_by_patient[p1.patient_id]["V-M2"]
            dose1.actual_dose = 15.0
            deviations.append(
                make_dev(
                    p1, "DOSE-003", v_m2,
                    custom_desc="Dapagliflozin dose overage: 15 mg administered instead of protocol-mandated 10 mg.",
                    expected="10.0 mg",
                    actual="15.0 mg (+50%)",
                )
            )

            # Dosing Anomaly 2: DOSE-003 - Dose 20 mg instead of 10 mg (PT-104-003 at V-M6)
            p3 = s104_patients[2]
            v_m6 = visits_by_patient[p3.patient_id]["V-M6"]
            dose3 = dosing_by_patient[p3.patient_id]["V-M6"]
            dose3.actual_dose = 20.0
            deviations.append(
                make_dev(
                    p3, "DOSE-003", v_m6,
                    custom_desc="Dapagliflozin double-strength overdose: 20 mg administered instead of protocol-mandated 10 mg.",
                    expected="10.0 mg",
                    actual="20.0 mg (+100%)",
                )
            )

            # Dosing Anomaly 3: DOSE-004 - Oral Route Mandatory, route='sublingual' (PT-104-005 at V-M2)
            p5 = s104_patients[4]
            v_m2_5 = visits_by_patient[p5.patient_id]["V-M2"]
            dose5 = dosing_by_patient[p5.patient_id]["V-M2"]
            dose5.route = "sublingual"
            deviations.append(
                make_dev(
                    p5, "DOSE-004", v_m2_5,
                    custom_desc="Incorrect route of administration: Sublingual administration recorded; oral required.",
                    expected="oral",
                    actual="sublingual",
                )
            )

            # Dosing Anomaly 4: DOSE-005 - Double-dosing within 24-hour window (PT-104-007 at V-M12)
            p7 = s104_patients[6]
            v_m12_7 = visits_by_patient[p7.patient_id]["V-M12"]
            # Add a second dosing event on the same day
            second_dose = DosingEvent(
                dose_id=f"DOS-{p7.patient_code}-V-M12-REPEAT",
                visit_id=v_m12_7.visit_id,
                patient_id=p7.patient_id,
                drug_code="DAPAGLI-10",
                scheduled_dose=10.0,
                actual_dose=10.0,
                dose_unit="mg",
                administered_by="Nurse Coordinator",
                administration_date=f"{v_m12_7.actual_date}T14:30:00Z",
                route="oral",
                compliance_pct=100.0,
                created_at=f"{v_m12_7.actual_date}T14:35:00Z",
            )
            dosing_events.append(second_dose)
            deviations.append(
                make_dev(
                    p7, "DOSE-005", v_m12_7,
                    custom_desc="Double-dosing within 24-hour window: Two 10 mg doses recorded on same calendar day.",
                    expected="1 dose / 24h",
                    actual="2 doses on same day",
                )
            )

            # Dosing Anomaly 5: DOSE-001 - First dose missing at Randomisation (PT-104-009 at V-RAND)
            p9 = s104_patients[8]
            v_rand_9 = visits_by_patient[p9.patient_id]["V-RAND"]
            # Remove the V-RAND dose for patient 9
            if p9.patient_id in dosing_by_patient and "V-RAND" in dosing_by_patient[p9.patient_id]:
                target_dose = dosing_by_patient[p9.patient_id]["V-RAND"]
                dosing_events.remove(target_dose)
            deviations.append(
                make_dev(
                    p9, "DOSE-001", v_rand_9,
                    custom_desc="First dose missing: Active-arm patient had no dispensing record at randomisation visit.",
                    expected="10 mg dispensed at V-RAND",
                    actual="No dispensing record",
                )
            )

            # Dosing Anomaly 6: DOSE-002 - Sustained low compliance < 50% escalates to major (PT-104-002 at V-M12)
            p2 = s104_patients[1]
            v_m12_2 = visits_by_patient[p2.patient_id]["V-M12"]
            dose2 = dosing_by_patient[p2.patient_id]["V-M12"]
            dose2.compliance_pct = 42.0
            deviations.append(
                make_dev(
                    p2, "DOSE-002", v_m12_2,
                    custom_desc="Severe non-compliance: Pill count compliance 42.0% (<50% escalates to major).",
                    expected=">= 70%",
                    actual="42.0%",
                    severity_override="major",
                )
            )

            # Prohibited Med 1: MED-001 - Concomitant SGLT2 inhibitor empagliflozin (PT-104-004)
            p4 = s104_patients[3]
            med_emp = Medication(
                med_id=f"MED-{p4.patient_code}-PROHIB-SGLT2",
                patient_id=p4.patient_id,
                drug_name="Empagliflozin (Jardiance)",
                drug_class="SGLT2 inhibitor",
                start_date=f"{int(p4.enrollment_date[:4])+1}-04-10",
                end_date=None,
                dose="25 mg once daily",
                indication="Type 2 Diabetes Mellitus",
                reported_by="Outside Physician",
                created_at=f"{int(p4.enrollment_date[:4])+1}-04-15T09:00:00Z",
            )
            medications.append(med_emp)
            deviations.append(
                make_dev(
                    p4, "MED-001", None,
                    dev_date=med_emp.start_date,
                    custom_desc="Prohibited concomitant SGLT2 inhibitor: Empagliflozin 25 mg prescribed concurrently.",
                    expected="No concomitant SGLT2 inhibitors",
                    actual="Empagliflozin 25 mg QD",
                )
            )

            # Prohibited Med 2: MED-003 - Warfarin initiation without notification (PT-104-006)
            p6 = s104_patients[5]
            med_warf = Medication(
                med_id=f"MED-{p6.patient_code}-PROHIB-WARFARIN",
                patient_id=p6.patient_id,
                drug_name="Warfarin Sodium",
                drug_class="vitamin_K_antagonist",
                start_date=f"{int(p6.enrollment_date[:4])+1}-07-22",
                end_date=None,
                dose="5 mg once daily",
                indication="Atrial Fibrillation",
                reported_by="Outside Cardiologist",
                created_at=f"{int(p6.enrollment_date[:4])+1}-07-25T10:00:00Z",
            )
            medications.append(med_warf)
            deviations.append(
                make_dev(
                    p6, "MED-003", None,
                    dev_date=med_warf.start_date,
                    custom_desc="Warfarin initiation without medical monitor notification or required INR safety monitoring.",
                    expected="Medical monitor notification & INR tracking",
                    actual="Warfarin started without notification",
                )
            )

            # Missed Safety Visits: 4 events (PT-104-008 & PT-104-010 missed V-M6 + missing safety eGFR)
            p8 = s104_patients[7]
            v_m6_8 = visits_by_patient[p8.patient_id]["V-M6"]
            v_m6_8.status = "missed"
            v_m6_8.actual_date = None
            v_m6_8.data_entry_date = None
            deviations.append(
                make_dev(
                    p8, "VISIT-003", v_m6_8,
                    dev_date=v_m6_8.scheduled_date,
                    custom_desc="Safety-critical Month 6 follow-up visit missed.",
                    expected="Completed within Day 168 to 196",
                    actual="Visit missed",
                )
            )
            # LAB-003: eGFR missing at safety-critical visit
            deviations.append(
                make_dev(
                    p8, "LAB-003", v_m6_8,
                    dev_date=v_m6_8.scheduled_date,
                    custom_desc="Mandatory safety eGFR assessment absent due to missed visit.",
                    expected="eGFR (CKD-EPI) present",
                    actual="NULL (test not performed)",
                )
            )

            p10 = s104_patients[9]
            v_m6_10 = visits_by_patient[p10.patient_id]["V-M6"]
            v_m6_10.status = "missed"
            v_m6_10.actual_date = None
            v_m6_10.data_entry_date = None
            deviations.append(
                make_dev(
                    p10, "VISIT-003", v_m6_10,
                    dev_date=v_m6_10.scheduled_date,
                    custom_desc="Safety-critical Month 6 follow-up visit missed.",
                    expected="Completed within Day 168 to 196",
                    actual="Visit missed",
                )
            )
            deviations.append(
                make_dev(
                    p10, "LAB-003", v_m6_10,
                    dev_date=v_m6_10.scheduled_date,
                    custom_desc="Mandatory safety eGFR assessment absent due to missed visit.",
                    expected="eGFR (CKD-EPI) present",
                    actual="NULL (test not performed)",
                )
            )

        # =========================================================================
        # 2. SITE 102 (MEDIUM RISK): 12 Late Data Entry Deviations (PROC-003)
        # =========================================================================
        s102_patients = [p for p in patients if p.site_id == "SITE-102"]
        late_count = 0
        for pat in s102_patients:
            for v_type in ["V-RAND", "V-M2"]:
                v = visits_by_patient[pat.patient_id].get(v_type)
                if v and v.actual_date and late_count < 12:
                    act_dt = datetime.strptime(v.actual_date, "%Y-%m-%d")
                    # Delay eCRF entry by 11 to 18 business days (threshold is 5)
                    lag_business_days = self.rng.randint(11, 18)
                    v.data_entry_date = add_business_days(act_dt, lag_business_days).strftime("%Y-%m-%dT%H:%M:%SZ")
                    deviations.append(
                        make_dev(
                            pat, "PROC-003", v,
                            custom_desc=f"eCRF data entry lag: Data entered {lag_business_days} business days post-visit (limit 5).",
                            expected="<= 5 business days",
                            actual=f"{lag_business_days} business days",
                        )
                    )
                    late_count += 1

        # =========================================================================
        # 3. SITE 107 (MEDIUM RISK): 2 Prohibited Warfarin, 3 Missed Visits
        # =========================================================================
        s107_patients = [p for p in patients if p.site_id == "SITE-107"]
        if len(s107_patients) >= 6:
            # 2 Prohibited Warfarin starts without notification
            for idx in [0, 1]:
                pat = s107_patients[idx]
                med_w = Medication(
                    med_id=f"MED-{pat.patient_code}-WARFARIN",
                    patient_id=pat.patient_id,
                    drug_name="Warfarin",
                    drug_class="vitamin_K_antagonist",
                    start_date=f"{int(pat.enrollment_date[:4])+1}-02-14",
                    end_date=None,
                    dose="5 mg QD",
                    indication="DVT prophylaxis",
                    reported_by="Hospital Discharge",
                    created_at=f"{int(pat.enrollment_date[:4])+1}-02-18T11:00:00Z",
                )
                medications.append(med_w)
                deviations.append(
                    make_dev(
                        pat, "MED-003", None,
                        dev_date=med_w.start_date,
                        custom_desc="Warfarin initiation without required Medical Monitor notification or INR monitoring record.",
                        expected="Medical monitor notification recorded",
                        actual="Warfarin started without notification",
                    )
                )

            # 3 Missed visits (PT-107-003, PT-107-004, PT-107-005 at V-M12 or V-M2)
            for idx in [2, 3, 4]:
                pat = s107_patients[idx]
                v_target = visits_by_patient[pat.patient_id]["V-M12"]
                v_target.status = "missed"
                v_target.actual_date = None
                v_target.data_entry_date = None
                deviations.append(
                    make_dev(
                        pat, "VISIT-004", v_target,
                        dev_date=v_target.scheduled_date,
                        custom_desc="Annual assessment visit V-M12 missed by patient.",
                        expected="Completed within Day 351 to 379",
                        actual="Visit missed",
                    )
                )

        # =========================================================================
        # 4. SITE 110 (MEDIUM RISK): 5 Visit Window Violations, 2 Missed Non-Safety Labs
        # =========================================================================
        s110_patients = [p for p in patients if p.site_id == "SITE-110"]
        if len(s110_patients) >= 7:
            # 5 Visit Window Violations
            # 2 at Month 2 (VISIT-002: Day 53 to Day 67) -> conducted on Day 76
            for idx in [0, 1]:
                pat = s110_patients[idx]
                v_m2 = visits_by_patient[pat.patient_id]["V-M2"]
                enr_dt = datetime.strptime(pat.enrollment_date, "%Y-%m-%d")
                late_actual = enr_dt + timedelta(days=76)
                v_m2.actual_date = late_actual.strftime("%Y-%m-%d")
                deviations.append(
                    make_dev(
                        pat, "VISIT-002", v_m2,
                        custom_desc="Month 2 visit window exceeded: Conducted on Day 76 post-randomisation (window Day 53–67).",
                        expected="Day 53 to Day 67",
                        actual="Day 76 (+9 days)",
                    )
                )

            # 3 at Month 12 (VISIT-004: Day 351 to Day 379) -> conducted on Day 398
            for idx in [2, 3, 4]:
                pat = s110_patients[idx]
                v_m12 = visits_by_patient[pat.patient_id]["V-M12"]
                enr_dt = datetime.strptime(pat.enrollment_date, "%Y-%m-%d")
                late_actual = enr_dt + timedelta(days=398)
                v_m12.actual_date = late_actual.strftime("%Y-%m-%d")
                deviations.append(
                    make_dev(
                        pat, "VISIT-004", v_m12,
                        custom_desc="Month 12 annual assessment visit window exceeded: Conducted on Day 398 (window Day 351–379).",
                        expected="Day 351 to Day 379",
                        actual="Day 398 (+19 days)",
                    )
                )

            # 2 Missed Non-Safety Labs: HbA1c not performed at V-M2
            for idx in [5, 6]:
                pat = s110_patients[idx]
                v_m2 = visits_by_patient[pat.patient_id]["V-M2"]
                # Remove HbA1c from lab_results
                pat_labs = [l for l in lab_results if l.patient_id == pat.patient_id and l.visit_id == v_m2.visit_id and l.test_code == "HBA1C"]
                for pl in pat_labs:
                    lab_results.remove(pl)
                deviations.append(
                    make_dev(
                        pat, "LAB-001", v_m2,
                        custom_desc="Required non-safety follow-up laboratory assessment (HbA1c) omitted at Month 2 visit.",
                        expected="HbA1c test completed",
                        actual="Test missing",
                        severity_override="minor",
                    )
                )

        # =========================================================================
        # 5. SITE 105 (MEDIUM RISK): 1 Eligibility Violation, 1 Consent Re-sign Delay
        # =========================================================================
        s105_patients = [p for p in patients if p.site_id == "SITE-105"]
        if len(s105_patients) >= 3:
            # 1 Eligibility Violation: LAB-002 screening eGFR = 48.0 (< 60.0), enrolled anyway
            p_elig = s105_patients[0]
            v_scr = visits_by_patient[p_elig.patient_id]["V-SCREEN"]
            p_elig.baseline_egfr = 48.0
            # Update the screening lab result
            for l in lab_results:
                if l.patient_id == p_elig.patient_id and l.visit_id == v_scr.visit_id and l.test_code == "eGFR_CKD_EPI":
                    l.result_value = 48.0
                    break
            deviations.append(
                make_dev(
                    p_elig, "LAB-002", v_scr,
                    custom_desc="Eligibility criterion violation: Patient enrolled with screening eGFR 48.0 mL/min/1.73m2 (< 60.0 required by IC-04).",
                    expected=">= 60.0 mL/min/1.73m2",
                    actual="48.0 mL/min/1.73m2",
                    severity_override="major",
                )
            )

            # 1 Consent Re-sign Delay: PROC-002 re-consent signed 28 days after Amendment 4 (limit 14)
            p_cns = s105_patients[2]
            amendment_dt = datetime(2015, 6, 1)
            delayed_cns_dt = amendment_dt + timedelta(days=28)
            for c in consent_records:
                if c.patient_id == p_cns.patient_id and c.consent_type == "amendment_reconsent":
                    c.consent_date = delayed_cns_dt.strftime("%Y-%m-%d")
                    break
            deviations.append(
                make_dev(
                    p_cns, "PROC-002", None,
                    dev_date=delayed_cns_dt.strftime("%Y-%m-%d"),
                    custom_desc="Protocol Amendment 4 re-consent delayed: Signed 28 days post-effective date (limit 14 days).",
                    expected="<= 14 days post-amendment",
                    actual="28 days",
                    severity_override="administrative",
                )
            )

        # =========================================================================
        # 6. BENCHMARK CLEAN SITES: Sites 101, 103, 106, 108, 109
        # Isolated single minor window delay to mirror realistic high-performing sites
        # =========================================================================
        clean_site_ids = ["SITE-101", "SITE-103", "SITE-106", "SITE-108", "SITE-109"]
        for s_id in clean_site_ids:
            s_pats = [p for p in patients if p.site_id == s_id]
            if s_pats:
                # 1 minor window shift: Month 2 conducted 2 days late (Day 69 instead of 67)
                pat = s_pats[0]
                v_m2 = visits_by_patient[pat.patient_id]["V-M2"]
                enr_dt = datetime.strptime(pat.enrollment_date, "%Y-%m-%d")
                v_m2.actual_date = (enr_dt + timedelta(days=69)).strftime("%Y-%m-%d")
                deviations.append(
                    make_dev(
                        pat, "VISIT-002", v_m2,
                        custom_desc="Minor visit window exceeded: Month 2 completed on Day 69 (window upper limit Day 67).",
                        expected="Day 53 to Day 67",
                        actual="Day 69 (+2 days)",
                        severity_override="minor",
                    )
                )

        return deviations
