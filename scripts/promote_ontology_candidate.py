import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import yaml
from datetime import datetime

def promote_candidate(candidate_name: str, target_status: str = "ACTIVE"):
    print(f"=== Ontology Evolution: Promoting Candidate '{candidate_name}' ===")
    
    relations_path = "ontology/canonical/relations.yaml"
    if not os.path.exists(relations_path):
        print(f"Error: {relations_path} not found.")
        return

    with open(relations_path, "r", encoding="utf-8") as f:
        rel_data = yaml.safe_load(f) or {}

    relations = rel_data.get("relations", {})
    if candidate_name in relations:
        print(f"Candidate '{candidate_name}' is already in canonical relations. Updating status to {target_status}.")
    else:
        # Add new canonical relation
        relations[candidate_name] = {
            "domain": ["ENTITY", "EVENT"],
            "range": ["ENTITY", "EVENT", "STATE"],
            "causalStrength": "MEDIUM",
            "requiresEvidence": True,
            "aliases": [candidate_name.lower().replace("_", " ")]
        }
        print(f"Successfully promoted '{candidate_name}' to canonical relations!")

    rel_data["relations"] = relations
    rel_data["lastUpdated"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    with open(relations_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(rel_data, f, allow_unicode=True, sort_keys=False)

    print("Canonical relations updated in ontology/canonical/relations.yaml")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        promote_candidate(sys.argv[1])
    else:
        print("Usage: python scripts/promote_ontology_candidate.py <CANDIDATE_NAME>")
