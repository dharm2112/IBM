# TrialGuard Protocol Representation

## Overview

This directory contains the canonical protocol representation for TrialGuard.  
It is the **single source of truth** that ties the real public clinical trial to every executable rule, every synthetic patient event, and every detectable deviation.

---

## Selected Trial: DECLARE–TIMI 58

| Field | Value |
|---|---|
| **ClinicalTrials.gov** | [NCT01986881](https://clinicaltrials.gov/study/NCT01986881) |
| **Full Title** | Dapagliflozin Effect on CardiovascuLAR Events — Thrombolysis In Myocardial Infarction 58 |
| **Phase** | III |
| **Sponsor** | AstraZeneca |
| **Condition** | Type 2 Diabetes + established or high-risk atherosclerotic cardiovascular disease |
| **Intervention** | Dapagliflozin 10 mg QD oral vs Placebo |
| **Blinding** | Double-blind, placebo-controlled |
| **Primary Publication** | Wiviott et al., *N Engl J Med* 2019;380:347–357. DOI: [10.1056/NEJMoa1812389](https://doi.org/10.1056/NEJMoa1812389) |

### Why this trial was chosen

DECLARE–TIMI 58 was selected because it provides all the protocol fingerprints present in `root.md`:

- Oral fixed-dose drug (dapagliflozin 10 mg) — drives `DOSE-*` rules  
- HbA1c eligibility window (6.5–12.0%) — drives `ELIG-002`  
- eGFR ≥ 60 mL/min/1.73 m² inclusion criterion — drives `ELIG-004` (matches DEV-006 in root.md)  
- Warfarin interaction concern — drives `MED-003` (matches DEV-003/MED-007 in root.md)  
- Annual safety visits with eGFR monitoring — drives `VISIT-*` and `LAB-*` rules  
- Double-blind design — drives `BLIND-001`  
- Long-duration outcomes trial (median 4.2 years) — drives multi-year visit schedule  
- Phase III, publicly registered, peer-reviewed primary publication — full protocol traceability

---

## Directory Structure

```
src/protocol/
├── schema/
│   └── protocol_schema.json   ← JSON Schema (Draft-07) — the TYPE definition
└── trial_protocol.json        ← Protocol instance (DECLARE-TIMI 58) — the DATA
```

---

## The Provenance Model

Every object in the protocol representation carries a `_provenance` block:

```json
"_provenance": {
  "type": "SOURCE_DERIVED | SYNTHETIC_ASSUMPTION",
  "source": "citation or 'SYNTHETIC'",
  "note": "explanation of confidence or assumption"
}
```

### `SOURCE_DERIVED`
The value is confirmed in at least one public source:
- ClinicalTrials.gov record NCT01986881
- Wiviott et al., NEJM 2019 (primary publication)
- ICH E6(R2) GCP guidelines (universal requirements)

### `SYNTHETIC_ASSUMPTION`
The value is a reasonable assumption required to make the rule engine executable, but **is not confirmed in the public protocol**. Examples:
- Exact visit window tolerances (e.g., ±7 days for Month 2)
- eCRF data entry lag threshold (5 business days)
- Warfarin prohibition specifics

Every `SYNTHETIC_ASSUMPTION` **must be reviewed by a human before production deployment**. In the TrialGuard UI, these appear with a yellow "Pending Review" badge in the Protocol Rule Viewer.

---

## Traceability Chain

```
ClinicalTrials.gov NCT01986881  (public source)
    │
    ▼  trial_metadata.source_refs
┌─────────────────────────────────────────────┐
│           trial_protocol.json               │
│  trial_metadata → eligibility → visits      │
│              → interventions → outcomes     │
│              → protocol_constraints         │
│              → executable_rule_refs         │
└─────────────────────────────────────────────┘
    │
    ▼  protocol_constraints[*].rule_code
┌─────────────────────────────────────────────┐
│    Deterministic Rule Engine (Python)       │
│  src/rules/dose_rules.py    → DOSE-*        │
│  src/rules/visit_rules.py   → VISIT-*       │
│  src/rules/lab_rules.py     → LAB-*         │
│  src/rules/eligibility_rules.py → ELIG-*   │
│  src/rules/medication_rules.py  → MED-*    │
│  src/rules/procedure_rules.py   → BLIND-*  │
│                                  CONSENT-* │
│                                  DATA-*    │
└─────────────────────────────────────────────┘
    │
    ▼  evaluate(rule_code, patient_data) → Deviation
┌─────────────────────────────────────────────┐
│   Synthetic Data Generator                  │
│   injection_parameters.field_to_mutate      │
│   injection_parameters.mutation_type        │
│   injection_parameters.example_value        │
│   → controlled deviation inserted           │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│   deviations table (PostgreSQL)             │
│   deviation_id, rule_code (FK), patient_id  │
│   severity (rule engine), detected_at       │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│   watsonx.ai Intelligence Layer             │
│   CAPA generation, risk narrative,          │
│   cross-site pattern detection              │
└─────────────────────────────────────────────┘
```

---

## Section-by-Section Design Rationale

### 1. `trial_metadata`
Anchors the entire protocol to a real public trial via `nct_id`.  
All downstream elements trace back through `protocol_id`.  
`source_refs` preserves every public source used, with access date.

### 2. `eligibility`
Each inclusion/exclusion criterion maps 1-to-1 to a `rule_code`.  
The `testable_condition` field is the executable predicate the rule engine evaluates.  
`severity_if_missed/violated` = `major` for all eligibility criteria (patient should not have been enrolled).

### 3. `interventions`
Defines expected dose, route, frequency, and prohibited combinations.  
`prohibited_combinations[*].rule_code` maps to `MED-*` rules.  
Dose tolerance is declared here — zero for fixed-dose tablets.

### 4. `study_arms`
Maps each arm to its intervention(s).  
The rule engine uses `patient.arm → arm_id → intervention_id → dose.value` to determine what the expected dose is before checking `dosing_events.actual_dose`.

### 5. `visits`
Each visit carries its `scheduled_day` and `window` (lower/upper days tolerance).  
`is_safety_critical = true` escalates a missed visit to **major** severity.  
`is_primary_endpoint_visit = true` escalates missing endpoint data to **major** severity.  
Each `mandatory_procedure` maps to a `LAB-*` or `PROC-*` rule.

### 6. `outcomes`
Declares which visits are endpoint-critical.  
Used by the rule engine to escalate severity when primary endpoint data is missing.  
`adjudicated_by` preserves the independent committee — important for audit trail.

### 7. `protocol_constraints`
The **semantic bridge** between protocol text and the rule engine.  
Each constraint has:
- `source_text` — verbatim or near-verbatim protocol language
- `comparator` — the operator the rule engine uses
- `tolerance` — exact numeric window
- `severity_if_violated` — baseline severity
- `severity_escalation_conditions` — when severity escalates further

This is the layer a human reviewer approves before rules become active.

### 8. `executable_rule_refs`
The **machine layer** — maps each `rule_code` to:
- The Python function that evaluates it (`engine_function`, `engine_module`)
- The DB fields it reads (`input_fields`)
- How to inject a controlled deviation (`injection_parameters`)

This layer closes the full traceability loop.

---

## Rule Code Registry

| Rule Code | Type | Source | Severity |
|---|---|---|---|
| `ELIG-001` | eligibility | SOURCE_DERIVED — IC-01 age ≥ 40 | major |
| `ELIG-002` | eligibility | SOURCE_DERIVED — IC-02 HbA1c 6.5–12% | major |
| `ELIG-003` | eligibility | SOURCE_DERIVED — IC-03 established CVD or risk | major |
| `ELIG-004` | eligibility | SOURCE_DERIVED — IC-04 eGFR ≥ 60 | major |
| `ELIG-005` | eligibility | SOURCE_DERIVED — EC-01 T1DM excluded | major |
| `ELIG-006` | eligibility | SOURCE_DERIVED — EC-02 chronic corticosteroid excluded | major |
| `DOSE-001` | dosing | SOURCE_DERIVED — first dose at randomisation | major |
| `DOSE-002` | dosing | SYNTHETIC_ASSUMPTION — compliance ≥ 70% | minor |
| `DOSE-003` | dosing | SOURCE_DERIVED — fixed 10 mg dose | major |
| `VISIT-001` | visit_window | SYNTHETIC_ASSUMPTION — screening ±7d | minor |
| `VISIT-002` | visit_window | SOURCE_DERIVED — randomisation Day 0 | major |
| `VISIT-003` | visit_window | SYNTHETIC_ASSUMPTION — Month 2 ±7d | minor |
| `VISIT-004` | visit_window | SYNTHETIC_ASSUMPTION — Month 6 ±14d, safety-critical | major |
| `VISIT-005` | visit_window | SYNTHETIC_ASSUMPTION — Month 12 annual ±14d | major |
| `VISIT-006` | visit_window | SYNTHETIC_ASSUMPTION — EOS | major |
| `MED-001` | medication | SOURCE_DERIVED — no other SGLT2 inhibitors | major |
| `MED-002` | medication | SYNTHETIC_ASSUMPTION — high-dose loop diuretic caution | minor |
| `MED-003` | medication | SYNTHETIC_ASSUMPTION — warfarin monitoring required | major |
| `MED-004` | medication | SYNTHETIC_ASSUMPTION — new insulin without approval | minor |
| `LAB-001` | lab | SOURCE_DERIVED — HbA1c at screening | major |
| `LAB-002` | lab | SOURCE_DERIVED — eGFR ≥ 60 at screening | major |
| `LAB-003` | lab | SOURCE_DERIVED — HbA1c at baseline | minor |
| `LAB-004` | lab | SYNTHETIC_ASSUMPTION — HbA1c at Month 2 | minor |
| `LAB-005` | lab | SOURCE_DERIVED — HbA1c at Month 6 | minor |
| `LAB-006` | lab | SOURCE_DERIVED — eGFR at Month 6 | major |
| `LAB-007` | lab | SOURCE_DERIVED — HbA1c at Month 12 | minor |
| `LAB-008` | lab | SOURCE_DERIVED — eGFR at Month 12 | major |
| `LAB-009` | lab | SOURCE_DERIVED — HbA1c at EOS | major |
| `LAB-010` | lab | SOURCE_DERIVED — eGFR at EOS | major |
| `CONSENT-001` | consent | SYNTHETIC_ASSUMPTION (14d window) / SOURCE_DERIVED (GCP) | administrative→major |
| `DATA-001` | data_entry | SYNTHETIC_ASSUMPTION — eCRF ≤ 5 business days | administrative |
| `BLIND-001` | blinding | SOURCE_DERIVED — double-blind NCT01986881 | major |

---

## How the Synthetic Data Generator Will Use This

Each `executable_rule_refs[*]` entry includes `injection_parameters`:

```json
"injection_parameters": {
  "field_to_mutate": "result_value",   ← which DB column to change
  "mutation_type": "out_of_range_low", ← how to mutate it
  "example_value": 45                  ← concrete demo value
}
```

The generator **does not guess** which field or what value — it reads these from the protocol JSON.  
This ensures every injected deviation is **directly traceable** to a protocol constraint and an executable rule.

---

## What Member 1 (Rule Engine) Needs Next

1. Implement `src/rules/` modules with one function per `engine_function` in `executable_rule_refs`
2. Load `trial_protocol.json` at startup to populate the `protocol_rules` DB table
3. For each `protocol_constraints` entry: insert a row into `protocol_rules` with `status = 'pending'` for `SYNTHETIC_ASSUMPTION` entries and `status = 'active'` for `SOURCE_DERIVED` entries after human review
4. The rule engine loop: `for each visit → for each active rule → evaluate → emit Deviation if violated`

---

## Validation

To validate an updated `trial_protocol.json` against the schema:

```bash
pip install jsonschema
python - <<'EOF'
import json, jsonschema, pathlib
schema = json.loads(pathlib.Path("src/protocol/schema/protocol_schema.json").read_text())
instance = json.loads(pathlib.Path("src/protocol/trial_protocol.json").read_text())
jsonschema.validate(instance, schema)
print("✓ Protocol JSON is valid against schema")
EOF
```
