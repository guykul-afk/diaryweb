from typing import Tuple, Optional, Dict, Any
from functions.ontology.loader import OntologyLoader

class SemanticNormalizer:
    def __init__(self, loader: Optional[OntologyLoader] = None):
        self.loader = loader or OntologyLoader()
        self.semantic_backlog = []

    def normalize_predicate(self, raw_predicate: str) -> Tuple[str, str, bool]:
        """
        Returns: (canonical_predicate, normalization_status, is_in_backlog)
        Status values: 'EXACT_ALIAS', 'RULE_MAPPED', 'FALLBACK_RELATED_TO'
        """
        if not raw_predicate:
            return "RELATED_TO", "FALLBACK_EMPTY", True

        raw_clean = raw_predicate.strip()

        # 1. Exact canonical or alias lookup
        canonical = self.loader.get_canonical_relation(raw_clean)
        if canonical:
            return canonical, "EXACT_ALIAS", False

        # 2. Rule-based heuristic mapping
        lower_raw = raw_clean.lower()
        if any(w in lower_raw for w in ["הוביל", "גרם", "השפיע", "יוצר", "מגביר", "מפחית", "תוצאה", "השלכה"]):
            return "CONTRIBUTES_TO", "RULE_MAPPED", False
        if any(w in lower_raw for w in ["מרגיש", "חווה", "מתוסכל", "שמח", "לחוץ", "כועס"]):
            return "EXPERIENCES", "RULE_MAPPED", False
        if any(w in lower_raw for w in ["מתחייב", "מתכנן", "יעד", "מטרה"]):
            return "COMMITTED_TO", "RULE_MAPPED", False
        if any(w in lower_raw for w in ["עובד", "מפתח", "כותב", "בונה"]):
            return "WORKS_ON", "RULE_MAPPED", False
        if any(w in lower_raw for w in ["נפגש", "דיבר", "היה עם", "יחד עם"]):
            return "PARTICIPATED_IN", "RULE_MAPPED", False
        if any(w in lower_raw for w in ["סותר", "מתנגש", "נלחם"]):
            return "CONTRADICTS", "RULE_MAPPED", False

        # 3. Fallback to RELATED_TO & record to backlog
        self.semantic_backlog.append({
            "rawPredicate": raw_clean,
            "fallbackPredicate": "RELATED_TO",
            "reason": "NO_RULE_OR_ALIAS_MATCH"
        })
        return "RELATED_TO", "FALLBACK_RELATED_TO", True

    def normalize_entity_type(self, raw_type: str) -> str:
        if not raw_type:
            return "OTHER"
        t = raw_type.upper().strip()
        type_mapping = {
            "PERSON": "PERSON",
            "PLACE": "PLACE",
            "ORGANIZATION": "ORGANIZATION",
            "PROJECT": "PROJECT",
            "CONCEPT": "CONCEPT",
            "OBJECT": "OBJECT",
            "GOAL": "PROJECT",
            "EMOTION": "CONCEPT",
            "PATTERN": "CONCEPT",
            "STRATEGY": "CONCEPT",
            "HEALTHMETRIC": "CONCEPT",
            "DOMAIN": "CONCEPT"
        }
        return type_mapping.get(t, "OTHER")
