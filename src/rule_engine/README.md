# TrialGuard Rule Engine

Deterministic, evidence-only protocol deviation detector and site risk scorer for the
**Clinical Trial Risk Monitor & Protocol Deviation Detector**.

> **No LLM.  No randomness.  Same input always produces the same output.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Rule Engine - Deviation Detection](#rule-engine--deviation-detection)
3. [Risk Scorer - Site Risk Scoring](#risk-scorer--site-risk-scoring)
4. [Public API](#public-api)
5. [Data Models](#data-models)
6. [Running Tests](#running-tests)
7. [Design Invariants](#design-invariants)

---

## Architecture Overview

`
NORMAL DATA (protocol-compliant synthetic dataset)
        |
        v
inject_deviations.py          <- mutates records per deviation_scenarios.json
        |
        v
ABNORMAL CLINICAL EVENTS      <- dataset with injected anomalies
        |
        v
TrialGuardRuleEngine          <- evaluates every event against protocol rules
        |
        v
List[DetectedDeviation]       <- zero pre-populated; 100% derived from events
        |
        v
score_site / score_all_sites  <- risk scoring (Step 11)
        |
        v
SiteRiskScore                 <- risk_score in [0, 100], risk_level, components
`

Source of truth files:

| File | Role |
|---|---|
| src/protocol/protocol.json | Trial metadata, visit schedule, arm definitions |
| src/protocol/protocol_rules.json | Rule definitions, thresholds, severity escalation |
| src/protocol/deviations/deviation_scenarios.json | Injection manifest |

---

## Risk Scorer - Site Risk Scoring

### Formula

`
risk_score = Sum( normalized_score(component) * weight(component) )
`

isk_score is rounded to **2 decimal places** and lies in **[0, 100]**.

### Components and Weights

| Component key | Label | Weight | Ceiling | Measured |
|---|---|---|---|---|
| major_deviations | Major deviations | **0.30** | 10 | Count of major-severity deviations |
| dosing_violations | Dosing violations | **0.25** | 8 | Count of DOSE-* rule violations |
| missed_safety_visits | Missed safety visits | **0.20** | 5 | VISIT-003/004/005 major deviations |
| ule_breadth | Rule breadth (diversity) | **0.15** | 8 | Unique rule IDs violated |
| minor_deviations | Minor deviations | **0.10** | 15 | Count of minor deviations |
| **Total** | | **1.00** | | |

### Normalisation

`
normalized_score(c) = min(raw_value(c) / ceiling(c), 1.0) * 100
contribution(c)     = normalized_score(c) * weight(c)
`

### Risk-Level Thresholds

| Level | Score range |
|---|---|
| LOW | [0.00, 40.00) |
| MEDIUM | [40.00, 70.00) |
| HIGH | [70.00, 100.00] |

### Edge Cases

| Situation | Behaviour |
|---|---|
| Zero deviations | risk_score = 0.0, risk_level = 'LOW' |
| Only administrative deviations | risk_score = 0.0 |
| score_all_sites([]) | Returns [] without error |

---

## Public API

`python
from src.rule_engine.risk_score import score_site, score_all_sites

# Single site
result = score_site("SITE-104", detected_deviations)
print(result.risk_score)       # e.g. 62.54
print(result.risk_level)       # 'LOW' | 'MEDIUM' | 'HIGH'
print(result.top_risk_drivers) # e.g. ['Major deviations', 'Dosing violations']

# All sites, sorted descending by score
rankings = score_all_sites(all_deviations)
for s in rankings:
    print(f"{s.site_id}  {s.risk_score:.2f}  {s.risk_level}")
`

Both functions accept DetectedDeviation objects OR plain dicts (JSON-loaded data).

---

## Running Tests

`ash
# Risk scorer (41 tests)
python -m pytest src/tests/rule_engine/test_risk_score.py -v

# Full rule engine + data generator (56 tests)
python -m pytest src/tests/rule_engine/ src/tests/data_generator/ -v
`

---

## Design Invariants

1. **Determinism** - same input always produces the same output.
2. **No LLM, no randomness** - pure arithmetic on integer counts.
3. **Single formula** - exactly one implementation in isk_score.py.
4. **Weight sum guard** - ssert abs(sum(weights) - 1.0) < 1e-9 at import time.
5. **Site isolation** - a site's score is a pure function of its own deviations only.
6. **Administrative exclusion** - administrative deviations do NOT contribute to score.
