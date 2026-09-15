import time
import requests
import json
from sqlalchemy import create_engine, text
from src.backend.db_models import Base

BASE_URL = "http://localhost:8000"

def run_verification():
    print("1. Triggering /run-engine...")
    resp = requests.post(f"{BASE_URL}/run-engine", json={"num_sites": 2, "patients_per_site": 2})
    resp.raise_for_status()
    print("Engine Run Success!")

    print("\n2. Querying Database for direct counts...")
    engine = create_engine("sqlite:///./trialguard.db")
    
    table_names = [
        "engine_runs", "sites", "patients", "visits", "labs", "doses", "medications", 
        "detected_deviations", "site_risk_scores", "capas", "protocol_rules_review", "audit_logs"
    ]
    
    with engine.connect() as conn:
        for t in table_names:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"Table '{t}': {count} rows")
            except Exception as e:
                print(f"Table '{t}': Error {e}")

    print("\n3. Testing /ai/extract-protocol-pdf with fixture...")
    with open("src/tests/fixtures/synthetic_protocol.pdf", "rb") as f:
        resp = requests.post(f"{BASE_URL}/ai/extract-protocol-pdf", files={"file": ("synthetic_protocol.pdf", f, "application/pdf")})
        if resp.status_code == 200:
            data = resp.json()
            print(f"Extraction Success! Extracted {len(data.get('rules', []))} rules.")
        else:
            print(f"Extraction Failed: {resp.status_code} {resp.text}")

    print("\n4. Testing /ai/generate-capa...")
    devs = requests.get(f"{BASE_URL}/deviations").json()
    if devs:
        first_dev = devs[0]
        print(f"Generating CAPA for Deviation {first_dev['deviation_id']}...")
        capa_resp = requests.post(f"{BASE_URL}/ai/generate-capa", json={
            "deviation_id": first_dev['deviation_id'],
            "rule_id": first_dev['rule_id'],
            "category": first_dev['category'],
            "severity": first_dev['severity'],
            "description": first_dev['description'],
            "protocol_requirement": first_dev['expected'],
            "site_id": first_dev['site_id']
        })
        if capa_resp.status_code == 200:
            print("CAPA Generation Success!")
        else:
            print(f"CAPA Generation Failed: {capa_resp.status_code} {capa_resp.text}")
    else:
        print("No deviations found to generate CAPA.")

if __name__ == "__main__":
    run_verification()
