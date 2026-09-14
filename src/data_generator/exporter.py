"""Dataset Exporter supporting JSON, CSV, and PostgreSQL seed SQL."""

import csv
import json
from pathlib import Path
from typing import List, Dict, Any
from .models import DatasetBundle


class DatasetExporter:
    """Exports generated dataset into multiple storage and interchange formats."""

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.csv_dir = self.output_dir / "csv"
        self.csv_dir.mkdir(parents=True, exist_ok=True)

    def export_all(self, bundle: DatasetBundle) -> Dict[str, str]:
        """Runs JSON, CSV, and SQL export pipeline."""
        exported_files = {}

        # 1. Export JSON files
        exported_files.update(self.export_json(bundle))

        # 2. Export CSV files
        exported_files.update(self.export_csv(bundle))

        # 3. Export SQL seed
        sql_path = self.export_sql(bundle)
        exported_files["seed.sql"] = str(sql_path)

        return exported_files

    def export_json(self, bundle: DatasetBundle) -> Dict[str, str]:
        """Exports individual JSON entity files and consolidated dataset bundle."""
        results = {}

        entities = {
            "sites.json": [s.to_dict() for s in bundle.sites],
            "patients.json": [p.to_dict() for p in bundle.patients],
            "visits.json": [v.to_dict() for v in bundle.visits],
            "dosing_events.json": [d.to_dict() for d in bundle.dosing_events],
            "lab_results.json": [l.to_dict() for l in bundle.lab_results],
            "medications.json": [m.to_dict() for m in bundle.medications],
            "consent_records.json": [c.to_dict() for c in bundle.consent_records],
            "deviations.json": [dev.to_dict() for dev in bundle.deviations],
        }

        for filename, data in entities.items():
            path = self.output_dir / filename
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            results[filename] = str(path)

        # Consolidated bundle
        bundle_dict = {
            "trial_metadata": bundle.protocol_meta,
            "summary": bundle.summary(),
            "sites": [s.to_dict() for s in bundle.sites],
            "patients": [p.to_dict() for p in bundle.patients],
            "visits": [v.to_dict() for v in bundle.visits],
            "dosing_events": [d.to_dict() for d in bundle.dosing_events],
            "lab_results": [l.to_dict() for l in bundle.lab_results],
            "medications": [m.to_dict() for m in bundle.medications],
            "consent_records": [c.to_dict() for c in bundle.consent_records],
            "deviations": [dev.to_dict() for dev in bundle.deviations],
        }
        bundle_path = self.output_dir / "trialguard_dataset.json"
        with open(bundle_path, "w", encoding="utf-8") as f:
            json.dump(bundle_dict, f, indent=2)
        results["trialguard_dataset.json"] = str(bundle_path)

        return results

    def export_csv(self, bundle: DatasetBundle) -> Dict[str, str]:
        """Exports entities as CSV files."""
        results = {}

        tables = {
            "sites.csv": [s.to_dict() for s in bundle.sites],
            "patients.csv": [p.to_dict() for p in bundle.patients],
            "visits.csv": [v.to_dict() for v in bundle.visits],
            "dosing_events.csv": [d.to_dict() for d in bundle.dosing_events],
            "lab_results.csv": [l.to_dict() for l in bundle.lab_results],
            "medications.csv": [m.to_dict() for m in bundle.medications],
            "consent_records.csv": [c.to_dict() for c in bundle.consent_records],
            "deviations.csv": [dev.to_dict() for dev in bundle.deviations],
        }

        for filename, rows in tables.items():
            if not rows:
                continue
            path = self.csv_dir / filename
            fieldnames = list(rows[0].keys())
            with open(path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            results[f"csv/{filename}"] = str(path)

        return results

    def export_sql(self, bundle: DatasetBundle) -> Path:
        """Generates PostgreSQL DDL and INSERT statements matching root.md Section C."""
        sql_path = self.output_dir / "seed.sql"

        def sql_val(val: Any) -> str:
            if val is None:
                return "NULL"
            if isinstance(val, bool):
                return "TRUE" if val else "FALSE"
            if isinstance(val, (int, float)):
                return str(val)
            escaped = str(val).replace("'", "''")
            return f"'{escaped}'"

        lines = [
            "-- =============================================================================",
            "-- TrialGuard Seed Data — DECLARE-TIMI 58 (NCT01986881)",
            "-- Generated strictly from protocol.json and protocol_rules.json",
            "-- =============================================================================",
            "BEGIN;\n",
        ]

        # Sites
        lines.append("-- Sites")
        for s in bundle.sites:
            lines.append(
                f"INSERT INTO sites (site_id, site_name, country, investigator, activation_date, patient_count, status, created_at) "
                f"VALUES ({sql_val(s.site_id)}, {sql_val(s.site_name)}, {sql_val(s.country)}, {sql_val(s.investigator)}, "
                f"{sql_val(s.activation_date)}, {s.patient_count}, {sql_val(s.status)}, {sql_val(s.created_at)}) "
                f"ON CONFLICT (site_id) DO NOTHING;"
            )

        # Patients
        lines.append("\n-- Patients")
        for p in bundle.patients:
            lines.append(
                f"INSERT INTO patients (patient_id, site_id, patient_code, enrollment_date, arm, status, date_of_birth, sex, created_at) "
                f"VALUES ({sql_val(p.patient_id)}, {sql_val(p.site_id)}, {sql_val(p.patient_code)}, {sql_val(p.enrollment_date)}, "
                f"{sql_val(p.arm)}, {sql_val(p.status)}, {sql_val(p.date_of_birth)}, {sql_val(p.sex)}, {sql_val(p.created_at)}) "
                f"ON CONFLICT (patient_id) DO NOTHING;"
            )

        # Visits
        lines.append("\n-- Visits")
        for v in bundle.visits:
            lines.append(
                f"INSERT INTO visits (visit_id, patient_id, site_id, visit_number, visit_type, scheduled_date, actual_date, status, data_entry_date, created_at) "
                f"VALUES ({sql_val(v.visit_id)}, {sql_val(v.patient_id)}, {sql_val(v.site_id)}, {v.visit_number}, {sql_val(v.visit_type)}, "
                f"{sql_val(v.scheduled_date)}, {sql_val(v.actual_date)}, {sql_val(v.status)}, {sql_val(v.data_entry_date)}, {sql_val(v.created_at)}) "
                f"ON CONFLICT (visit_id) DO NOTHING;"
            )

        # Dosing Events
        lines.append("\n-- Dosing Events")
        for d in bundle.dosing_events:
            lines.append(
                f"INSERT INTO dosing_events (dose_id, visit_id, patient_id, drug_code, scheduled_dose, actual_dose, dose_unit, administered_by, administration_date, route, created_at) "
                f"VALUES ({sql_val(d.dose_id)}, {sql_val(d.visit_id)}, {sql_val(d.patient_id)}, {sql_val(d.drug_code)}, {d.scheduled_dose}, {d.actual_dose}, "
                f"{sql_val(d.dose_unit)}, {sql_val(d.administered_by)}, {sql_val(d.administration_date)}, {sql_val(d.route)}, {sql_val(d.created_at)}) "
                f"ON CONFLICT (dose_id) DO NOTHING;"
            )

        # Lab Results
        lines.append("\n-- Lab Results")
        for l in bundle.lab_results:
            lines.append(
                f"INSERT INTO lab_results (lab_id, visit_id, patient_id, test_code, test_name, result_value, result_unit, normal_low, normal_high, result_date, created_at) "
                f"VALUES ({sql_val(l.lab_id)}, {sql_val(l.visit_id)}, {sql_val(l.patient_id)}, {sql_val(l.test_code)}, {sql_val(l.test_name)}, {sql_val(l.result_value)}, "
                f"{sql_val(l.result_unit)}, {sql_val(l.normal_low)}, {sql_val(l.normal_high)}, {sql_val(l.result_date)}, {sql_val(l.created_at)}) "
                f"ON CONFLICT (lab_id) DO NOTHING;"
            )

        # Medications
        lines.append("\n-- Medications")
        for m in bundle.medications:
            lines.append(
                f"INSERT INTO medications (med_id, patient_id, drug_name, drug_class, start_date, end_date, dose, indication, reported_by, created_at) "
                f"VALUES ({sql_val(m.med_id)}, {sql_val(m.patient_id)}, {sql_val(m.drug_name)}, {sql_val(m.drug_class)}, {sql_val(m.start_date)}, {sql_val(m.end_date)}, "
                f"{sql_val(m.dose)}, {sql_val(m.indication)}, {sql_val(m.reported_by)}, {sql_val(m.created_at)}) "
                f"ON CONFLICT (med_id) DO NOTHING;"
            )

        # Deviations
        lines.append("\n-- Deviations")
        for dev in bundle.deviations:
            lines.append(
                f"INSERT INTO deviations (deviation_id, patient_id, site_id, visit_id, rule_id, deviation_date, description, expected_value, actual_value, severity, severity_source, status, detected_at, detected_by, created_at) "
                f"VALUES ({sql_val(dev.deviation_id)}, {sql_val(dev.patient_id)}, {sql_val(dev.site_id)}, {sql_val(dev.visit_id)}, {sql_val(dev.rule_id)}, {sql_val(dev.deviation_date)}, "
                f"{sql_val(dev.description)}, {sql_val(dev.expected_value)}, {sql_val(dev.actual_value)}, {sql_val(dev.severity)}, {sql_val(dev.severity_source)}, {sql_val(dev.status)}, "
                f"{sql_val(dev.detected_at)}, {sql_val(dev.detected_by)}, {sql_val(dev.created_at)}) "
                f"ON CONFLICT (deviation_id) DO NOTHING;"
            )

        lines.append("\nCOMMIT;\n")

        with open(sql_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return sql_path
