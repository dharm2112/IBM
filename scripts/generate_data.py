#!/usr/bin/env python3
"""Convenience script to run TrialGuard Clinical Trial Data Generator."""

import sys
from pathlib import Path

# Add project root to sys.path so src imports work cleanly
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.data_generator.cli import main

if __name__ == "__main__":
    main()
