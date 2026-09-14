"""Generates baseline and longitudinal clinical events: dosing, labs, medications, and consents."""

import random
from datetime import datetime, timedelta
from typing import List, Tuple
from .models import Patient, Visit, DosingEvent, LabResult, Medication, ConsentRecord
from .protocol_loader import ProtocolLoader


class ClinicalEventsGenerator:
    """Generates protocol-compliant clinical events for each patient."""

    def __init__(self, loader: ProtocolLoader, rng: random.Random):
        self.loader = loader
        self.rng = rng

    def generate_events_for_patient(
        self, patient: Patient, visits: List[Visit]
    ) -> Tuple[List[DosingEvent], List[LabResult], List[Medication], List[ConsentRecord]]:
        """Generates all compliant clinical events for a patient."""
        dosing_events: List[DosingEvent] = []
        lab_results: List[LabResult] = []
        medications: List[Medication] = []
        consent_records: List[ConsentRecord] = []

        # Map visits by visit_type
        visit_map = {v.visit_type: v for v in visits}

        # 1. Consent Records
        # PROC-001: Initial consent signed on or before screening visit
        screen_visit = visit_map["V-SCREEN"]
        screen_dt = datetime.strptime(screen_visit.actual_date or screen_visit.scheduled_date, "%Y-%m-%d")
        consent_dt = screen_dt - timedelta(days=self.rng.randint(0, 3))
        consent_records.append(
            ConsentRecord(
                consent_id=f"CNS-{patient.patient_code}-01",
                patient_id=patient.patient_id,
                consent_type="initial_icf",
                consent_date=consent_dt.strftime("%Y-%m-%d"),
                version="v1.0",
                signed=True,
                created_at=f"{consent_dt.strftime('%Y-%m-%d')}T09:00:00Z",
            )
        )

        # PROC-002: Protocol Amendment 4 Re-consent (effective 2015-06-01)
        # Compliant: signed within 14 days (e.g., 2015-06-08)
        amendment_dt = datetime(2015, 6, 1)
        reconsent_dt = amendment_dt + timedelta(days=self.rng.randint(3, 10))
        consent_records.append(
            ConsentRecord(
                consent_id=f"CNS-{patient.patient_code}-02",
                patient_id=patient.patient_id,
                consent_type="amendment_reconsent",
                consent_date=reconsent_dt.strftime("%Y-%m-%d"),
                version="Amendment 4",
                signed=True,
                created_at=f"{reconsent_dt.strftime('%Y-%m-%d')}T10:30:00Z",
            )
        )

        # 2. Dosing Events (Dispensed at V-RAND, V-M2, V-M6, V-M12, V-EOS)
        dosing_visits = ["V-RAND", "V-M2", "V-M6", "V-M12", "V-EOS"]
        is_active = patient.arm == "ARM-ACTIVE"
        drug_code = "DAPAGLI-10" if is_active else "PLACEBO-0"
        expected_dose = 10.0 if is_active else 0.0

        for v_type in dosing_visits:
            v = visit_map.get(v_type)
            if not v or v.actual_date is None:
                continue

            # Compliant compliance rate: 88% to 99% (satisfies DOSE-002 >= 70%)
            compliance = round(self.rng.uniform(88.0, 99.5), 1)

            dose = DosingEvent(
                dose_id=f"DOS-{patient.patient_code}-{v_type}",
                visit_id=v.visit_id,
                patient_id=patient.patient_id,
                drug_code=drug_code,
                scheduled_dose=expected_dose,
                actual_dose=expected_dose,
                dose_unit="mg",
                administered_by="Study Coordinator",
                administration_date=f"{v.actual_date}T09:30:00Z",
                route="oral",  # Mandatory per DOSE-004
                compliance_pct=compliance,
                created_at=f"{v.actual_date}T10:00:00Z",
            )
            dosing_events.append(dose)

        # 3. Lab Results
        # Screening labs: HbA1c (LAB-001) & eGFR (LAB-002)
        if screen_visit and screen_visit.actual_date:
            s_date = screen_visit.actual_date
            lab_results.append(
                LabResult(
                    lab_id=f"LAB-{patient.patient_code}-SCR-HBA1C",
                    visit_id=screen_visit.visit_id,
                    patient_id=patient.patient_id,
                    test_code="HBA1C",
                    test_name="Hemoglobin A1c",
                    result_value=patient.baseline_hba1c,
                    result_unit="%",
                    normal_low=4.0,
                    normal_high=5.6,
                    result_date=s_date,
                    created_at=f"{s_date}T11:00:00Z",
                )
            )
            lab_results.append(
                LabResult(
                    lab_id=f"LAB-{patient.patient_code}-SCR-EGFR",
                    visit_id=screen_visit.visit_id,
                    patient_id=patient.patient_id,
                    test_code="eGFR_CKD_EPI",
                    test_name="Estimated GFR (CKD-EPI)",
                    result_value=patient.baseline_egfr,
                    result_unit="mL/min/1.73m2",
                    normal_low=60.0,
                    normal_high=120.0,
                    result_date=s_date,
                    created_at=f"{s_date}T11:00:00Z",
                )
            )

        # Longitudinal labs at subsequent visits
        for v_type in ["V-RAND", "V-M2", "V-M6", "V-M12", "V-EOS"]:
            v = visit_map.get(v_type)
            if not v or v.actual_date is None:
                continue

            # Small realistic drift over time
            hba1c_val = round(patient.baseline_hba1c + self.rng.uniform(-0.6, 0.4), 2)
            egfr_val = round(patient.baseline_egfr + self.rng.uniform(-4.0, 3.0), 1)

            lab_results.append(
                LabResult(
                    lab_id=f"LAB-{patient.patient_code}-{v_type}-HBA1C",
                    visit_id=v.visit_id,
                    patient_id=patient.patient_id,
                    test_code="HBA1C",
                    test_name="Hemoglobin A1c",
                    result_value=hba1c_val,
                    result_unit="%",
                    normal_low=4.0,
                    normal_high=5.6,
                    result_date=v.actual_date,
                    created_at=f"{v.actual_date}T11:00:00Z",
                )
            )
            # Safety eGFR (LAB-003 safety-critical monitoring at V-M6, V-M12, V-EOS)
            lab_results.append(
                LabResult(
                    lab_id=f"LAB-{patient.patient_code}-{v_type}-EGFR",
                    visit_id=v.visit_id,
                    patient_id=patient.patient_id,
                    test_code="eGFR_CKD_EPI",
                    test_name="Estimated GFR (CKD-EPI)",
                    result_value=egfr_val,
                    result_unit="mL/min/1.73m2",
                    normal_low=60.0,
                    normal_high=120.0,
                    result_date=v.actual_date,
                    created_at=f"{v.actual_date}T11:00:00Z",
                )
            )

        # 4. Concomitant Medications (Standard compliant diabetes & CV therapies)
        enrollment_date = patient.enrollment_date
        # Metformin (Standard baseline T2DM therapy)
        medications.append(
            Medication(
                med_id=f"MED-{patient.patient_code}-01",
                patient_id=patient.patient_id,
                drug_name="Metformin Hydrochloride",
                drug_class="biguanide",
                start_date=f"{int(enrollment_date[:4])-2}-03-15",
                end_date=None,
                dose="1000 mg twice daily",
                indication="Type 2 Diabetes Mellitus",
                reported_by="Investigator",
                created_at=f"{enrollment_date}T08:00:00Z",
            )
        )
        # Atorvastatin (CV risk reduction)
        medications.append(
            Medication(
                med_id=f"MED-{patient.patient_code}-02",
                patient_id=patient.patient_id,
                drug_name="Atorvastatin Calcium",
                drug_class="statin",
                start_date=f"{int(enrollment_date[:4])-1}-06-01",
                end_date=None,
                dose="40 mg once daily",
                indication="Hyperlipidemia / Primary CV prevention",
                reported_by="Investigator",
                created_at=f"{enrollment_date}T08:00:00Z",
            )
        )
        # Lisinopril (ACE inhibitor for hypertension / nephroprotection)
        medications.append(
            Medication(
                med_id=f"MED-{patient.patient_code}-03",
                patient_id=patient.patient_id,
                drug_name="Lisinopril",
                drug_class="ACE_inhibitor",
                start_date=f"{int(enrollment_date[:4])-3}-01-10",
                end_date=None,
                dose="20 mg once daily",
                indication="Hypertension",
                reported_by="Investigator",
                created_at=f"{enrollment_date}T08:00:00Z",
            )
        )
        # If baseline insulin was true, record compliant baseline insulin
        if patient.baseline_insulin:
            medications.append(
                Medication(
                    med_id=f"MED-{patient.patient_code}-04",
                    patient_id=patient.patient_id,
                    drug_name="Insulin Glargine",
                    drug_class="insulin",
                    start_date=f"{int(enrollment_date[:4])-1}-11-01",
                    end_date=None,
                    dose="24 units subcutaneous once daily at bedtime",
                    indication="Type 2 Diabetes Mellitus (baseline insulin)",
                    reported_by="Investigator",
                    created_at=f"{enrollment_date}T08:00:00Z",
                )
            )

        return dosing_events, lab_results, medications, consent_records
