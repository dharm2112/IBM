"""Loader and validator for canonical protocol.json and protocol_rules.json."""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional


class ProtocolLoader:
    """Loads and indexes the protocol.json and protocol_rules.json files."""

    def __init__(self, protocol_path: Path, rules_path: Path):
        self.protocol_path = Path(protocol_path)
        self.rules_path = Path(rules_path)
        self._protocol: Optional[Dict[str, Any]] = None
        self._rules: Optional[Dict[str, Any]] = None
        self.load()

    def load(self) -> None:
        """Loads JSON files from disk."""
        if not self.protocol_path.exists():
            raise FileNotFoundError(f"Protocol file not found: {self.protocol_path}")
        if not self.rules_path.exists():
            raise FileNotFoundError(f"Protocol rules file not found: {self.rules_path}")

        with open(self.protocol_path, "r", encoding="utf-8") as f:
            self._protocol = json.load(f)

        with open(self.rules_path, "r", encoding="utf-8") as f:
            self._rules = json.load(f)

    @property
    def protocol_data(self) -> Dict[str, Any]:
        return self._protocol or {}

    @property
    def rules_data(self) -> Dict[str, Any]:
        return self._rules or {}

    @property
    def trial_metadata(self) -> Dict[str, Any]:
        return self.protocol_data.get("trial_metadata", {})

    @property
    def visits(self) -> List[Dict[str, Any]]:
        """List of visit specifications from protocol.json."""
        return self.protocol_data.get("visits", [])

    @property
    def study_arms(self) -> List[Dict[str, Any]]:
        """List of study arms."""
        return self.protocol_data.get("study_arms", [])

    @property
    def eligibility(self) -> Dict[str, Any]:
        """Eligibility criteria."""
        return self.protocol_data.get("eligibility", {})

    @property
    def rules_by_id(self) -> Dict[str, Dict[str, Any]]:
        """Dictionary of executable rules from protocol_rules.json keyed by rule_id."""
        rules = self.rules_data.get("rules", [])
        return {r["rule_id"]: r for r in rules}

    @property
    def constraints_by_code(self) -> Dict[str, Dict[str, Any]]:
        """Dictionary of constraints from protocol.json keyed by rule_code."""
        constraints = self.protocol_data.get("protocol_constraints", [])
        return {c["rule_code"]: c for c in constraints}

    def get_visit(self, visit_id: str) -> Optional[Dict[str, Any]]:
        for v in self.visits:
            if v["visit_id"] == visit_id:
                return v
        return None

    def get_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        return self.rules_by_id.get(rule_id)
