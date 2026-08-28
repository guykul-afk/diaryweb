from collections import Counter
from typing import List, Dict, Any

class PressureDetector:
    def __init__(self, fallback_threshold: float = 0.25, other_threshold: float = 0.20):
        self.fallback_threshold = fallback_threshold
        self.other_threshold = other_threshold

    def analyze_semantic_pressure(
        self,
        assertions: List[Dict[str, Any]],
        entities: List[Dict[str, Any]],
        backlog_items: List[Dict[str, Any]],
        query_failures: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Detects semantic pressure signals:
        1. Recurrence in semantic backlog
        2. Fallback saturation (e.g. % of assertions mapped to RELATED_TO)
        3. OTHER entity type saturation
        4. Query failures
        """
        total_assertions = len(assertions)
        fallback_count = sum(1 for a in assertions if a.get("predicate") == "RELATED_TO")
        fallback_ratio = (fallback_count / total_assertions) if total_assertions > 0 else 0.0

        total_entities = len(entities)
        other_count = sum(1 for e in entities if e.get("type") == "OTHER")
        other_ratio = (other_count / total_entities) if total_entities > 0 else 0.0

        # Recurrence in backlog
        raw_pred_counts = Counter(item.get("rawPredicate", "") for item in backlog_items if item.get("rawPredicate"))
        top_unmapped_predicates = [
            {"rawPredicate": pred, "count": count}
            for pred, count in raw_pred_counts.most_common(10) if count >= 3
        ]

        signals = {
            "fallback_saturation": {
                "triggered": fallback_ratio > self.fallback_threshold,
                "ratio": round(fallback_ratio, 3),
                "threshold": self.fallback_threshold
            },
            "other_saturation": {
                "triggered": other_ratio > self.other_threshold,
                "ratio": round(other_ratio, 3),
                "threshold": self.other_threshold
            },
            "top_unmapped_predicates": top_unmapped_predicates,
            "query_failures_count": len(query_failures),
            "pressure_level": "HIGH" if (fallback_ratio > self.fallback_threshold or len(top_unmapped_predicates) > 0) else "LOW"
        }

        return signals
