import os
import yaml
from typing import Dict, Any, List, Optional

class OntologyLoader:
    def __init__(self, base_dir: Optional[str] = None):
        if not base_dir:
            # Look for ontology/ in parent or current working dir
            for candidate in ["ontology", "../ontology", "../../ontology"]:
                if os.path.exists(candidate):
                    base_dir = candidate
                    break
        self.base_dir = base_dir or "ontology"
        self.entities = self._load_yaml("canonical/entities.yaml")
        self.relations = self._load_yaml("canonical/relations.yaml")
        self.epistemic = self._load_yaml("canonical/epistemic.yaml")
        self._build_alias_index()

    def _load_yaml(self, rel_path: str) -> Dict[str, Any]:
        full_path = os.path.join(self.base_dir, rel_path)
        if not os.path.exists(full_path):
            return {}
        with open(full_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _build_alias_index(self):
        self.alias_to_canonical = {}
        relations_map = self.relations.get("relations", {})
        for canonical_id, rel_data in relations_map.items():
            self.alias_to_canonical[canonical_id] = canonical_id
            aliases = rel_data.get("aliases", [])
            for alias in aliases:
                self.alias_to_canonical[alias.strip()] = canonical_id

    def get_canonical_relation(self, raw_predicate: str) -> Optional[str]:
        if not raw_predicate:
            return None
        cleaned = raw_predicate.strip()
        return self.alias_to_canonical.get(cleaned)

    def get_entity_types(self) -> List[str]:
        return list(self.entities.get("types", {}).keys())

    def get_epistemic_statuses(self) -> List[str]:
        return list(self.epistemic.get("epistemic_statuses", {}).keys())

    def get_core_concepts(self) -> List[str]:
        return self.epistemic.get("core_concepts", [])

    def get_extended_concepts(self) -> List[str]:
        return self.epistemic.get("extended_concepts", [])
