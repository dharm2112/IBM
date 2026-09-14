"""Visit schedule generator based on canonical protocol visit windows."""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from .models import Patient, Visit
from .protocol_loader import ProtocolLoader


def add_business_days(start_date: datetime, num_business_days: int) -> datetime:
    """Adds a number of business days (Mon-Fri) to a starting date."""
    current = start_date
    added = 0
    while added < num_business_days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Monday to Friday
            added += 1
    return current


class VisitScheduleGenerator:
    """Generates the 6 protocol visits for each patient."""

    def __init__(self, loader: ProtocolLoader, rng: random.Random):
        self.loader = loader
        self.rng = rng
        self.visit_specs = self.loader.visits

    def generate_visits_for_patient(self, patient: Patient) -> List[Visit]:
        """Generates the standard 6 protocol visits for a patient."""
        enrollment_dt = datetime.strptime(patient.enrollment_date, "%Y-%m-%d")
        visits: List[Visit] = []

        for spec in self.visit_specs:
            visit_id = spec["visit_id"]
            visit_number = spec["visit_number"]
            scheduled_day = spec["scheduled_day"]
            window = spec["window"]

            # Compute nominal scheduled date
            scheduled_dt = enrollment_dt + timedelta(days=scheduled_day)
            scheduled_date_str = scheduled_dt.strftime("%Y-%m-%d")

            # Compliant actual visit date within protocol window
            lower_days = window.get("lower_days", 0)
            upper_days = window.get("upper_days", 0)

            # Pick actual day offset within allowed bounds
            if lower_days == 0 and upper_days == 0:
                day_offset = 0
            else:
                # Slight realistic variation within allowed window
                day_offset = self.rng.randint(lower_days, upper_days)

            actual_dt = scheduled_dt + timedelta(days=day_offset)
            actual_date_str = actual_dt.strftime("%Y-%m-%d")

            # Compliant eCRF data entry lag: 1 to 3 business days (within 5-day limit of PROC-003)
            data_entry_lag_days = self.rng.randint(1, 3)
            data_entry_dt = add_business_days(actual_dt, data_entry_lag_days)
            data_entry_str = data_entry_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            visit = Visit(
                visit_id=f"VIS-{patient.patient_code}-{visit_id}",
                patient_id=patient.patient_id,
                site_id=patient.site_id,
                visit_number=visit_number,
                visit_type=visit_id,
                scheduled_date=scheduled_date_str,
                actual_date=actual_date_str,
                status="completed",
                data_entry_date=data_entry_str,
                created_at=f"{scheduled_date_str}T00:00:00Z",
            )
            visits.append(visit)

        return visits
