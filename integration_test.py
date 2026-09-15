import requests
import time
import json
from pprint import pprint

BASE_URL = "http://localhost:8000"

def test():
    print("Testing flows...")
    
    # 1. Health
    print("\n--- FLOW 1: HEALTH ---")
    resp = requests.get(f"{BASE_URL}/health")
    assert resp.status_code == 200, "Health endpoint failed"
    print("GET /health : OK")

    # 4. Engine
    print("\n--- FLOW 4: ENGINE ---")
    resp = requests.post(f"{BASE_URL}/run-engine", json={"num_sites": 2, "patients_per_site": 5})
    assert resp.status_code == 200, "Engine endpoint failed"
    engine_data = resp.json()
    assert "site_risk_scores" in engine_data
    assert "deviation_sample" in engine_data
    print("POST /run-engine : OK")
    
    # Get Site 104 if it exists in the data, or just take the first site
    site = engine_data["site_risk_scores"][0]
    devs = engine_data["deviation_sample"]
    print(f"Engine generated {len(engine_data['site_risk_scores'])} sites and {len(devs)} deviations.")

    # 5. Explain Risk
    print("\n--- FLOW 5: EXPLAIN RISK ---")
    explain_payload = {
        "site_id": site["site_id"],
        "site_name": f"Site {site['site_id']}",
        "risk_score": site["risk_score"],
        "risk_level": site["risk_level"].lower(),
        "total_patients": 5,
        "deviations": [
            {
                "deviation_id": d["deviation_id"],
                "rule_id": d["rule_id"],
                "category": d["category"],
                "severity": d["severity"].lower(),
                "description": d["description"],
                "visit": "V1",
                "affected_patients": 1,
                "occurrence_count": 1
            } for d in devs if d["site_id"] == site["site_id"]
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/ai/explain-risk", json=explain_payload)
        resp.raise_for_status()
        explain_data = resp.json()
        assert "explanation" in explain_data
        print("POST /ai/explain-risk : OK")
        print("Explanation snippet:", explain_data["explanation"][:100], "...")
        assert explain_data.get("risk_score") == site["risk_score"], "AI recalculating risk!"
    except requests.exceptions.HTTPError as e:
        print(f"Error calling /ai/explain-risk: {e.response.text}")
        if "Missing required environment" in e.response.text:
            print("WARNING: Watsonx credentials missing, mock path expected.")

    # 2. Extract Protocol
    print("\n--- FLOW 2: EXTRACT PROTOCOL ---")
    try:
        resp = requests.post(f"{BASE_URL}/ai/extract-protocol", json={"protocol_text": "Patients must take 10mg orally."})
        resp.raise_for_status()
        ext_data = resp.json()
        rules = ext_data["rules"]
        assert len(rules) > 0, "No rules extracted"
        assert all(r["status"] == "pending" for r in rules), "Rules not starting as pending!"
        print("POST /ai/extract-protocol : OK")
        print(f"Extracted {len(rules)} rules, all are PENDING.")
    except requests.exceptions.HTTPError as e:
        print(f"Error calling /ai/extract-protocol: {e.response.text}")

    # 7. Generate CAPA
    print("\n--- FLOW 7: GENERATE CAPA ---")
    if len(devs) > 0:
        dev = devs[0]
        capa_payload = {
            "deviation_id": dev["deviation_id"],
            "rule_id": dev["rule_id"],
            "category": dev["category"],
            "severity": dev["severity"].lower(),
            "description": dev["description"],
            "protocol_requirement": dev.get("expected", "Follow protocol"),
            "site_id": dev["site_id"]
        }
        try:
            resp = requests.post(f"{BASE_URL}/ai/generate-capa", json=capa_payload)
            resp.raise_for_status()
            capa_data = resp.json()
            assert capa_data["status"] == "draft", "CAPA not starting as draft!"
            assert capa_data["human_review_required"] is True
            print("POST /ai/generate-capa : OK")
            print("CAPA is generated as DRAFT and requires human review.")
        except requests.exceptions.HTTPError as e:
            print(f"Error calling /ai/generate-capa: {e.response.text}")
    else:
        print("No deviations generated, skipping CAPA.")

if __name__ == "__main__":
    test()
