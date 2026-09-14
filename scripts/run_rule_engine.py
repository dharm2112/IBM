#!/usr/bin/env python3
"""CLI script to run TrialGuard Deterministic Rule Engine against clinical trial data.

Pipeline:
    NORMAL DATA -> inject_deviations.py -> ABNORMAL CLINICAL EVENTS -> rule_engine -> DEVIATIONS
"""

import argparse
import json
import sys
from pathlib import Path
from collections import Counter

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.rule_engine import TrialGuardRuleEngine
from src.data_generator import generate_normal_dataset, GeneratorConfig
from src.data_generator.inject_deviations import inject_deviations_pipeline


def main():
    parser = argparse.ArgumentParser(
        description="Run TrialGuard Deterministic Rule Engine against clinical trial dataset"
    )
    parser.add_argument(
        "--input-dir",
        type=str,
        default=None,
        help="Path to directory containing clinical data JSON files (e.g. data/abnormal)",
    )
    parser.add_argument(
        "--scenarios",
        type=str,
        default="src/protocol/deviations/deviation_scenarios.json",
        help="Path to deviation_scenarios.json",
    )
    parser.add_argument(
        "--output-file",
        type=str,
        default="data/detected_deviations.json",
        help="Path to save discovered deviations JSON",
    )
    parser.add_argument(
        "--normal-only",
        action="store_true",
        help="Run against pristine NORMAL DATA only (to verify 0 deviations)",
    )

    args = parser.parse_args()

    engine = TrialGuardRuleEngine()
    print("=================================================================")
    print(" TrialGuard Deterministic Rule Engine")
    print(f" Loaded Rules: {len(engine.rules)} canonical rules from protocol_rules.json")
    print("=================================================================")

    if args.input_dir:
        input_path = Path(args.input_dir)
        print(f" Loading source clinical events from: {input_path.resolve()}")
        dataset = {}
        for entity in [
            "patients.json",
            "visits.json",
            "dosing_events.json",
            "lab_results.json",
            "medications.json",
            "consent_records.json",
            "audit_logs.json",
        ]:
            fpath = input_path / entity
            if fpath.exists():
                with open(fpath, "r", encoding="utf-8") as f:
                    dataset[entity.replace(".json", "")] = json.load(f)
    else:
        cfg = GeneratorConfig()
        if args.normal_only:
            print(" Evaluating NORMAL DATA baseline...")
            dataset = generate_normal_dataset(cfg)
        else:
            print(" Generating NORMAL DATA and injecting scenarios from deviation_scenarios.json...")
            scenarios_path = Path(args.scenarios)
            dataset, _ = inject_deviations_pipeline(scenarios_path=scenarios_path, config=cfg)

    # Run deterministic evaluation
    print(" Evaluating clinical events against canonical protocol rules...")
    deviations = engine.evaluate(dataset)

    print("\nEvaluation completed!")
    print("-----------------------------------------------------------------")
    print(f" Total Deviations Detected: {len(deviations)}")

    # Summary by Site and Severity
    site_counts = Counter(d.site_id for d in deviations)
    sev_counts = Counter(d.severity for d in deviations)
    rule_counts = Counter(d.rule_id for d in deviations)

    print("\nDeviations by Site:")
    for site, cnt in sorted(site_counts.items()):
        print(f"  {site}: {cnt}")

    print("\nDeviations by Severity:")
    for sev, cnt in sorted(sev_counts.items()):
        print(f"  {sev}: {cnt}")

    print("\nTop Violated Rules:")
    for rule, cnt in sorted(rule_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {rule}: {cnt}")
    print("-----------------------------------------------------------------")

    # Save output
    out_file = Path(args.output_file)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump([d.to_dict() for d in deviations], f, indent=2)
    print(f" Discovered deviations saved to: {out_file.resolve()}")


if __name__ == "__main__":
    main()
