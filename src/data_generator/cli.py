"""Command-line interface and orchestrator for TrialGuard clinical data generation."""

import argparse
import random
from pathlib import Path
from typing import Optional

from .config import GeneratorConfig
from .models import Site, DatasetBundle
from .protocol_loader import ProtocolLoader
from .aact_reference import AACT_SITES_REFERENCE, AACT_TRIAL_METADATA
from .patient_generator import PatientGenerator
from .visit_schedule_generator import VisitScheduleGenerator
from .clinical_events_generator import ClinicalEventsGenerator
from .deviation_injector import DeviationInjector
from .exporter import DatasetExporter


def generate_normal_dataset(config: GeneratorConfig, export: bool = False) -> DatasetBundle:
    """Generates 100% compliant, normal baseline clinical data with zero protocol deviations."""
    loader = ProtocolLoader(config.protocol_json_path, config.protocol_rules_json_path)
    rng = random.Random(config.random_seed)

    # 1. Sites grounded in AACT reference
    sites = []
    for ref in AACT_SITES_REFERENCE[: config.num_sites]:
        site = Site(
            site_id=ref["site_id"],
            site_name=ref["site_name"],
            country=ref["country"],
            city=ref["city"],
            investigator=ref["investigator"],
            activation_date=ref["activation_date"],
            patient_count=config.patients_per_site,
            status="active",
            target_risk_level=ref["target_risk_level"],
            created_at=f"{ref['activation_date']}T00:00:00Z",
        )
        sites.append(site)

    # 2. Patients with verified eligibility
    patient_gen = PatientGenerator(loader, rng)
    patients = patient_gen.generate_patients_for_sites(sites, config.patients_per_site)

    # 3. Visits & Clinical Events
    visit_gen = VisitScheduleGenerator(loader, rng)
    events_gen = ClinicalEventsGenerator(loader, rng)

    all_visits = []
    all_dosing = []
    all_labs = []
    all_meds = []
    all_consents = []
    all_audit_logs = []

    for patient in patients:
        p_visits = visit_gen.generate_visits_for_patient(patient)
        p_dosing, p_labs, p_meds, p_consents, p_audits = events_gen.generate_events_for_patient(patient, p_visits)

        all_visits.extend(p_visits)
        all_dosing.extend(p_dosing)
        all_labs.extend(p_labs)
        all_meds.extend(p_meds)
        all_consents.extend(p_consents)
        all_audit_logs.extend(p_audits)

    # Compliant dataset bundle with zero deviations
    normal_bundle = DatasetBundle(
        sites=sites,
        patients=patients,
        visits=all_visits,
        dosing_events=all_dosing,
        lab_results=all_labs,
        medications=all_meds,
        consent_records=all_consents,
        audit_logs=all_audit_logs,
        deviations=[],
        protocol_meta=loader.trial_metadata or AACT_TRIAL_METADATA,
        rules_meta=loader.rules_data.get("rules", []),
    )

    if export:
        exporter = DatasetExporter(config.output_dir)
        exporter.export_all(normal_bundle)

    return normal_bundle


def generate_dataset(
    config: GeneratorConfig,
    scenarios_path: Optional[Path] = None,
) -> DatasetBundle:
    """Orchestrates the complete pipeline:
    NORMAL DATA -> inject_deviations.py (deviation_scenarios.json) -> ABNORMAL CLINICAL EVENTS.
    """
    # 1. Generate NORMAL DATA baseline
    normal_bundle = generate_normal_dataset(config, export=False)

    # 2. Resolve deviation_scenarios.json path
    scen_file = scenarios_path
    if scen_file is None:
        candidate_scenarios = [
            config.base_dir / "src" / "protocol" / "deviations" / "deviation_scenarios.json",
            config.base_dir / "src" / "protocol" / "deviation_scenarios.json",
            config.base_dir / "deviation_scenarios.json",
        ]
        for p in candidate_scenarios:
            if p.exists():
                scen_file = p
                break

    # 3. If deviation_scenarios.json exists, apply via DeviationInjectorFromScenarios
    if scen_file and scen_file.exists():
        from .inject_deviations import DeviationInjectorFromScenarios

        injector = DeviationInjectorFromScenarios(scen_file)
        abnormal_bundle, _ = injector.apply_scenarios(normal_bundle)
    else:
        # Fallback to programmatic injector
        loader = ProtocolLoader(config.protocol_json_path, config.protocol_rules_json_path)
        rng = random.Random(config.random_seed)
        p_injector = DeviationInjector(loader, rng)
        deviations = p_injector.inject_all(
            normal_bundle.patients,
            normal_bundle.visits,
            normal_bundle.dosing_events,
            normal_bundle.lab_results,
            normal_bundle.medications,
            normal_bundle.consent_records,
        )
        normal_bundle.deviations = deviations
        abnormal_bundle = normal_bundle

    # 4. Export ABNORMAL CLINICAL EVENTS
    exporter = DatasetExporter(config.output_dir)
    exporter.export_all(abnormal_bundle)

    return abnormal_bundle


def main():
    parser = argparse.ArgumentParser(
        description="TrialGuard Clinical Trial Data Generator (DECLARE-TIMI 58 / NCT01986881)"
    )
    parser.add_argument("--sites", type=int, default=10, help="Number of sites to generate (default: 10)")
    parser.add_argument(
        "--patients-per-site",
        type=int,
        default=10,
        help="Patients per site (default: 10, total: 100)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/generated",
        help="Output directory for generated datasets",
    )
    parser.add_argument(
        "--protocol",
        type=str,
        default=None,
        help="Path to protocol.json / trial_protocol.json",
    )
    parser.add_argument(
        "--rules",
        type=str,
        default=None,
        help="Path to protocol_rules.json",
    )

    args = parser.parse_args()

    config = GeneratorConfig(
        num_sites=args.sites,
        patients_per_site=args.patients_per_site,
        random_seed=args.seed,
        output_dir=Path(args.output_dir),
        protocol_json_path=Path(args.protocol) if args.protocol else None,
        protocol_rules_json_path=Path(args.rules) if args.rules else None,
    )

    print("=================================================================")
    print(" TrialGuard Clinical Trial Data Generator")
    print(f" Source: protocol.json & protocol_rules.json")
    print(f" Reference: AACT NCT01986881 (DECLARE-TIMI 58)")
    print("=================================================================")
    print(f" Protocol path: {config.protocol_json_path}")
    print(f" Rules path:    {config.protocol_rules_json_path}")
    print(f" Output dir:    {config.output_dir}")
    print(" Generating dataset...")

    bundle = generate_dataset(config)
    summary = bundle.summary()

    print("\nGeneration completed successfully!")
    print("-----------------------------------------------------------------")
    print(f" Sites generated:         {summary['sites']}")
    print(f" Patients generated:      {summary['patients']}")
    print(f" Visits generated:        {summary['visits']}")
    print(f" Dosing events:           {summary['dosing_events']}")
    print(f" Lab results:             {summary['lab_results']}")
    print(f" Concomitant medications: {summary['medications']}")
    print(f" Consent records:         {summary['consent_records']}")
    print(f" Injected deviations:     {summary['deviations']}")
    print("-----------------------------------------------------------------")
    print(f" Formats exported: JSON, CSV, PostgreSQL seed SQL")
    print(f" Artifacts location: {config.output_dir.resolve()}")


if __name__ == "__main__":
    main()
