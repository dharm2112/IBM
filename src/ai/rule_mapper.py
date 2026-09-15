import json
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

def get_canonical_rules() -> list[dict]:
    base_dir = Path(__file__).resolve().parents[2]
    candidates = [
        base_dir / "src" / "protocol" / "rules" / "protocol_rules.json",
        base_dir / "src" / "protocol" / "protocol_rules.json",
        base_dir / "protocol_rules.json",
    ]
    rules_path = next((p for p in candidates if p.exists()), None)
    if not rules_path:
        return []
    with open(rules_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("rules", [])

def suggest_canonical_mapping(extracted_rule: dict, canonical_rules: list[dict]) -> Tuple[Optional[str], str, str]:
    """
    Returns (canonical_rule_id, mapping_status, mapping_reason)
    """
    cat = extracted_rule.get("category", "").lower()
    desc = extracted_rule.get("description", "").lower()
    
    # Simple deterministic matching based on category and description keywords
    for rule in canonical_rules:
        if rule.get("category") == cat:
            r_name = rule.get("name", "").lower()
            r_desc = rule.get("description", "").lower()
            
            # Simple keyword overlap heuristic for demo purposes
            keywords = [w for w in desc.split() if len(w) > 4]
            match_count = sum(1 for kw in keywords if kw in r_name or kw in r_desc)
            
            if len(keywords) > 0 and match_count / len(keywords) > 0.3:
                return rule["rule_id"], "pending", f"Automatically suggested based on keyword match in {cat} category."
                
    return None, "unsupported", "No matching canonical rule found for this category and description."
