#!/usr/bin/env python3
"""Convenience script to run TrialGuard Deviation Injector based on deviation_scenarios.json.

Pipeline:
    NORMAL DATA -> inject_deviations.py -> ABNORMAL CLINICAL EVENTS -> rule_engine -> DEVIATIONS
"""

import sys
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.data_generator.inject_deviations import main

if __name__ == "__main__":
    main()
