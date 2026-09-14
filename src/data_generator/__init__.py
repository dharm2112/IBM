"""TrialGuard Clinical Trial Data Generator.

Generates realistic, protocol-compliant clinical trial datasets with controlled
ICH E6 GCP protocol deviations based on canonical protocol specifications
(trial_protocol.json / protocol.json and protocol_rules.json) and AACT
(Aggregate Analysis of ClinicalTrials.gov) study metadata for DECLARE-TIMI 58 (NCT01986881).
"""

from .config import GeneratorConfig
from .models import (
    Site,
    Patient,
    Visit,
    DosingEvent,
    LabResult,
    Medication,
    ConsentRecord,
    Deviation,
    DatasetBundle,
)
from .protocol_loader import ProtocolLoader
from .patient_generator import PatientGenerator
from .visit_schedule_generator import VisitScheduleGenerator
from .clinical_events_generator import ClinicalEventsGenerator
from .deviation_injector import DeviationInjector
from .exporter import DatasetExporter

__all__ = [
    "GeneratorConfig",
    "Site",
    "Patient",
    "Visit",
    "DosingEvent",
    "LabResult",
    "Medication",
    "ConsentRecord",
    "Deviation",
    "DatasetBundle",
    "ProtocolLoader",
    "PatientGenerator",
    "VisitScheduleGenerator",
    "ClinicalEventsGenerator",
    "DeviationInjector",
    "DatasetExporter",
]
