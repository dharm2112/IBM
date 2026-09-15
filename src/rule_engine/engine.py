"""TrialGuard Deterministic Rule Engine.

Evaluates source clinical events against canonical protocol rules strictly defined in
protocol.json and protocol_rules.json without LLM involvement or pre-populated deviations.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

from .models import DetectedDeviation
from .evaluators import (
    evaluate_dosing_rules,
    evaluate_visit_rules,
    evaluate_medication_rules,
    evaluate_lab_rules,
    evaluate_procedure_rules,
)


class TrialGuardRuleEngine:
    """Deterministic protocol compliance evaluator for clinical trial events."""

    def __init__(
        self,
        rules_path: Optional[Union[str, Path]] = None,
        protocol_path: Optional[Union[str, Path]] = None,
        active_rule_ids: Optional[List[str]] = None,
    ):
        base_dir = Path(__file__).resolve().parents[2]

        # Resolve rules path
        if rules_path:
            self.rules_path = Path(rules_path)
        else:
            candidates = [
                base_dir / "src" / "protocol" / "rules" / "protocol_rules.json",
                base_dir / "src" / "protocol" / "protocol_rules.json",
                base_dir / "protocol_rules.json",
            ]
            self.rules_path = next((p for p in candidates if p.exists()), candidates[0])

        # Resolve protocol path
        if protocol_path:
            self.protocol_path = Path(protocol_path)
        else:
            candidates = [
                base_dir / "src" / "protocol" / "protocol.json",
                base_dir / "src" / "protocol" / "trial_protocol.json",
                base_dir / "protocol.json",
            ]
            self.protocol_path = next((p for p in candidates if p.exists()), candidates[0])

        self.rules: Dict[str, Dict[str, Any]] = {}
        self.protocol_meta: Dict[str, Any] = {}
        self.active_rule_ids = active_rule_ids
        self._load_rules()

    def _load_rules(self) -> None:
        """Loads canonical rule definitions from protocol_rules.json."""
        if not self.rules_path.exists():
            raise FileNotFoundError(f"Rules file not found at: {self.rules_path}")

        with open(self.rules_path, "r", encoding="utf-8") as f:
            rules_data = json.load(f)

        rule_list = rules_data.get("rules", [])
        if self.active_rule_ids is not None:
            self.rules = {r["rule_id"]: r for r in rule_list if r["rule_id"] in self.active_rule_ids}
        else:
            self.rules = {r["rule_id"]: r for r in rule_list}

        if self.protocol_path and self.protocol_path.exists():
            with open(self.protocol_path, "r", encoding="utf-8") as f:
                proto_data = json.load(f)
            self.protocol_meta = proto_data.get("trial_metadata", {})

    def evaluate(self, dataset: Any) -> List[DetectedDeviation]:
        """Evaluates source clinical events and returns all discovered deviations deterministically.

        Accepts either a DatasetBundle object or a dictionary containing:
        'patients', 'visits', 'dosing_events', 'lab_results', 'medications', 'consent_records', 'audit_logs'.
        """
        # Extract tables from DatasetBundle or dict
        if isinstance(dataset, dict):
            patients = dataset.get("patients", [])
            visits = dataset.get("visits", [])
            dosing_events = dataset.get("dosing_events", [])
            lab_results = dataset.get("lab_results", [])
            medications = dataset.get("medications", [])
            consent_records = dataset.get("consent_records", [])
            audit_logs = dataset.get("audit_logs", [])
        else:
            patients = getattr(dataset, "patients", [])
            visits = getattr(dataset, "visits", [])
            dosing_events = getattr(dataset, "dosing_events", [])
            lab_results = getattr(dataset, "lab_results", [])
            medications = getattr(dataset, "medications", [])
            consent_records = getattr(dataset, "consent_records", [])
            audit_logs = getattr(dataset, "audit_logs", [])

        # Sort patients deterministically by patient_id
        def get_pid(p):
            return getattr(p, "patient_id", None) or p.get("patient_id", "")

        sorted_patients = sorted(patients, key=get_pid)

        dev_counter = 0

        def make_dev_id() -> str:
            nonlocal dev_counter
            dev_counter += 1
            return f"DEV-{dev_counter:04d}"

        all_deviations: List[DetectedDeviation] = []

        for patient in sorted_patients:
            # 1. Dosing rules (DOSE-001 through DOSE-005)
            dosing_devs = evaluate_dosing_rules(
                patient, visits, dosing_events, self.rules, make_dev_id
            )
            all_deviations.extend(dosing_devs)

            # 2. Visit window rules (VISIT-001 through VISIT-005)
            visit_devs = evaluate_visit_rules(
                patient, visits, self.rules, make_dev_id
            )
            all_deviations.extend(visit_devs)

            # 3. Medication rules (MED-001 through MED-004)
            med_devs = evaluate_medication_rules(
                patient, medications, self.rules, make_dev_id
            )
            all_deviations.extend(med_devs)

            # 4. Lab rules (LAB-001 through LAB-003)
            lab_devs = evaluate_lab_rules(
                patient, visits, lab_results, self.rules, make_dev_id
            )
            all_deviations.extend(lab_devs)

            # 5. Procedure rules (PROC-001 through PROC-003)
            proc_devs = evaluate_procedure_rules(
                patient, visits, consent_records, audit_logs, self.rules, make_dev_id
            )
            all_deviations.extend(proc_devs)

        return all_deviations
