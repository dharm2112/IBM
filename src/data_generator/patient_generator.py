"""Patient generator adhering strictly to DECLARE-TIMI 58 inclusion/exclusion criteria."""

import random
from datetime import datetime, timedelta
from typing import List, Tuple
from .models import Patient, Site
from .protocol_loader import ProtocolLoader


class PatientGenerator:
    """Generates synthetic patients complying with protocol eligibility rules."""

    def __init__(self, loader: ProtocolLoader, rng: random.Random):
        self.loader = loader
        self.rng = rng

    def generate_patients_for_sites(
        self, sites: List[Site], patients_per_site: int = 10
    ) -> List[Patient]:
        """Generates patient records for all given sites."""
        all_patients: List[Patient] = []

        arms = ["ARM-ACTIVE", "ARM-PLACEBO"]

        for site in sites:
            site_code = site.site_id.split("-")[-1]
            site_activation = datetime.strptime(site.activation_date, "%Y-%m-%d")

            for i in range(1, patients_per_site + 1):
                patient_code = f"PT-{site_code}-{i:03d}"
                patient_id = patient_code

                # Stagger enrollment 14 to 120 days after site activation
                days_after_activation = self.rng.randint(14, 120)
                enrollment_dt = site_activation + timedelta(days=days_after_activation)
                enrollment_date = enrollment_dt.strftime("%Y-%m-%d")

                # Arm: Site 104 patients 1-9 have active dosing scenarios in deviation_scenarios.json
                if site_code == "104":
                    arm = "ARM-ACTIVE" if i <= 9 else "ARM-PLACEBO"
                elif site_code == "103":
                    arm = "ARM-PLACEBO" if i <= 9 else "ARM-ACTIVE"
                else:
                    arm = arms[(i - 1) % 2]

                # Demographic: Age >= 40 at screening (ELIG-001)
                # DECLARE-TIMI 58 average age ~64, range 40-80
                age = self.rng.randint(48, 76)
                # Birth date computed from screening/enrollment date minus age years
                birth_year = enrollment_dt.year - age
                birth_month = self.rng.randint(1, 12)
                birth_day = self.rng.randint(1, 28)
                date_of_birth = f"{birth_year:04d}-{birth_month:02d}-{birth_day:02d}"

                # Sex: ~62% Male / 38% Female per DECLARE-TIMI 58 published baseline
                sex = "M" if self.rng.random() < 0.62 else "F"

                # Baseline clinical markers complying with protocol eligibility
                # ELIG-002: HbA1c 6.5 - 12.0% (typical baseline 7.2 - 9.4%)
                baseline_hba1c = round(self.rng.uniform(7.1, 9.6), 2)

                # ELIG-004: eGFR >= 60 mL/min/1.73 m² (typical baseline 68 - 105)
                baseline_egfr = round(self.rng.uniform(66.0, 104.0), 1)

                # Background insulin: ~40% per published baseline
                baseline_insulin = self.rng.random() < 0.40

                patient = Patient(
                    patient_id=patient_id,
                    site_id=site.site_id,
                    patient_code=patient_code,
                    enrollment_date=enrollment_date,
                    arm=arm,
                    status="completed",  # Default status for completed 4-year study follow-up
                    date_of_birth=date_of_birth,
                    sex=sex,
                    baseline_hba1c=baseline_hba1c,
                    baseline_egfr=baseline_egfr,
                    baseline_insulin=baseline_insulin,
                    diabetes_type="T2DM",
                    has_established_cvd=(self.rng.random() < 0.59),  # 59% established CVD, 41% multiple risk factors
                    created_at=f"{enrollment_date}T08:00:00Z",
                )
                all_patients.append(patient)

        return all_patients
