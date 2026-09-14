"""Configuration options and constants for the TrialGuard data generator."""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GeneratorConfig:
    """Settings controlling dataset generation and export."""

    # Base workspace directory
    base_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("WORKSPACE_ROOT", Path(__file__).resolve().parents[2])
        )
    )

    # Protocol files (immutable source of truth)
    protocol_json_path: Optional[Path] = None
    protocol_rules_json_path: Optional[Path] = None

    # Number of sites & patients
    num_sites: int = 10
    patients_per_site: int = 10
    random_seed: int = 42

    # Output directory
    output_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "DATA_OUTPUT_DIR",
                Path(__file__).resolve().parents[2] / "data" / "generated",
            )
        )
    )

    # Date anchor for trial timeline (DECLARE-TIMI 58 enrollment period)
    trial_start_date: str = "2013-11-01"
    trial_amendment_date: str = "2015-06-01"  # Protocol Amendment 4 per protocol.json

    def __post_init__(self):
        # Resolve protocol.json path
        if self.protocol_json_path is None:
            candidate_paths = [
                self.base_dir / "src" / "protocol" / "protocol.json",
                self.base_dir / "src" / "protocol" / "trial_protocol.json",
                self.base_dir / "protocol.json",
            ]
            for p in candidate_paths:
                if p.exists():
                    self.protocol_json_path = p
                    break
            if self.protocol_json_path is None:
                self.protocol_json_path = candidate_paths[0]

        # Resolve protocol_rules.json path
        if self.protocol_rules_json_path is None:
            candidate_paths = [
                self.base_dir / "src" / "protocol" / "rules" / "protocol_rules.json",
                self.base_dir / "src" / "protocol" / "protocol_rules.json",
                self.base_dir / "protocol_rules.json",
            ]
            for p in candidate_paths:
                if p.exists():
                    self.protocol_rules_json_path = p
                    break
            if self.protocol_rules_json_path is None:
                self.protocol_rules_json_path = candidate_paths[0]
