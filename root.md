# Clinical Trial Risk Monitor & Protocol Deviation Detector
## Hackathon Technical Project Proposal

---

## TOP-LEVEL OVERVIEW

**Goal:** Build a working hackathon demo that monitors 5,000+ patient visits across 200+ clinical trial sites, automatically detects protocol deviations, classifies them by ICH E6 GCP severity, scores site-level risk, generates CAPA reports, and provides a real-time risk dashboard — all demonstrable in a 5-minute live walkthrough.

**Scope:** Full-stack web application with a Python/FastAPI backend, React frontend, PostgreSQL database, deterministic rule engine for safety-critical deviation detection, and IBM watsonx.ai (foundation model) for protocol extraction, CAPA text generation, and natural-language explanations.

**Non-Goals:**
- Real patient data (synthetic/de-identified data only)
- Full GCP regulatory certification (demo prototype only — human review always required)
- Real-time EHR/EDC integration (CSV/JSON upload for demo)
- Fine-tuned custom model training (zero-shot/few-shot prompting only for hackathon)

**Core Design Principles:**
1. Deterministic rule engine handles all safety-critical protocol compliance checks — AI does NOT make GCP regulatory severity decisions alone
2. AI (watsonx.ai) assists with: protocol document parsing, natural-language explanations, CAPA text drafting, and pattern narration
3. Every decision is traceable, auditable, and subject to human review
4. Patient safety and data integrity take priority over AI automation

---

## IBM TECHNOLOGY RESEARCH FINDINGS

### 1. watsonx.ai (Foundation Models + Prompt Lab)
**What it does:** Enterprise LLM studio. Supports Prompt Lab (GUI), text extraction API, text classification API, RAG patterns, and Python SDK.
**HIPAA-Ready Plan:** Available on IBM Cloud (Dallas region) — relevant for healthcare data compliance.
**Relevant capabilities confirmed:**
- Text extraction API — extract structured data from PDF/text documents
- Text classification API — classify document types
- RAG with AutoAI — ground LLM answers in protocol documents
- Prompt Lab — design and save prompt templates
- Foundation model inference API — generate CAPA recommendations, risk explanations
**Hackathon feasibility:** HIGH — free/lite tier available; Python SDK (`ibm-watsonx-ai`) works from Jupyter notebooks and FastAPI

### 2. watsonx.governance
**What it does:** AI lifecycle governance — model monitoring, risk scoring, explainability, compliance tracking, factsheets.
**Relevant for:** Audit trail of AI decisions; model drift detection; AI risk scoring transparency.
**Hackathon feasibility:** MEDIUM — valuable for demo narrative around "governed AI"; setup complexity is high for a hackathon MVP; recommend showing it conceptually and wiring basic factsheets if time permits.

### 3. watsonx.data
**What it does:** Open data lakehouse with Presto SQL query engine, Apache Iceberg table format, supports CSV/Parquet ingest.
**Relevant for:** Storing and querying all trial data (patients, visits, deviations, risk scores) at scale.
**Hackathon feasibility:** MEDIUM — for hackathon MVP, PostgreSQL is simpler; watsonx.data is the production-scale upgrade story.

### 4. IBM Cloud Databases for PostgreSQL
**What it does:** Managed PostgreSQL on IBM Cloud — fully ACID-compliant relational DB.
**Relevant for:** Primary operational database for all trial data, protocol rules, deviations, CAPA.
**Hackathon feasibility:** HIGH — simplest path; free tier available on IBM Cloud.

### 5. IBM Watson Knowledge Studio
**What it does:** Train custom NLP models for entity/relation extraction from domain-specific documents. AQL (Annotation Query Language) for rule-based extraction.
**Relevant for:** Extracting structured protocol rules from natural-language protocol documents.
**Hackathon feasibility:** LOW for hackathon (requires annotated training data) — USE watsonx.ai Prompt Lab / text extraction API instead for the demo.

### 6. IBM Cloud Code Engine
**What it does:** Fully managed serverless container platform — deploy containerized apps without cluster management.
**Relevant for:** Deploying backend API and rule engine.
**Hackathon feasibility:** HIGH — simple Docker deployment, no Kubernetes overhead.

### 7. IBM App Connect
**What it does:** Application integration, event-driven architecture, API management.
**Relevant for:** Future integration with EDC systems (Medidata Rave, Veeva Vault) — not needed for hackathon MVP.

---

## A. OVERALL ARCHITECTURE

```
[Protocol PDF/DOCX]          [Patient/Visit CSV/JSON]
        |                              |
        v                              v
 ┌─────────────────────────────────────────────────┐
 │            DATA INGESTION LAYER                  │
 │  watsonx.ai Text Extraction API (protocol docs)  │
 │  CSV/JSON Parser (patient records)               │
 └────────────────────┬────────────────────────────┘
                      |
                      v
 ┌─────────────────────────────────────────────────┐
 │         DATA VALIDATION & NORMALIZATION          │
 │  Schema validation, date parsing, unit           │
 │  normalization (mg/kg, mmol/L), duplicate check  │
 └────────────────────┬────────────────────────────┘
                      |
                      v
 ┌─────────────────────────────────────────────────┐
 │         PROTOCOL RULE STORE  (PostgreSQL)        │
 │  Protocol rules extracted by watsonx.ai +        │
 │  human review — stored as structured JSON rules  │
 └────────────────────┬────────────────────────────┘
                      |
                      v
 ┌─────────────────────────────────────────────────┐
 │     DETERMINISTIC PROTOCOL RULE ENGINE           │
 │  Python rule evaluator — compares patient data   │
 │  against protocol rules, emits deviation events  │
 └───────────┬────────────────────────┬────────────┘
             |                        |
             v                        v
 ┌───────────────────┐    ┌───────────────────────┐
 │ DEVIATION DETECTOR│    │  DEVIATION SEVERITY    │
 │ (rule-based)      │    │  CLASSIFIER            │
 │ Missed visit?     │    │  Rule-based matrix +   │
 │ Wrong dose?       │    │  watsonx.ai assistance │
 │ Prohibited med?   │    │  ICH E6 GCP logic      │
 └─────────┬─────────┘    └──────────┬────────────┘
           |                         |
           └───────────┬─────────────┘
                       v
 ┌─────────────────────────────────────────────────┐
 │           SITE RISK SCORING ENGINE               │
 │  Weighted formula: deviation frequency, major    │
 │  count, trends, missed visits, dosing errors,   │
 │  prohibited meds, peer comparison, data delays  │
 └────────────────────┬────────────────────────────┘
                      |
                      v
 ┌─────────────────────────────────────────────────┐
 │        watsonx.ai INTELLIGENCE LAYER             │
 │  - CAPA report text generation                   │
 │  - Risk narrative ("Why is Site 104 high-risk?") │
 │  - Pattern detection across sites                │
 └────────────────────┬────────────────────────────┘
                      |
                      v
 ┌─────────────────────────────────────────────────┐
 │            REACT DASHBOARD                       │
 │  Executive Risk | Site Ranking | CAPA Center |   │
 │  Patient Details | Protocol Viewer | Audit Trail │
 └─────────────────────────────────────────────────┘
```

---

## B. IBM TECHNOLOGY MAPPING

| Component | IBM Technology | Rationale |
|---|---|---|
| Protocol document parsing | watsonx.ai Text Extraction API + Prompt Lab | Extract structured rules from PDF/text protocol documents |
| Foundation model inference | watsonx.ai (granite-13b-chat / llama-3) | CAPA text, risk narration, protocol Q&A |
| AI governance & audit | watsonx.governance (conceptual demo) | Factsheet for AI decisions, explainability |
| Primary database | IBM Cloud Databases for PostgreSQL | ACID-compliant, relational, free tier on IBM Cloud |
| Data lakehouse (scale story) | watsonx.data (Presto + Iceberg) | Production scale-out story; demo with PostgreSQL |
| Backend deployment | IBM Cloud Code Engine | Serverless container — no Kubernetes overhead |
| Rule engine | Python (deterministic) | Safety-critical checks must be deterministic |
| Frontend | React + Recharts | Modern, hackathon-friendly |
| Object storage | IBM Cloud Object Storage | Protocol PDF storage |

**What NOT to use IBM for:**
- The core deviation detection logic — must be deterministic Python, not an LLM
- Severity final classification — rule matrix + human review, not LLM alone
- Real-time alerting — simple polling/WebSocket in FastAPI is sufficient for demo

---

## C. DATABASE SCHEMA

### sites
```
site_id         UUID PK
site_name       VARCHAR(200)
country         VARCHAR(100)
investigator    VARCHAR(200)
activation_date DATE
patient_count   INTEGER
status          ENUM('active','suspended','closed')
created_at      TIMESTAMP
```

### patients
```
patient_id      UUID PK
site_id         UUID FK → sites
patient_code    VARCHAR(50) UNIQUE  -- de-identified
enrollment_date DATE
arm             VARCHAR(100)        -- treatment/control/placebo
status          ENUM('enrolled','completed','withdrawn','lost_to_fu')
date_of_birth   DATE                -- for age calculation only
sex             CHAR(1)
created_at      TIMESTAMP
```

### protocol_versions
```
protocol_id     UUID PK
title           VARCHAR(300)
version         VARCHAR(20)
effective_date  DATE
document_url    VARCHAR(500)        -- IBM COS object URL
extracted_by    ENUM('ai','manual')
reviewed_by     VARCHAR(200)
review_date     DATE
status          ENUM('draft','active','superseded')
```

### protocol_rules
```
rule_id         UUID PK
protocol_id     UUID FK → protocol_versions
rule_code       VARCHAR(50) UNIQUE  -- e.g., DOSE-003
rule_type       ENUM('visit_window','dosing','lab','medication','eligibility','procedure')
description     TEXT
visit_number    INTEGER NULLABLE
expected_value  JSONB               -- {"value": 100, "unit": "mg"}
tolerance       JSONB               -- {"lower": 5, "upper": 5, "unit": "mg"}
comparator      ENUM('eq','between','lte','gte','not_in','present','absent')
severity_if_violated ENUM('administrative','minor','major')
active          BOOLEAN DEFAULT TRUE
source_text     TEXT                -- original protocol text passage
created_at      TIMESTAMP
```

### visits
```
visit_id        UUID PK
patient_id      UUID FK → patients
site_id         UUID FK → sites
visit_number    INTEGER
visit_type      VARCHAR(100)        -- screening/baseline/week4/etc
scheduled_date  DATE
actual_date     DATE NULLABLE
status          ENUM('completed','missed','pending','rescheduled')
data_entry_date TIMESTAMP
created_at      TIMESTAMP
```

### dosing_events
```
dose_id         UUID PK
visit_id        UUID FK → visits
patient_id      UUID FK → patients
drug_code       VARCHAR(100)
scheduled_dose  DECIMAL(10,3)
actual_dose     DECIMAL(10,3)
dose_unit       VARCHAR(20)
administered_by VARCHAR(200)
administration_date TIMESTAMP
route           VARCHAR(50)
created_at      TIMESTAMP
```

### lab_results
```
lab_id          UUID PK
visit_id        UUID FK → visits
patient_id      UUID FK → patients
test_code       VARCHAR(100)
test_name       VARCHAR(200)
result_value    DECIMAL(15,5)
result_unit     VARCHAR(50)
normal_low      DECIMAL(15,5)
normal_high     DECIMAL(15,5)
result_date     DATE
created_at      TIMESTAMP
```

### medications
```
med_id          UUID PK
patient_id      UUID FK → patients
drug_name       VARCHAR(300)
drug_class      VARCHAR(200)
start_date      DATE
end_date        DATE NULLABLE
dose            VARCHAR(100)
indication      VARCHAR(300)
reported_by     VARCHAR(200)
created_at      TIMESTAMP
```

### deviations
```
deviation_id    UUID PK
patient_id      UUID FK → patients
site_id         UUID FK → sites
visit_id        UUID FK → visits NULLABLE
rule_id         UUID FK → protocol_rules
deviation_date  DATE
description     TEXT
expected_value  TEXT
actual_value    TEXT
severity        ENUM('administrative','minor','major')
severity_source ENUM('rule_engine','ai_assisted','human_override')
status          ENUM('open','acknowledged','resolved','closed')
detected_at     TIMESTAMP
detected_by     ENUM('system','manual')
created_at      TIMESTAMP
```

### site_risk_scores
```
score_id        UUID PK
site_id         UUID FK → sites
calculation_date DATE
total_score     DECIMAL(5,2)        -- 0-100
risk_level      ENUM('low','medium','high','critical')
-- Component scores
deviation_freq_score     DECIMAL(5,2)
major_dev_score          DECIMAL(5,2)
repeat_dev_score         DECIMAL(5,2)
missed_visit_score       DECIMAL(5,2)
dosing_error_score       DECIMAL(5,2)
prohibited_med_score     DECIMAL(5,2)
trend_score              DECIMAL(5,2)
data_delay_score         DECIMAL(5,2)
peer_comparison_score    DECIMAL(5,2)
safety_indicator_score   DECIMAL(5,2)
score_explanation        TEXT
created_at               TIMESTAMP
```

### capa_actions
```
capa_id         UUID PK
deviation_id    UUID FK → deviations NULLABLE
site_id         UUID FK → sites
capa_type       ENUM('corrective','preventive','both')
title           VARCHAR(300)
description     TEXT
root_cause      TEXT
immediate_action TEXT
preventive_action TEXT
responsible_role VARCHAR(200)
priority        ENUM('critical','high','medium','low')
due_date        DATE
status          ENUM('draft','pending_review','approved','in_progress','completed','overdue')
generated_by    ENUM('ai_draft','manual')
reviewed_by     VARCHAR(200) NULLABLE
review_date     DATE NULLABLE
follow_up_required BOOLEAN
created_at      TIMESTAMP
```

### audit_logs
```
log_id          UUID PK
entity_type     VARCHAR(100)
entity_id       UUID
action          VARCHAR(100)        -- created/updated/reviewed/approved
performed_by    VARCHAR(200)
performed_at    TIMESTAMP
old_value       JSONB NULLABLE
new_value       JSONB NULLABLE
ip_address      VARCHAR(50)
session_id      VARCHAR(100)
```

---

## D. PROTOCOL RULE ENGINE

### Rule Extraction Pipeline
```
Protocol PDF/DOCX
        |
        v
watsonx.ai Text Extraction API
  → extracts text blocks, tables, numbered sections
        |
        v
watsonx.ai Prompt (few-shot):
  "Given this protocol text, extract structured rules in JSON:
   {rule_code, rule_type, visit_number, expected_value, tolerance, severity_if_violated}"
        |
        v
Structured JSON rules → Human review screen in UI → Approved rules stored in protocol_rules table
        |
        v
Python Rule Evaluator
  for each patient visit:
    for each active rule:
      evaluate rule condition against patient data
      if violated → emit deviation
```

### Rule Evaluation Logic
```python
def evaluate_rule(rule, patient_data):
    actual = get_actual_value(rule, patient_data)
    expected = rule['expected_value']

    if rule['comparator'] == 'between':
        low = expected['value'] - rule['tolerance']['lower']
        high = expected['value'] + rule['tolerance']['upper']
        violated = not (low <= actual <= high)

    elif rule['comparator'] == 'eq':
        violated = (actual != expected['value'])

    elif rule['comparator'] == 'not_in':
        violated = (actual in expected['prohibited_list'])

    elif rule['comparator'] == 'present':
        violated = (actual is None)

    elif rule['comparator'] == 'lte':
        violated = (actual > expected['value'])

    if violated:
        return Deviation(
            rule_id=rule['rule_id'],
            expected=expected,
            actual=actual,
            severity=rule['severity_if_violated']
        )
    return None
```

### 10 Realistic Protocol Deviation Examples

**DEV-001 — Dose Out of Range**
```
Rule: DOSE-003
Type: dosing
Visit: 3
Expected: 100 mg ± 5 mg (95–105 mg)
Actual: 150 mg
Result: DEVIATION
Severity: MAJOR
Reason: >20% over protocol dose, patient safety risk
```

**DEV-002 — Visit Window Exceeded**
```
Rule: VISIT-002
Type: visit_window
Visit: 2 (Week 4)
Expected: Day 28 ± 3 days (Day 25–31)
Actual: Day 41
Result: DEVIATION
Severity: MINOR
Reason: >7 days outside window; data reliability concern, not immediate safety
```

**DEV-003 — Prohibited Co-Medication**
```
Rule: MED-007
Type: medication
Expected: Patient must NOT take warfarin during study
Actual: Warfarin 5 mg/day detected (concurrent with study drug)
Result: DEVIATION
Severity: MAJOR
Reason: Drug-drug interaction risk; explicit protocol prohibition
```

**DEV-004 — Missed Required Visit**
```
Rule: VISIT-004
Type: visit_window
Visit: 4 (Week 12 safety assessment)
Expected: Visit must occur between Day 84–98
Actual: No visit recorded
Result: DEVIATION
Severity: MAJOR (safety visit missed) / MINOR (non-safety)
Reason: Mandatory safety data not collected
```

**DEV-005 — Lab Test Not Performed**
```
Rule: LAB-001
Type: lab
Visit: 1 (baseline)
Expected: HbA1c measurement present
Actual: NULL (not recorded)
Result: DEVIATION
Severity: MINOR
Reason: Protocol-required test absent; data completeness affected
```

**DEV-006 — Eligibility Criterion Violation (Post-Enrollment)**
```
Rule: ELIG-002
Type: eligibility
Expected: eGFR ≥ 60 mL/min/1.73m² at screening
Actual: eGFR = 45 mL/min/1.73m² (missed at screening)
Result: DEVIATION
Severity: MAJOR
Reason: Patient should not have been enrolled; per-protocol population affected
```

**DEV-007 — Informed Consent Re-signed After Amendment**
```
Rule: CONSENT-001
Type: procedure
Expected: Patient must re-sign consent within 14 days of Protocol Amendment v2.1
Actual: Re-consent date is 31 days after amendment effective date
Result: DEVIATION
Severity: ADMINISTRATIVE
Reason: Procedural delay; no data or safety impact detected
```

**DEV-008 — Wrong Administration Route**
```
Rule: DOSE-011
Type: dosing
Expected: Intravenous infusion
Actual: Subcutaneous injection recorded
Result: DEVIATION
Severity: MAJOR
Reason: Route deviation changes pharmacokinetics and patient safety profile
```

**DEV-009 — Blinding Broken Without Approval**
```
Rule: BLIND-001
Type: procedure
Expected: Blinding must be maintained; unblinding requires Medical Monitor approval
Actual: Site unblinded patient without documented approval
Result: DEVIATION
Severity: MAJOR
Reason: Bias introduced; data integrity at risk
```

**DEV-010 — Late Data Entry**
```
Rule: DATA-002
Type: procedure
Expected: eCRF data entry ≤ 5 business days from visit
Actual: Entry 18 days after visit
Result: DEVIATION
Severity: ADMINISTRATIVE
Reason: No safety impact; process compliance issue
```

---

## E. DEVIATION SEVERITY ENGINE

### Decision Matrix (Deterministic Rules First)

```
SEVERITY = MAJOR if ANY of:
  - Patient safety risk (wrong dose >10%, prohibited medication, wrong route)
  - Eligibility violation (patient should not have been enrolled)
  - Mandatory safety visit missed
  - Blinding broken
  - ICF not obtained before study procedures
  - Endpoint data collection failure (primary endpoint visit missed)

SEVERITY = MINOR if ANY of (and not MAJOR):
  - Visit window exceeded > 7 days (non-safety visit)
  - Required non-safety lab test not performed
  - Dose deviation within 10-20% of expected
  - Secondary endpoint data missing

SEVERITY = ADMINISTRATIVE if ALL of:
  - No patient safety concern
  - No data integrity impact
  - No regulatory reporting obligation
  - Examples: late data entry, minor consent process delays, documentation errors
```

### AI Assistance Role
- watsonx.ai is used to: (a) provide textual explanation of why a rule maps to a severity, (b) flag novel patterns not covered by current rules, (c) assist human reviewers with context from the protocol document
- watsonx.ai NEVER: makes the final regulatory severity determination without human review
- All AI-assisted severity classifications are flagged as `severity_source = 'ai_assisted'` and require human confirmation before being used in regulatory submissions

### Human Override
Every deviation has an `Override Severity` button in the UI that records the reviewer's identity, timestamp, justification, and old/new severity in the audit log.

---

## F. SITE RISK SCORING

### Formula
```
Score = (W1 × DeviationFreq) + (W2 × MajorDevCount) + (W3 × RepeatDev) 
      + (W4 × MissedVisits) + (W5 × DosingErrors) + (W6 × ProhibitedMeds) 
      + (W7 × TrendScore) + (W8 × DataDelay) + (W9 × PeerComparison)
      + (W10 × SafetyIndicator)

Where weights sum to 100:
W1=15, W2=20, W3=10, W4=10, W5=15, W6=10, W7=8, W8=5, W9=4, W10=3

Each component is normalized 0–10 before weighting.
Final score: 0–100. Risk levels: 0-25=Low, 26-50=Medium, 51-75=High, 76-100=Critical
```

### Component Definitions
- **DeviationFreq (W1=15):** `(total_deviations / total_visits) × 10` — capped at 10
- **MajorDevCount (W2=20):** `min(major_deviations × 2.5, 10)` — heavily weighted
- **RepeatDev (W3=10):** `min(repeat_same_rule_violations × 2, 10)` — pattern indicator
- **MissedVisits (W4=10):** `(missed_visits / scheduled_visits) × 10`
- **DosingErrors (W5=15):** `min(dosing_deviations × 3.33, 10)`
- **ProhibitedMeds (W6=10):** `min(prohibited_med_events × 5, 10)` — sharp step function
- **TrendScore (W7=8):** `min(deviation_trend_30d × 3.33, 10)` — increasing rate of deviations
- **DataDelay (W8=5):** `(avg_days_late_entry / 5) × 10` — capped at 10
- **PeerComparison (W9=4):** `if site_deviation_rate > (mean + 2σ) then 8 else proportional`
- **SafetyIndicator (W10=3):** `min(SAE_count × 2, 10)` — serious adverse events

### Worked Example — 3 Sites

**Site 101 — Low Risk**
```
Visits: 50  |  Deviations: 3  |  Major: 0  |  Repeat: 0
Missed visits: 1  |  Dosing errors: 1  |  Prohibited meds: 0
Trend: stable  |  Avg data delay: 2 days  |  SAEs: 0

DeviationFreq: (3/50)×10 = 0.6 → ×15 = 9.0
MajorDevCount: 0 → ×20 = 0
RepeatDev: 0 → ×10 = 0
MissedVisits: (1/50)×10 = 0.2 → ×10 = 2.0
DosingErrors: 1×3.33 = 3.33 → ×15 = 50 (component=5.0 of 10 → 50)
... (simplified)
TOTAL SCORE ≈ 14  →  LOW RISK
```

**Site 104 — High Risk**
```
Visits: 60  |  Deviations: 18  |  Major: 6  |  Repeat: 4 (same dosing rule)
Missed visits: 8  |  Dosing errors: 5  |  Prohibited meds: 2
Trend: +40% increase in last 30 days  |  Avg data delay: 9 days  |  SAEs: 1

DeviationFreq: (18/60)×10 = 3.0 → ×15 = 45
MajorDevCount: min(6×2.5,10) = 10 → ×20 = 200
RepeatDev: min(4×2,10) = 8 → ×10 = 80
MissedVisits: (8/60)×10 = 1.33 → ×10 = 13.3
DosingErrors: min(5×3.33,10) = 10 → ×15 = 150
ProhibitedMeds: min(2×5,10) = 10 → ×10 = 100
TrendScore: (trend=4)×3.33=10 → ×8 = 80 (capped)
DataDelay: (9/5)×10 = 10 → ×5 = 50
PeerComparison: above 2σ → 8 → ×4 = 32
SafetyIndicator: 1×2 = 2 → ×3 = 6
SUM = 756 / 100 = 75.6 → HIGH RISK (approaching Critical)
```

**Site 107 — Medium Risk**
```
Visits: 45  |  Deviations: 7  |  Major: 1  |  Repeat: 1
Missed visits: 3  |  Dosing errors: 2  |  Prohibited meds: 0
Trend: stable  |  Avg data delay: 4 days  |  SAEs: 0

TOTAL SCORE ≈ 38  →  MEDIUM RISK
```

---

## G. AI COMPONENT — WHERE AI HELPS AND WHERE IT DOES NOT

### USE AI FOR:
1. **Protocol Rule Extraction** — watsonx.ai text extraction + few-shot prompting to convert protocol PDF sections into structured JSON rules. Output is always human-reviewed before activation.
2. **CAPA Text Generation** — LLM drafts root cause analysis and corrective/preventive action text. Human CRA/QA reviews and approves before finalizing.
3. **Risk Narrative** — "Why is Site 104 high-risk?" — LLM generates plain-English explanation from site score components. Uses RAG: site data + protocol context as grounding.
4. **Cross-Site Pattern Detection** — LLM analyzes aggregated deviation patterns across sites and narrates insights (e.g., "3 sites share the same dosing error pattern for Rule DOSE-003").
5. **Protocol Q&A** — RAG-grounded assistant: user asks "What does the protocol say about Visit 3 dose tolerance?" and gets a cited answer.

### DO NOT USE AI FOR:
1. **Safety-critical deviation detection** — the rule engine fires deterministic checks; no LLM in the loop
2. **Final severity classification** — rule matrix gives the initial classification; AI can suggest, human confirms
3. **Eligibility determination** — must be rule-based, traceable
4. **CAPA approval** — humans must review and sign off
5. **Audit trail entries** — system-generated, tamper-evident log entries (not AI-generated)

### watsonx.ai Integration (Python SDK)
```python
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference

credentials = Credentials(url=WX_URL, api_key=WX_API_KEY)
client = APIClient(credentials, project_id=WX_PROJECT_ID)

model = ModelInference(
    model_id="ibm/granite-13b-chat-v2",
    api_client=client,
    params={"max_new_tokens": 500, "temperature": 0.2}
)

# CAPA generation
prompt = f"""You are a GCP clinical trial quality specialist.
Given this protocol deviation, generate a CAPA report draft:
Deviation: {deviation_description}
Site: {site_name}
Severity: {severity}
Protocol Rule: {rule_text}

Generate:
1. Root cause (2-3 sentences)
2. Immediate corrective action
3. Preventive action
4. Responsible role
Format as JSON."""

response = model.generate_text(prompt)
```

---

## H. CAPA GENERATION — 3 COMPLETE EXAMPLES

### CAPA-001 — Dosing Error at Site 104

```
CAPA ID:           CAPA-2024-104-001
Generated:         2024-03-15 (AI Draft)
Reviewed By:       [Pending — CRA Jane Smith]

DEVIATION:
  Rule:            DOSE-003 — IV Infusion Dose ± 5 mg
  Patient:         PT-104-022 (de-identified)
  Site:            Site 104 — City General Hospital
  Date:            2024-03-10, Visit 3
  Expected:        100 mg ± 5 mg
  Actual:          150 mg administered
  Severity:        MAJOR

EVIDENCE:
  Dosing record ID: DOSE-20240310-1042
  Administered by: Staff ID 4421
  Recorded in eCRF: 2024-03-12

ROOT CAUSE (AI-drafted, human review required):
  The nurse used the incorrect study drug vial labelled for a different patient
  cohort weight-band. The site's drug accountability log shows Cohort B vials 
  (150 mg) were stored alongside Cohort A vials (100 mg) without adequate 
  visual differentiation. No double-check procedure was followed.

IMMEDIATE CORRECTIVE ACTION:
  1. Site monitor to review all recent dosing records for same patient (PT-104-022)
  2. Medical Monitor notification for patient safety assessment
  3. Physical separation and color-coded labeling of Cohort A and B vials
  4. Site staff re-briefing on drug dispensing protocol within 48 hours

PREVENTIVE ACTION:
  1. Implement mandatory two-person check for all study drug dispensing
  2. Revise site SOPs to require pharmacist co-sign on all dose preparations
  3. Schedule quarterly unannounced drug accountability audits at Site 104
  4. Add automated dose-range alerts to site EDC system

RESPONSIBLE ROLE:  Site Principal Investigator + Site CRA
PRIORITY:          CRITICAL
DUE DATE:          2024-03-22 (corrective), 2024-04-15 (preventive)
FOLLOW-UP:         Yes — confirm completion of all actions; re-audit in 30 days
APPROVAL STATUS:   PENDING HUMAN REVIEW
```

### CAPA-002 — Prohibited Co-Medication at Site 107

```
CAPA ID:           CAPA-2024-107-002
Generated:         2024-03-16 (AI Draft)
Reviewed By:       [Pending — Medical Monitor Dr. Chen]

DEVIATION:
  Rule:            MED-007 — Warfarin prohibited during study
  Patient:         PT-107-008 (de-identified)
  Site:            Site 107 — North Medical Center
  Date:            2024-02-28 (co-medication start detected)
  Expected:        No warfarin at any time during study participation
  Actual:          Warfarin 5 mg daily prescribed by cardiologist, not disclosed
  Severity:        MAJOR

EVIDENCE:
  Concomitant medication report, Visit 4 eCRF
  Lab results showing INR=3.2 (supratherapeutic)

ROOT CAUSE (AI-drafted):
  The patient's cardiologist initiated warfarin for newly diagnosed atrial
  fibrillation without being informed of the ongoing clinical trial. The site
  did not have a formal process for alerting patients to report new prescriptions
  from non-study physicians between visits.

IMMEDIATE CORRECTIVE ACTION:
  1. Medical Monitor review of patient INR and safety data
  2. Patient counseling — reinforce prohibited medication list
  3. Contact cardiologist to explore alternative anticoagulation
  4. Consider patient continuation based on Medical Monitor risk-benefit review

PREVENTIVE ACTION:
  1. Provide all enrolled patients with a "Prohibited Medication Wallet Card"
  2. Train site staff to ask about new prescriptions at every contact
  3. Add automated concomitant medication screening at each eCRF data entry
  4. Quarterly reminder emails to patients about prohibited medications

RESPONSIBLE ROLE:  Site Principal Investigator + Medical Monitor
PRIORITY:          HIGH
DUE DATE:          2024-03-23 (corrective), 2024-04-30 (preventive)
FOLLOW-UP:         Yes — INR monitoring weekly; site audit in 30 days
APPROVAL STATUS:   PENDING HUMAN REVIEW
```

### CAPA-003 — Repeated Late Data Entry at Site 102

```
CAPA ID:           CAPA-2024-102-003
Generated:         2024-03-17 (AI Draft)
Reviewed By:       [Pending — CRA Mark Johnson]

DEVIATION:
  Rule:            DATA-002 — eCRF entry ≤ 5 business days from visit
  Site:            Site 102 — Westside Research Clinic
  Period:          Jan–Mar 2024 (12 occurrences)
  Expected:        ≤ 5 business days
  Actual:          Average 11.3 days; max 22 days
  Severity:        ADMINISTRATIVE (but TRENDING — risk escalation imminent)

EVIDENCE:
  Audit trail: 12 late entries detected, Visit IDs on file

ROOT CAUSE (AI-drafted):
  Site coordinator position was vacant for 6 weeks (Jan 15 – Feb 28). 
  The backup coordinator had insufficient eCRF training and was managing 
  two concurrent studies. No escalation process was triggered despite 
  the gap exceeding 10 days.

IMMEDIATE CORRECTIVE ACTION:
  1. Prioritize backlog data entry and complete all outstanding eCRFs by 2024-03-25
  2. Sponsor QA review of all late-entered data for accuracy
  3. Site coordinator hired; verify EDC credentials and training

PREVENTIVE ACTION:
  1. Require sites to notify sponsor within 3 days of any staffing changes
  2. Establish backup coordinator training and readiness requirements
  3. Automated weekly data entry lag alerts sent to site and sponsor CRA
  4. Escalation protocol: >7-day average lag triggers site risk score increase

RESPONSIBLE ROLE:  Site PI + Sponsor CRA + Clinical Operations Manager
PRIORITY:          MEDIUM
DUE DATE:          2024-03-25 (corrective), 2024-05-01 (preventive)
FOLLOW-UP:         Yes — weekly data entry monitoring for 60 days
APPROVAL STATUS:   PENDING HUMAN REVIEW
```

---

## I. DASHBOARD DESIGN

### Screen 1 — Executive Risk Dashboard
**What the user sees:**
- KPI cards: Total Patients (e.g., 423), Active Sites (10), Open Deviations (47), Critical Sites (2), Major Deviations This Month (12)
- World map / US map with site pins colored by risk level (green/yellow/orange/red)
- Bar chart: Top 5 High-Risk Sites
- Line chart: Deviation trend over last 90 days (major / minor / administrative)
- Alert banner: "⚠ Site 104 risk score increased to 75.6 — CAPA required"

**User actions:** Click site pin → go to Site Details. Click deviation count → go to Deviation Center. Export PDF report.

### Screen 2 — Site Risk Ranking
**What the user sees:**
- Sortable table: Site | Country | Patients | Total Deviations | Major | Risk Score | Trend Arrow | Last Audit | Status
- Color-coded risk level badges
- Sparkline mini-charts showing 30-day deviation trend per site
- Filter by: country, risk level, deviation type

**User actions:** Sort by risk score, filter, click row → Site Details, trigger on-demand risk recalculation.

### Screen 3 — Site Details
**What the user sees:**
- Site header: name, investigator, country, activation date
- Risk Score gauge (0–100) with component breakdown (spider/radar chart showing 10 components)
- Deviation list for this site (paginated, filterable by severity)
- Patient roster with individual risk indicators
- Open CAPAs for this site
- "Why is this site high-risk?" button → calls watsonx.ai and displays plain-English explanation

**User actions:** Open patient record, create manual CAPA, override deviation severity, export site audit report.

### Screen 4 — Patient/Visit Details
**What the user sees:**
- Patient timeline: horizontal swimlane showing all scheduled vs actual visits
- Each visit: green (on-time/complete), yellow (minor issue), red (major deviation), grey (missed)
- Visit detail panel: date, status, deviations detected, lab results, dosing events
- Concomitant medication history
- Deviation badge count per visit

**User actions:** Click visit → see deviation details, navigate to CAPA, view raw eCRF data, flag for manual review.

### Screen 5 — Protocol Deviation Center
**What the user sees:**
- All deviations across all sites in a filterable table
- Columns: ID | Site | Patient | Date | Rule | Description | Severity | Status | CAPA Status
- Severity distribution donut chart (Major / Minor / Administrative)
- Filter by: severity, site, rule type, date range, status
- Bulk actions: acknowledge, assign CAPA, export

**User actions:** Click deviation → full details + evidence, generate CAPA for deviation, override severity with justification.

### Screen 6 — CAPA Management
**What the user sees:**
- Kanban board: Draft → Pending Review → Approved → In Progress → Completed
- Each card: CAPA ID, site, deviation, priority badge, due date, assignee, days open
- Overdue CAPAs highlighted in red
- "Generate AI CAPA" button for open deviations

**User actions:** Drag CAPA card between stages, open CAPA detail, edit AI-drafted text, approve/reject, assign owner, add comments.

### Screen 7 — Protocol Rule Viewer
**What the user sees:**
- Protocol version selector
- List of all rules with rule code, type, description, and current violation count
- Rule detail panel: original protocol text + extracted machine rule + tolerances
- Rules flagged as "AI-extracted, pending review" shown with yellow badge
- Diff view when protocol is updated

**User actions:** Review and approve AI-extracted rules, manually add/edit rules, deactivate rules, view which patients/sites have violated each rule.

### Screen 8 — Audit Trail
**What the user sees:**
- Full chronological log of all system events: deviation detected, severity changed, CAPA created, rule approved, user logged in, etc.
- Columns: Timestamp | User | Action | Entity | Old Value | New Value | Session ID
- Immutable (read-only) — no edits possible
- Filter by user, action type, entity type, date range
- Export to CSV for FDA audit submissions

**User actions:** Filter, search, export. Read-only.

---

## J. DEMO SYNTHETIC DATA

### Sites (10)
```
Site 101 — Metro Clinical (New York, USA)          — LOW risk
Site 102 — Westside Research (Los Angeles, USA)    — MEDIUM risk (late data entry)
Site 103 — Central Trials (Chicago, USA)           — LOW risk
Site 104 — City General Hospital (Houston, USA)    — HIGH risk (dosing errors, prohibited meds)
Site 105 — Northgate Medical (Boston, USA)         — MEDIUM risk
Site 106 — Riverside Institute (London, UK)        — LOW risk
Site 107 — North Medical Center (Toronto, Canada)  — MEDIUM risk (prohibited medication)
Site 108 — Southern Research (Sydney, Australia)   — LOW risk
Site 109 — Pacific Trials (Tokyo, Japan)           — LOW risk
Site 110 — Alpine Clinical (Zurich, Switzerland)   — MEDIUM risk (missed visits)
```

### Patients: 100 total (10 per site)
Patient codes: PT-101-001 through PT-110-010

### Visits per Patient: 6 visits each (Screening, Baseline, Week4, Week8, Week12, EOS)
Total visits: ~600

### Injected Deviations (anomalies for demo):
- Site 104: 6 MAJOR dosing deviations, 2 prohibited medication events, 4 missed safety visits
- Site 102: 12 late data entry (administrative, but trending toward escalation)
- Site 107: 2 prohibited co-medication events (warfarin), 3 missed visits
- Site 110: 5 visit window violations (minor), 2 missed non-safety labs
- Site 105: 1 eligibility criterion violation (MAJOR), 1 missed consent re-sign

### Protocol Rules: 20 rules across 5 types
- 5 dosing rules (DOSE-001 through DOSE-005)
- 5 visit window rules (VISIT-001 through VISIT-005)
- 4 medication prohibition rules (MED-001 through MED-004)
- 3 lab requirement rules (LAB-001 through LAB-003)
- 3 procedural rules (DATA-001, CONSENT-001, BLIND-001)

---

## K. HACKATHON MVP — PRIORITY BREAKDOWN

### MUST HAVE (Core Demo)
- [ ] PostgreSQL schema with synthetic data seeded
- [ ] Protocol Rule Engine (Python) — evaluates all 20 rules
- [ ] Deviation Detection — fires for all injected anomalies
- [ ] Severity Classification — deterministic rule matrix
- [ ] Site Risk Scoring — formula with all 10 components
- [ ] watsonx.ai CAPA generation — at least 1 live call in demo
- [ ] React Dashboard — Screens 1, 2, 3 (Executive, Ranking, Site Details)
- [ ] Patient/Visit timeline — Screen 4
- [ ] Deviation Center — Screen 5
- [ ] Audit Trail — Screen 8

### SHOULD HAVE
- [ ] Protocol Rule Viewer — Screen 7 (show AI-extracted rules)
- [ ] CAPA Management Kanban — Screen 6
- [ ] watsonx.ai "Why is this site high-risk?" explanation
- [ ] Protocol PDF upload → watsonx.ai text extraction demo
- [ ] Override severity with audit logging

### NICE TO HAVE
- [ ] RAG-based protocol Q&A chat widget
- [ ] watsonx.governance factsheet link
- [ ] watsonx.data connection story (demo with Presto instead of PostgreSQL)
- [ ] Real-time WebSocket deviation alerts
- [ ] PDF export of CAPA reports

---

## L. DEMO STORY (5-Minute Walkthrough)

```
Minute 0:30 — CONTEXT
  "This is a Phase III clinical trial with 5,000+ patient visits. 
   An FDA audit is in 3 months. Right now, nobody has a complete 
   picture of protocol compliance across all 200 sites."

Minute 1:00 — PROTOCOL UPLOAD
  → Drag-and-drop Protocol PDF into the UI
  → System calls watsonx.ai Text Extraction API
  → 20 structured rules appear in the Protocol Rule Viewer
  → "The AI extracted these rules — we review and approve them"
  → Approve rules with one click

Minute 1:30 — DATA LOAD
  → Upload patient records CSV (pre-prepared)
  → Rule engine runs — progress bar shows 600 visits checked
  → "47 deviations detected across 10 sites"

Minute 2:00 — EXECUTIVE DASHBOARD
  → Map appears: most sites green, Site 104 RED
  → Risk Score: Site 104 = 75.6 (High)
  → Alert: "6 Major Deviations, 2 Prohibited Medication Events"

Minute 2:30 — SITE 104 DRILL-DOWN
  → Click Site 104 on map
  → Radar chart shows: Dosing Errors and Major Deviations maxed out
  → Click "Why is this site high-risk?"
  → watsonx.ai generates: "Site 104 has 6 major dosing deviations 
     involving dose overages of 40-50%, representing a pattern 
     consistent with inadequate staff training..."

Minute 3:00 — PATIENT DETAIL
  → Click patient PT-104-022
  → Visit timeline: Visit 3 has RED badge — MAJOR deviation
  → Click visit: expected 100 mg, actual 150 mg, ±5 mg tolerance
  → Rule DOSE-003 violated

Minute 3:30 — CAPA GENERATION
  → Click "Generate CAPA" on the deviation
  → watsonx.ai generates full CAPA in 3 seconds
  → Root cause, corrective action, preventive action appear
  → Click "Submit for Review" → CAPA moves to Pending Review in Kanban

Minute 4:00 — AUDIT TRAIL
  → Show Audit Trail: every action timestamped and attributed
  → "Everything is traceable — every AI decision is logged 
     with human review status"

Minute 4:30 — SUMMARY
  → Return to Executive Dashboard
  → "From protocol upload to high-risk site identified to CAPA 
     generated — in under 5 minutes. Before FDA audit. 
     Not 6 months after."

Minute 5:00 — CLOSE
  "This system can process 5,000+ visits in seconds. 
   It identifies what would take an audit team months.
   It generates CAPA drafts in 3 seconds.
   It runs on IBM watsonx.ai and IBM Cloud."
```

---

## M. IMPLEMENTATION PLAN

### Step 1 — Database & Synthetic Data
**What:** Set up PostgreSQL, create all tables, seed synthetic data (10 sites, 100 patients, 600 visits, 20 protocol rules, injected deviations)
**Technology:** PostgreSQL + Python (seed script with Faker library)
**Input:** Schema design (section C above)
**Output:** Populated database ready for rule engine
**Dependencies:** None

### Step 2 — Protocol Rule Engine
**What:** Python module that loads rules from DB and evaluates them against patient/visit/dosing/medication data; emits deviation records
**Technology:** Python 3.11, SQLAlchemy ORM
**Input:** protocol_rules + visits + dosing_events + medications tables
**Output:** deviations table populated
**Dependencies:** Step 1

### Step 3 — Severity Classification Module
**What:** Python module applying deterministic severity matrix from Section E
**Technology:** Python
**Input:** Deviation type, rule_type, degree of violation
**Output:** Severity field set on each deviation (administrative/minor/major)
**Dependencies:** Step 2

### Step 4 — Site Risk Scoring Engine
**What:** Python module computing all 10 risk components and total score per site; stores in site_risk_scores
**Technology:** Python + SQLAlchemy
**Input:** deviations, visits, dosing_events, medications tables
**Output:** site_risk_scores table populated
**Dependencies:** Step 2

### Step 5 — watsonx.ai Integration
**What:** Python service wrapping ibm-watsonx-ai SDK for: (a) CAPA text generation, (b) risk narrative generation, (c) protocol text extraction
**Technology:** Python + ibm-watsonx-ai SDK, Granite or Llama-3 model
**Input:** Deviation data, site risk components, protocol PDF text
**Output:** CAPA draft JSON, risk explanation text, extracted protocol rules JSON
**Dependencies:** IBM Cloud account + watsonx.ai project setup

### Step 6 — FastAPI Backend
**What:** REST API exposing all data to the React frontend: GET /sites, GET /deviations, POST /capa/generate, POST /protocol/upload-extract, GET /audit-trail
**Technology:** Python FastAPI + Uvicorn
**Input:** PostgreSQL database + watsonx.ai service
**Output:** JSON REST API
**Dependencies:** Steps 1–5

### Step 7 — React Frontend — Core Screens
**What:** Executive Dashboard (Screen 1), Site Ranking (Screen 2), Site Details (Screen 3), Patient Detail (Screen 4)
**Technology:** React 18 + Recharts + React-Query + TailwindCSS
**Input:** FastAPI backend
**Output:** Running web app
**Dependencies:** Step 6

### Step 8 — React Frontend — Deviation & CAPA Screens
**What:** Deviation Center (Screen 5), CAPA Management (Screen 6), Protocol Viewer (Screen 7), Audit Trail (Screen 8)
**Technology:** React 18 + Recharts
**Input:** FastAPI backend
**Output:** Complete UI
**Dependencies:** Step 7

### Step 9 — IBM Cloud Deployment
**What:** Containerize backend (Dockerfile), deploy to IBM Cloud Code Engine; IBM Cloud PostgreSQL; store protocol PDFs in IBM Cloud Object Storage
**Technology:** Docker, IBM Cloud Code Engine, IBM Cloud Databases for PostgreSQL
**Input:** Working application from Steps 1–8
**Output:** Live demo URL on IBM Cloud
**Dependencies:** Step 8

### Step 10 — Demo Run-Through & Polish
**What:** End-to-end demo rehearsal, fix any issues, prepare synthetic data edge cases for demo story
**Technology:** All of the above
**Input:** Complete deployed application
**Output:** Demo-ready system
**Dependencies:** Step 9

---

## N. FINAL RECOMMENDATION

### Best Choices

| Layer | Recommended Choice | Reason |
|---|---|---|
| Frontend | React 18 + TailwindCSS + Recharts | Modern, fast to build, great chart library for risk dashboards |
| Backend | Python FastAPI | Async, fast, excellent for hackathon speed and IBM SDK compatibility |
| Database | IBM Cloud Databases for PostgreSQL | Free tier, ACID, relational — perfect fit for structured trial data |
| IBM AI | watsonx.ai (Granite-13b-chat or Llama-3-70b) via ibm-watsonx-ai SDK | CAPA generation, risk narration, protocol extraction — verified capabilities |
| Protocol Extraction | watsonx.ai Text Extraction API + few-shot Prompt Lab | Proven to extract structured data from documents |
| Deviation Detection | Deterministic Python rule engine | Safety-critical — must be traceable, not probabilistic |
| Risk Scoring | Weighted formula (10 components) with transparent math | Explainable, auditable, defensible to judges and regulators |
| CAPA Generation | watsonx.ai (LLM draft) + human review gate | AI drafts, human approves — correct hybrid for regulated industry |
| Deployment | IBM Cloud Code Engine + IBM Cloud PostgreSQL | No Kubernetes overhead, IBM Cloud showcase |

### What Makes This Solution INNOVATIVE
1. **Hybrid intelligence architecture** — deterministic rules for safety, AI for narration and CAPA — correct design for regulated environments
2. **Leading indicator risk model** — predicts problems BEFORE FDA audit, not after
3. **Full auditability of AI decisions** — every AI output is flagged, logged, and requires human review
4. **Protocol-to-rules pipeline** — LLM + human review converts unstructured protocol documents into machine-executable rules automatically

### What Makes It TECHNICALLY FEASIBLE
- All IBM technologies used are real, documented, and accessible with free/trial tiers
- watsonx.ai ibm-watsonx-ai Python SDK is publicly available on PyPI
- PostgreSQL schema is well-understood, no exotic dependencies
- React + FastAPI is standard, hackathon-proven stack
- Synthetic data is self-contained — no real patient data required

### What Makes It DIFFERENT FROM A SIMPLE CHATBOT
- Core deviation detection is deterministic SQL + Python rules — not prompts
- Site risk score is a mathematical formula with 10 measurable components — not an LLM opinion
- Patient visit timeline and deviation evidence are from real structured data
- CAPA has a structured workflow with approval state machine
- Audit trail is an immutable system log — not AI-generated prose

### What Would IMPRESS HACKATHON JUDGES
1. Live demo: protocol PDF goes in, deviations come out, CAPA is generated in seconds
2. Transparent risk formula with component-level breakdown (radar chart)
3. IBM watsonx.ai live API call during demo
4. Regulatory awareness: ICH E6 GCP severity, human review gates, audit trail
5. Real-world relevance: $50–100M problem, FDA audit consequence
6. IBM Cloud deployment: live URL, not just localhost

### RISKS AND LIMITATIONS TO DISCLOSE
1. **AI severity classification is advisory only** — final determination requires qualified clinical expert
2. **Prototype only** — not validated for regulatory submission; requires formal validation and QMS integration
3. **Synthetic data** — real deployment requires HIPAA/GDPR-compliant data handling, BAA with IBM
4. **Protocol extraction accuracy** — LLM may miss rules in complex protocol sections; human review is mandatory
5. **watsonx.ai HIPAA-Ready Plan** — available in Dallas region only; requires IBM Sales engagement for BAA
6. **Rule engine completeness** — 20 rules demonstrate the concept; a real trial may have 200+ rules across multiple protocol versions

---

## SUB-TASKS FOR IMPLEMENTATION

### Sub-Task 1 — Project Scaffold & Database Setup [ ] pending
**Intent:** Create the full project structure and populate the database with synthetic demo data so all subsequent sub-tasks have a working data foundation.
**Expected Outcomes:** PostgreSQL schema created, 10 sites, 100 patients, ~600 visits, 20 protocol rules, and ~47 injected deviations all seeded and queryable.
**Todo List:**
- Create project directory structure: `/backend`, `/frontend`, `/scripts`, `/data`
- Write `schema.sql` with all tables from Section C
- Write `seed_data.py` using Python Faker — generate sites, patients, visits, dosing, labs, meds, protocol rules
- Inject specific anomalies for Site 104 (6 major dosing), Site 107 (prohibited meds), Site 102 (data delays)
- Verify data with spot-check queries
**Relevant Context:** Section C (Database Schema), Section J (Demo Synthetic Data)
**Status:** [ ] pending

### Sub-Task 2 — Protocol Rule Engine [ ] pending
**Intent:** Build the deterministic Python rule evaluator that checks every patient visit against every active protocol rule and writes deviation records.
**Expected Outcomes:** Running the engine against seeded data produces exactly the injected deviations (and no false positives).
**Todo List:**
- Implement `RuleEngine` class with `evaluate_rule(rule, patient_context)` method
- Handle all comparator types: `between`, `eq`, `not_in`, `present`, `absent`, `lte`, `gte`
- Implement severity classification matrix (Section E)
- Write deviations to `deviations` table with `detected_by='system'`
- Write unit tests for each deviation example in Section D
**Relevant Context:** Section D (Rule Engine), Section E (Severity Engine)
**Status:** [ ] pending

### Sub-Task 3 — Site Risk Scoring Engine [ ] pending
**Intent:** Implement the 10-component weighted risk scoring formula and persist per-site scores.
**Expected Outcomes:** Site 104 scores 70+, Site 101 scores under 20, scores update when new deviations are added.
**Todo List:**
- Implement `SiteRiskCalculator` class with all 10 component functions
- Normalize each component to 0–10 scale
- Apply weights (W1–W10) and compute total 0–100 score
- Assign risk level enum (low/medium/high/critical)
- Store in `site_risk_scores` with component breakdown and timestamp
- Expose a recalculate endpoint
**Relevant Context:** Section F (Site Risk Scoring), worked examples
**Status:** [ ] pending

### Sub-Task 4 — watsonx.ai Service [ ] pending
**Intent:** Build a Python service wrapping the ibm-watsonx-ai SDK for CAPA generation, risk narrative, and protocol rule extraction.
**Expected Outcomes:** Given a deviation, the service returns a structured CAPA draft JSON within 5 seconds. Given a site's risk components, it returns a 2–3 sentence natural-language explanation.
**Todo List:**
- Install `ibm-watsonx-ai` from PyPI
- Implement `WatsonxService` class with `generate_capa(deviation)`, `explain_site_risk(site_risk_data)`, `extract_protocol_rules(text)` methods
- Use Granite-13b-chat or Llama-3-70b-instruct
- Design few-shot prompts for each use case (Section G)
- Handle API errors and timeouts gracefully
- Return structured JSON for all outputs
**Relevant Context:** Section G (AI Component), Section H (CAPA Examples), watsonx.ai SDK docs
**Status:** [ ] pending

### Sub-Task 5 — FastAPI Backend [ ] pending
**Intent:** Expose all data and AI services via a clean REST API consumed by the React frontend.
**Expected Outcomes:** All API endpoints return correct data; CAPA generation endpoint calls watsonx.ai and returns draft.
**Todo List:**
- Set up FastAPI project with SQLAlchemy async session
- Implement endpoints: GET /sites, GET /sites/{id}, GET /patients/{id}, GET /deviations, POST /deviations/{id}/capa, POST /protocol/upload, GET /audit-logs, POST /sites/recalculate-risk
- Add CORS middleware for local React dev
- Write OpenAPI docs (automatic with FastAPI)
- Add audit log writes on all mutation endpoints
**Relevant Context:** Section M (Implementation Plan — Step 6)
**Status:** [ ] pending

### Sub-Task 6 — React Frontend [ ] pending
**Intent:** Build all 8 dashboard screens consuming the FastAPI backend, demonstrating the full demo story.
**Expected Outcomes:** Complete working web app: risk map, site ranking, deviation center, patient timeline, CAPA kanban, protocol viewer, audit trail.
**Todo List:**
- Scaffold React app with Vite, TailwindCSS, React-Query, Recharts
- Screen 1: KPI cards + site risk map (use react-simple-maps or Leaflet) + deviation trend chart
- Screen 2: Site risk ranking table with sparklines and risk badges
- Screen 3: Site detail with radar chart + deviation list + "Why high-risk?" button
- Screen 4: Patient visit timeline (swimlane) + deviation badges
- Screen 5: Deviation center table with filters
- Screen 6: CAPA kanban board
- Screen 7: Protocol rule viewer
- Screen 8: Audit trail table
**Relevant Context:** Section I (Dashboard Design)
**Status:** [ ] pending

### Sub-Task 7 — IBM Cloud Deployment [ ] pending
**Intent:** Deploy the complete system to IBM Cloud for a live demo URL.
**Expected Outcomes:** Application accessible at a public IBM Cloud Code Engine URL; database on IBM Cloud Databases for PostgreSQL.
**Todo List:**
- Provision IBM Cloud Databases for PostgreSQL (free/lite tier)
- Write Dockerfile for FastAPI backend
- Build and push to IBM Cloud Container Registry
- Deploy to IBM Cloud Code Engine
- Configure environment variables (DB connection, watsonx.ai credentials)
- Test all API endpoints against production database
- Verify frontend can be deployed as static site (Code Engine or IBM Cloud Object Storage + CDN)
**Relevant Context:** Section N (Best deployment approach)
**Status:** [ ] pending
