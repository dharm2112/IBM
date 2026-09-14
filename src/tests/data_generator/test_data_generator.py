"""Unit and integration tests for the TrialGuard Clinical Trial Data Generator."""

import json
import pytest
from pathlib import Path
from src.data_generator.config import GeneratorConfig
from . import __file__ as _test_file
from src.data_generator.protocol_loader import ProtocolLoader
from src.data_generator.models import Site, Patient, DatasetBundle
from src.data_generator.cli import generate_dataset
from src.data_generator.aact_reference import AACT_SITES_REFERENCE, AACT_TRIAL_METADATA


@pytest.fixture
def generator_config(tmp_path):
    """Fixture providing GeneratorConfig pointing to repo protocol files and temp output."""
    workspace_root = Path(__file__).resolve().parents[3]
    protocol_file = workspace_root / "src" / "protocol" / "protocol.json"
    if not protocol_file.exists():
        protocol_file = workspace_root / "src" / "protocol" / "trial_protocol.json"

    rules_file = workspace_root / "src" / "protocol" / "rules" / "protocol_rules.json"

    return GeneratorConfig(
        base_dir=workspace_root,
        protocol_json_path=protocol_file,
        protocol_rules_json_path=rules_file,
        num_sites=10,
        patients_per_site=10,
        random_seed=42,
        output_dir=tmp_path / "generated",
    )


class TestProtocolLoader:
    def test_protocol_loader_loads_successfully(self, generator_config):
        loader = ProtocolLoader(
            generator_config.protocol_json_path,
            generator_config.protocol_rules_json_path,
        )
        assert loader.protocol_data is not None
        assert loader.rules_data is not None

    def test_trial_metadata_declare_timi58(self, generator_config):
        loader = ProtocolLoader(
            generator_config.protocol_json_path,
            generator_config.protocol_rules_json_path,
        )
        meta = loader.trial_metadata
        assert meta["nct_id"] == "NCT01986881"
        assert "DECLARE" in meta["title"]
        assert meta["phase"] == "III"
        assert meta["sponsor"] == "AstraZeneca"

    def test_canonical_visits_definition(self, generator_config):
        loader = ProtocolLoader(
            generator_config.protocol_json_path,
            generator_config.protocol_rules_json_path,
        )
        visit_ids = [v["visit_id"] for v in loader.visits]
        expected_visits = ["V-SCREEN", "V-RAND", "V-M2", "V-M6", "V-M12", "V-EOS"]
        assert visit_ids == expected_visits

    def test_canonical_rules_count_and_types(self, generator_config):
        loader = ProtocolLoader(
            generator_config.protocol_json_path,
            generator_config.protocol_rules_json_path,
        )
        rules = loader.rules_by_id
        assert len(rules) == 20
        # Check rule prefix categories
        assert "DOSE-001" in rules
        assert "DOSE-003" in rules
        assert "VISIT-003" in rules
        assert "MED-001" in rules
        assert "LAB-001" in rules
        assert "PROC-001" in rules


class TestDatasetGeneration:
    def test_generate_normal_dataset_baseline(self, generator_config):
        from src.data_generator.cli import generate_normal_dataset

        bundle = generate_normal_dataset(generator_config)
        summary = bundle.summary()

        assert summary["sites"] == 10
        assert summary["patients"] == 100
        assert summary["visits"] == 600
        assert summary["dosing_events"] == 500
        assert summary["lab_results"] == 1200
        assert summary["consent_records"] == 200
        assert summary["audit_logs"] == 200
        assert summary["deviations"] == 0  # Pristine baseline

        # Baseline eligibility: all 100 patients compliant
        for p in bundle.patients:
            assert p.baseline_egfr >= 60.0
            assert 6.5 <= p.baseline_hba1c <= 12.0
            birth_year = int(p.date_of_birth.split("-")[0])
            assert birth_year <= 1975

    def test_study_arms_randomization(self, generator_config):
        bundle = generate_dataset(generator_config)
        arms = [p.arm for p in bundle.patients]
        active_count = arms.count("ARM-ACTIVE")
        placebo_count = arms.count("ARM-PLACEBO")
        # 1:1 balance: 50 active, 50 placebo
        assert active_count == 50
        assert placebo_count == 50

    def test_generate_abnormal_dataset_counts(self, generator_config):
        bundle = generate_dataset(generator_config)
        summary = bundle.summary()

        assert summary["sites"] == 10
        assert summary["patients"] == 100
        assert summary["visits"] == 600
        assert summary["deviations"] == 32  # Matches deviation_scenarios.json total_scenarios


class TestInjectedDeviations:
    def test_deviations_rule_traceability(self, generator_config):
        bundle = generate_dataset(generator_config)
        loader = ProtocolLoader(
            generator_config.protocol_json_path,
            generator_config.protocol_rules_json_path,
        )
        canonical_rule_ids = set(loader.rules_by_id.keys())

        for dev in bundle.deviations:
            assert dev.rule_id in canonical_rule_ids, f"Rule {dev.rule_id} not in protocol_rules.json"
            assert dev.severity in ("administrative", "minor", "major")
            assert dev.severity_source == "rule_engine"

    def test_site_104_high_risk_profile(self, generator_config):
        bundle = generate_dataset(generator_config)
        s104_devs = [d for d in bundle.deviations if d.site_id == "SITE-104"]
        # Exactly 9 scenarios per CLUSTER-104 in deviation_scenarios.json
        assert len(s104_devs) == 9

        # Verify dosing errors are present in mutated dosing_events
        doses = {d.patient_id + "_" + d.visit_id: d for d in bundle.dosing_events}
        # SCN-104-01: PT-104-003 at V-M2 dose=20
        d1 = [d for d in bundle.dosing_events if d.patient_id == "PT-104-003" and "V-M2" in d.visit_id]
        assert len(d1) == 1 and d1[0].actual_dose == 20.0

        # SCN-104-04: PT-104-002 route=subcutaneous
        d4 = [d for d in bundle.dosing_events if d.patient_id == "PT-104-002" and "V-RAND" in d.visit_id]
        assert len(d4) == 1 and d4[0].route == "subcutaneous"

    def test_site_102_data_delay_profile(self, generator_config):
        bundle = generate_dataset(generator_config)
        s102_devs = [d for d in bundle.deviations if d.site_id == "SITE-102"]
        # Exactly 8 scenarios per CLUSTER-102 in deviation_scenarios.json
        assert len(s102_devs) == 8
        assert all(d.rule_id == "PROC-003" for d in s102_devs)

    def test_site_107_comed_and_missed_visits(self, generator_config):
        bundle = generate_dataset(generator_config)
        s107_devs = [d for d in bundle.deviations if d.site_id == "SITE-107"]
        # Exactly 6 scenarios per CLUSTER-107 in deviation_scenarios.json
        assert len(s107_devs) == 6

    def test_site_110_visit_windows_and_labs(self, generator_config):
        bundle = generate_dataset(generator_config)
        s110_devs = [d for d in bundle.deviations if d.site_id == "SITE-110"]
        # Exactly 5 scenarios per CLUSTER-110 in deviation_scenarios.json
        assert len(s110_devs) == 5

    def test_site_105_eligibility_and_consent(self, generator_config):
        bundle = generate_dataset(generator_config)
        s105_devs = [d for d in bundle.deviations if d.site_id == "SITE-105"]
        # Exactly 4 scenarios per CLUSTER-105 in deviation_scenarios.json
        assert len(s105_devs) == 4

        # Verify eGFR mutated to 54 for PT-105-006 (SCN-105-01)
        labs_egfr = [l for l in bundle.lab_results if l.patient_id == "PT-105-006" and l.test_code == "eGFR_CKD_EPI"]
        assert len(labs_egfr) >= 1 and labs_egfr[0].result_value == 54.0

    def test_clean_sites_zero_scenarios(self, generator_config):
        bundle = generate_dataset(generator_config)
        clean_sites = ["SITE-101", "SITE-103", "SITE-106", "SITE-108", "SITE-109"]
        for s_id in clean_sites:
            s_devs = [d for d in bundle.deviations if d.site_id == s_id]
            # Clean sites have 0 scenarios in deviation_scenarios.json
            assert len(s_devs) == 0


class TestExports:
    def test_exported_files_exist_and_populated(self, generator_config):
        bundle = generate_dataset(generator_config)
        out = generator_config.output_dir

        # JSON files
        json_files = [
            "sites.json", "patients.json", "visits.json", "dosing_events.json",
            "lab_results.json", "medications.json", "consent_records.json",
            "deviations.json", "trialguard_dataset.json"
        ]
        for jf in json_files:
            file_path = out / jf
            assert file_path.exists(), f"Missing {jf}"
            assert file_path.stat().st_size > 0

        # CSV files
        csv_files = [
            "sites.csv", "patients.csv", "visits.csv", "dosing_events.csv",
            "lab_results.csv", "medications.csv", "consent_records.csv",
            "deviations.csv"
        ]
        for cf in csv_files:
            file_path = out / "csv" / cf
            assert file_path.exists(), f"Missing csv/{cf}"
            assert file_path.stat().st_size > 0

        # SQL seed file
        sql_file = out / "seed.sql"
        assert sql_file.exists()
        assert sql_file.stat().st_size > 500000  # > 500 KB of SQL inserts
        sql_content = sql_file.read_text(encoding="utf-8")
        assert "INSERT INTO sites" in sql_content
        assert "INSERT INTO patients" in sql_content
        assert "INSERT INTO deviations" in sql_content
