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


def generate_dataset(config: GeneratorConfig) -> DatasetBundle:
    """Orchestrates end-to-end dataset generation based on protocol.json, protocol_rules.json, and AACT."""
    # 1. Load protocol and rules
    loader = ProtocolLoader(config.protocol_json_path, config.protocol_rules_json_path)

    # 2. Setup deterministic RNG
    rng = random.Random(config.random_seed)

    # 3. Create sites grounded in AACT reference
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

    # 4. Generate patients
    patient_gen = PatientGenerator(loader, rng)
    patients = patient_gen.generate_patients_for_sites(sites, config.patients_per_site)

    # 5. Generate visit schedules & clinical events
    visit_gen = VisitScheduleGenerator(loader, rng)
    events_gen = ClinicalEventsGenerator(loader, rng)

    all_visits = []
    all_dosing = []
    all_labs = []
    all_meds = []
    all_consents = []

    for patient in patients:
        p_visits = visit_gen.generate_visits_for_patient(patient)
        p_dosing, p_labs, p_meds, p_consents = events_gen.generate_events_for_patient(patient, p_visits)

        all_visits.extend(p_visits)
        all_dosing.extend(p_dosing)
        all_labs.extend(p_labs)
        all_meds.extend(p_meds)
        all_consents.extend(p_consents)

    # 6. Inject controlled protocol deviations
    injector = DeviationInjector(loader, rng)
    deviations = injector.inject_all(
        patients, all_visits, all_dosing, all_labs, all_meds, all_consents
    )

    # 7. Assemble DatasetBundle
    bundle = DatasetBundle(
        sites=sites,
        patients=patients,
        visits=all_visits,
        dosing_events=all_dosing,
        lab_results=all_labs,
        medications=all_meds,
        consent_records=all_consents,
        deviations=deviations,
        protocol_meta=loader.trial_metadata or AACT_TRIAL_METADATA,
        rules_meta=loader.rules_data.get("rules", []),
    )

    # 8. Export to JSON, CSV, and SQL
    exporter = DatasetExporter(config.output_dir)
    exporter.export_all(bundle)

    return bundle


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
