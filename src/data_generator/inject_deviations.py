"""Injects protocol deviations into normal clinical trial data based on deviation_scenarios.json.

Pipeline:
    NORMAL DATA -> inject_deviations.py -> ABNORMAL CLINICAL EVENTS -> rule_engine -> DEVIATIONS
"""

import json
import re
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from .config import GeneratorConfig
from .models import (
    DatasetBundle,
    Patient,
    Visit,
    DosingEvent,
    LabResult,
    Medication,
    ConsentRecord,
    AuditLog,
    Deviation,
)
from .exporter import DatasetExporter
from .visit_schedule_generator import add_business_days


def parse_filter_string(filter_str: str) -> Dict[str, str]:
    """Parses SQL-like filter string into key-value dictionary.

    Example: "patient_id = 'PT-104-003' AND visit_id = 'V-M2' AND drug_code = 'DAPAGLI-10'"
    Returns: {'patient_id': 'PT-104-003', 'visit_id': 'V-M2', 'drug_code': 'DAPAGLI-10'}
    """
    conditions = {}
    pattern = r"(\w+)\s*=\s*'([^']*)'"
    for match in re.finditer(pattern, filter_str):
        k, v = match.group(1), match.group(2)
        conditions[k] = v
    return conditions


def record_matches(record: Any, criteria: Dict[str, str]) -> bool:
    """Checks if a data object or dict matches the criteria."""
    for key, expected_val in criteria.items():
        if isinstance(record, dict):
            val = record.get(key)
        else:
            val = getattr(record, key, None)

        if key == "visit_id":
            # Support matching visit_type ('V-M2') or full visit_id ('VIS-PT-104-003-V-M2')
            if val != expected_val:
                v_type = getattr(record, "visit_type", None) if not isinstance(record, dict) else record.get("visit_type")
                if v_type != expected_val and (not val or expected_val not in str(val)):
                    return False
        elif key == "patient_id":
            # Support matching patient_id or patient_code
            if val != expected_val:
                p_code = getattr(record, "patient_code", None) if not isinstance(record, dict) else record.get("patient_code")
                if p_code != expected_val:
                    return False
        else:
            if str(val) != str(expected_val):
                return False

    return True


class DeviationInjectorFromScenarios:
    """Reads deviation_scenarios.json and applies mutations to normal clinical data."""

    def __init__(self, scenarios_path: Path):
        self.scenarios_path = Path(scenarios_path)
        if not self.scenarios_path.exists():
            raise FileNotFoundError(f"Deviation scenarios file not found: {self.scenarios_path}")

        with open(self.scenarios_path, "r", encoding="utf-8") as f:
            self.scenarios_data = json.load(f)

        self.clusters = self.scenarios_data.get("clusters", [])
        self.all_scenarios = [s for c in self.clusters for s in c.get("scenarios", [])]

    def apply_scenarios(self, bundle: DatasetBundle) -> Tuple[DatasetBundle, List[Dict[str, Any]]]:
        """Applies all scenarios to the given DatasetBundle and returns modified bundle and manifest."""
        manifest: List[Dict[str, Any]] = []
        deviations: List[Deviation] = []

        patient_map = {p.patient_id: p for p in bundle.patients}
        visits_by_patient: Dict[str, Dict[str, Visit]] = {}
        for v in bundle.visits:
            visits_by_patient.setdefault(v.patient_id, {})[v.visit_type] = v

        scenario_counter = 1

        for cluster in self.clusters:
            cluster_id = cluster.get("cluster_id")
            site_id = f"SITE-{cluster.get('site_id')}"

            for scenario in cluster.get("scenarios", []):
                scn_id = scenario.get("scenario_id")
                rule_id = scenario.get("rule_id")
                mutation = scenario.get("mutation", {})
                table_name = mutation.get("table")
                operation = mutation.get("operation")
                filter_str = mutation.get("filter", "")
                criteria = parse_filter_string(filter_str)

                target_patient_id = scenario.get("patient_id") or criteria.get("patient_id")
                patient = patient_map.get(target_patient_id)
                enrollment_dt = (
                    datetime.strptime(patient.enrollment_date, "%Y-%m-%d")
                    if patient
                    else datetime(2014, 1, 15)
                )

                mutation_applied = False
                details = ""

                # -----------------------------------------------------------------
                # 1. OPERATION: SET
                # -----------------------------------------------------------------
                if operation == "SET":
                    field_name = mutation.get("field")
                    raw_val = mutation.get("value")

                    # Locate matching target table
                    records = getattr(bundle, table_name, [])
                    for rec in records:
                        if record_matches(rec, criteria):
                            old_val = getattr(rec, field_name, None)
                            new_val = self._evaluate_value(raw_val, rec, patient, enrollment_dt, visits_by_patient)
                            setattr(rec, field_name, new_val)

                            # If visit status set to missed, clear dates
                            if table_name == "visits" and field_name == "status" and new_val == "missed":
                                setattr(rec, "actual_date", None)
                                setattr(rec, "data_entry_date", None)

                            # If audit_logs performed_at is updated, also update matching consent_record
                            if table_name == "audit_logs" and field_name == "performed_at":
                                date_part = str(new_val).split("T")[0]
                                for c in bundle.consent_records:
                                    if c.patient_id == target_patient_id:
                                        if rec.action == "consent_signed" and c.consent_type == "initial_icf":
                                            c.consent_date = date_part
                                        elif rec.action == "amendment_reconsent_signed" and c.consent_type == "amendment_reconsent":
                                            c.consent_date = date_part

                            mutation_applied = True
                            details = f"SET {table_name}.{field_name}: {old_val} -> {new_val}"
                            break

                # -----------------------------------------------------------------
                # 2. OPERATION: INSERT
                # -----------------------------------------------------------------
                elif operation == "INSERT":
                    insert_fields = mutation.get("insert_fields", {})
                    if table_name == "medications":
                        start_date_expr = insert_fields.get("start_date", "")
                        start_date = self._evaluate_date_expression(start_date_expr, enrollment_dt)

                        new_med = Medication(
                            med_id=f"MED-{target_patient_id}-SCN-{scn_id}",
                            patient_id=target_patient_id,
                            drug_name=insert_fields.get("drug_name", "Prohibited Drug"),
                            drug_class=insert_fields.get("drug_class", "Prohibited Class"),
                            start_date=start_date,
                            end_date=insert_fields.get("end_date"),
                            dose=insert_fields.get("dose", "10 mg QD"),
                            indication=insert_fields.get("indication", "Concomitant Therapy"),
                            reported_by=insert_fields.get("reported_by", "Investigator"),
                            created_at=f"{start_date}T08:00:00Z",
                        )
                        bundle.medications.append(new_med)
                        mutation_applied = True
                        details = f"INSERT medications: {new_med.drug_name} ({new_med.drug_class}) on {start_date}"

                # -----------------------------------------------------------------
                # 3. OPERATION: INSERT_DUPLICATE
                # -----------------------------------------------------------------
                elif operation == "INSERT_DUPLICATE":
                    dup_fields = mutation.get("duplicate_fields", {})
                    if table_name == "dosing_events":
                        # Find existing record to duplicate date
                        matched = [d for d in bundle.dosing_events if record_matches(d, criteria)]
                        base_date = patient.enrollment_date
                        visit_id = criteria.get("visit_id", "V-M2")
                        if matched:
                            base_date = matched[0].administration_date.split("T")[0]
                            visit_id = matched[0].visit_id

                        second_dose = DosingEvent(
                            dose_id=f"DOS-{target_patient_id}-DUP-{scenario_counter}",
                            visit_id=visit_id,
                            patient_id=target_patient_id,
                            drug_code=dup_fields.get("drug_code", "DAPAGLI-10"),
                            scheduled_dose=float(dup_fields.get("actual_dose", 10.0)),
                            actual_dose=float(dup_fields.get("actual_dose", 10.0)),
                            dose_unit=dup_fields.get("dose_unit", "mg"),
                            administered_by=dup_fields.get("administered_by", "STAFF-NURSE-B"),
                            administration_date=f"{base_date}T15:30:00Z",
                            route=dup_fields.get("route", "oral"),
                            compliance_pct=100.0,
                            created_at=f"{base_date}T15:35:00Z",
                        )
                        bundle.dosing_events.append(second_dose)
                        mutation_applied = True
                        details = f"INSERT_DUPLICATE dosing_events: Second dose on {base_date} for {target_patient_id}"

                # -----------------------------------------------------------------
                # 4. OPERATION: DELETE
                # -----------------------------------------------------------------
                elif operation == "DELETE":
                    records = getattr(bundle, table_name, [])
                    target_to_remove = None
                    for rec in records:
                        if record_matches(rec, criteria):
                            target_to_remove = rec
                            break
                    if target_to_remove:
                        records.remove(target_to_remove)
                        mutation_applied = True
                        details = f"DELETE {table_name}: removed record matching {criteria}"

                # Construct Deviation record matching the scenario
                target_visit_id = scenario.get("visit_id")
                dev_visit_id = None
                if target_visit_id and target_visit_id != "ALL":
                    pat_visits = visits_by_patient.get(target_patient_id, {})
                    v_obj = pat_visits.get(target_visit_id)
                    dev_visit_id = v_obj.visit_id if v_obj else target_visit_id

                exp_desc = scenario.get("expected", {}).get("description") or str(scenario.get("expected", {}))
                act_desc = scenario.get("actual", {}).get("description") or str(scenario.get("actual", {}))

                deviation = Deviation(
                    deviation_id=f"DEV-{scenario_counter:04d}",
                    patient_id=target_patient_id,
                    site_id=site_id,
                    visit_id=dev_visit_id,
                    rule_id=rule_id,
                    deviation_date=patient.enrollment_date if patient else "2014-01-15",
                    description=scenario.get("narrative", f"Violation of {rule_id}"),
                    expected_value=exp_desc,
                    actual_value=act_desc,
                    severity=scenario.get("severity", "minor"),
                    severity_source="rule_engine",
                    status="open",
                    detected_at=f"{patient.enrollment_date if patient else '2014-01-15'}T18:00:00Z",
                    detected_by="system",
                    created_at=f"{patient.enrollment_date if patient else '2014-01-15'}T18:00:00Z",
                )
                deviations.append(deviation)

                manifest_entry = {
                    "scenario_id": scn_id,
                    "cluster_id": cluster_id,
                    "site_id": site_id,
                    "patient_id": target_patient_id,
                    "rule_id": rule_id,
                    "deviation_type": scenario.get("deviation_type"),
                    "table": table_name,
                    "operation": operation,
                    "status": "APPLIED" if mutation_applied else "SKIPPED",
                    "details": details,
                    "severity": scenario.get("severity"),
                    "rule_engine_check": scenario.get("rule_engine_check"),
                }
                manifest.append(manifest_entry)
                scenario_counter += 1

        bundle.deviations = deviations
        return bundle, manifest

    def _evaluate_value(
        self,
        raw_val: Any,
        record: Any,
        patient: Optional[Patient],
        enrollment_dt: datetime,
        visits_by_patient: Dict[str, Dict[str, Visit]],
    ) -> Any:
        """Parses dynamic value expressions like 'actual_date + 9 business days'."""
        if raw_val is None:
            return None
        if isinstance(raw_val, (int, float, bool)):
            return raw_val

        val_str = str(raw_val).strip()

        # Expression: "actual_date + X business days"
        match_biz = re.match(r"actual_date\s*\+\s*(\d+)\s*business days", val_str, re.IGNORECASE)
        if match_biz:
            days = int(match_biz.group(1))
            act_date = getattr(record, "actual_date", None)
            if act_date:
                dt = datetime.strptime(act_date, "%Y-%m-%d")
                return add_business_days(dt, days).strftime("%Y-%m-%dT%H:%M:%SZ")
            return val_str

        # Expression: "enrollment_date + X days" or "ENROLLMENT_DATE + X days"
        match_enr_plus = re.match(r"enrollment_date\s*\+\s*(\d+)\s*days", val_str, re.IGNORECASE)
        if match_enr_plus:
            days = int(match_enr_plus.group(1))
            return (enrollment_dt + timedelta(days=days)).strftime("%Y-%m-%d")

        # Expression: "enrollment_date - X days"
        match_enr_minus = re.match(r"enrollment_date\s*-\s*(\d+)\s*days", val_str, re.IGNORECASE)
        if match_enr_minus:
            days = int(match_enr_minus.group(1))
            return (enrollment_dt - timedelta(days=days)).strftime("%Y-%m-%d")

        # Expression: "V-SCREEN actual_date + X days"
        match_vscr = re.match(r"V-SCREEN\s+actual_date\s*\+\s*(\d+)\s*days", val_str, re.IGNORECASE)
        if match_vscr:
            days = int(match_vscr.group(1))
            if patient:
                p_visits = visits_by_patient.get(patient.patient_id, {})
                v_scr = p_visits.get("V-SCREEN")
                if v_scr and v_scr.actual_date:
                    scr_dt = datetime.strptime(v_scr.actual_date, "%Y-%m-%d")
                    return (scr_dt + timedelta(days=days)).strftime("%Y-%m-%dT09:00:00Z")
            return (enrollment_dt + timedelta(days=days)).strftime("%Y-%m-%dT09:00:00Z")

        # ISO Date or numeric strings
        if re.match(r"^\d{4}-\d{2}-\d{2}$", val_str):
            return f"{val_str}T10:00:00Z"

        try:
            if "." in val_str:
                return float(val_str)
            return int(val_str)
        except ValueError:
            return val_str

    def _evaluate_date_expression(self, expr: str, enrollment_dt: datetime) -> str:
        """Evaluates expressions like 'ENROLLMENT_DATE + 45 days'."""
        match = re.match(r"ENROLLMENT_DATE\s*\+\s*(\d+)\s*days", expr, re.IGNORECASE)
        if match:
            days = int(match.group(1))
            return (enrollment_dt + timedelta(days=days)).strftime("%Y-%m-%d")
        if re.match(r"^\d{4}-\d{2}-\d{2}$", expr):
            return expr
        return enrollment_dt.strftime("%Y-%m-%d")


def inject_deviations_pipeline(
    scenarios_path: Path,
    input_bundle: Optional[DatasetBundle] = None,
    output_dir: Optional[Path] = None,
    config: Optional[GeneratorConfig] = None,
) -> Tuple[DatasetBundle, List[Dict[str, Any]]]:
    """Runs the injection pipeline: NORMAL DATA -> inject_deviations -> ABNORMAL CLINICAL EVENTS."""
    cfg = config or GeneratorConfig()

    # 1. Obtain NORMAL DATA if not provided
    if input_bundle is None:
        from .cli import generate_normal_dataset

        normal_bundle = generate_normal_dataset(cfg)
    else:
        normal_bundle = input_bundle

    # 2. Inject scenarios
    injector = DeviationInjectorFromScenarios(scenarios_path)
    abnormal_bundle, manifest = injector.apply_scenarios(normal_bundle)

    # 3. Export abnormal clinical events
    out_path = Path(output_dir) if output_dir else cfg.output_dir
    exporter = DatasetExporter(out_path)
    exporter.export_all(abnormal_bundle)

    # Export scenario manifest
    manifest_path = out_path / "injected_scenarios.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return abnormal_bundle, manifest


def main():
    parser = argparse.ArgumentParser(
        description="TrialGuard Deviation Injector: Mutates normal clinical data according to deviation_scenarios.json"
    )
    parser.add_argument(
        "--scenarios",
        type=str,
        default="src/protocol/deviations/deviation_scenarios.json",
        help="Path to deviation_scenarios.json",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/abnormal",
        help="Directory to save abnormal clinical events",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    scenarios_path = Path(args.scenarios)
    output_dir = Path(args.output_dir)
    config = GeneratorConfig(random_seed=args.seed, output_dir=output_dir)

    print("=================================================================")
    print(" TrialGuard Deviation Injector")
    print(f" Reading Scenarios: {scenarios_path}")
    print(f" Target Output:     {output_dir}")
    print("=================================================================")
    print(" 1. Generating NORMAL DATA (compliant baseline)...")
    from .cli import generate_normal_dataset

    normal_bundle = generate_normal_dataset(config)
    print(f"    Normal events: {normal_bundle.summary()}")

    print(" 2. Injecting deviations from deviation_scenarios.json...")
    abnormal_bundle, manifest = inject_deviations_pipeline(
        scenarios_path=scenarios_path,
        input_bundle=normal_bundle,
        output_dir=output_dir,
        config=config,
    )

    applied_count = sum(1 for m in manifest if m["status"] == "APPLIED")
    print(f"    Total Scenarios: {len(manifest)}")
    print(f"    Successfully Applied: {applied_count} / {len(manifest)}")
    print(f"    Abnormal Clinical Events saved to: {output_dir.resolve()}")
    print("=================================================================")


if __name__ == "__main__":
    main()
