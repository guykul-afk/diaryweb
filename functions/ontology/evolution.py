import uuid
import time
from typing import Dict, Any, List, Optional

class ExpansionCandidate:
    def __init__(
        self,
        candidate_id: str,
        proposal_type: str,  # NEW_RELATION | NEW_SUBTYPE | NEW_CONCEPT_LAYER
        proposed_name: str,
        status: str = "CANDIDATE",  # CANDIDATE | EXPERIMENTAL | VALIDATED | CANONICAL | REJECTED
        occurrences: int = 0,
        entries_count: int = 0,
        expansion_score: float = 0.0,
        suggested_status: str = "ACTIVE",
        evidence_summary: Optional[Dict[str, Any]] = None
    ):
        self.candidate_id = candidate_id
        self.proposal_type = proposal_type
        self.proposed_name = proposed_name
        self.status = status
        self.occurrences = occurrences
        self.entries_count = entries_count
        self.expansion_score = expansion_score
        self.suggested_status = suggested_status
        self.evidence_summary = evidence_summary or {}
        self.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.candidate_id,
            "proposalType": self.proposal_type,
            "proposedName": self.proposed_name,
            "status": self.status,
            "occurrences": self.occurrences,
            "entriesCount": self.entries_count,
            "expansionScore": self.expansion_score,
            "suggestedStatus": self.suggested_status,
            "evidenceSummary": self.evidence_summary,
            "createdAt": self.created_at
        }

class EvolutionEngine:
    def __init__(self, min_recurrence_threshold: int = 5):
        self.min_recurrence_threshold = min_recurrence_threshold

    def calculate_expansion_score(
        self,
        recurrence: float,
        semantic_coherence: float = 0.8,
        query_value: float = 0.7,
        information_gain: float = 0.8,
        persistence: float = 0.7,
        implementation_cost: float = 0.3
    ) -> float:
        cost = max(implementation_cost, 0.1)
        score = (recurrence * semantic_coherence * query_value * information_gain * persistence) / cost
        return round(score, 2)

    def calculate_demotion_score(
        self,
        redundancy: float = 0.8,
        low_usage: float = 0.8,
        low_query_value: float = 0.7,
        low_information_gain: float = 0.7,
        high_extraction_cost: float = 0.5
    ) -> float:
        score = redundancy * low_usage * low_query_value * low_information_gain * high_extraction_cost
        return round(score, 3)

    def propose_candidate_relations(self, pressure_signals: Dict[str, Any]) -> List[ExpansionCandidate]:
        candidates = []
        top_unmapped = pressure_signals.get("top_unmapped_predicates", [])
        for item in top_unmapped:
            pred = item["rawPredicate"]
            count = item["count"]
            if count >= self.min_recurrence_threshold:
                score = self.calculate_expansion_score(recurrence=float(count))
                candidate = ExpansionCandidate(
                    candidate_id=f"candidate_{uuid.uuid4().hex[:8]}",
                    proposal_type="NEW_RELATION",
                    proposed_name=pred.upper().replace(" ", "_"),
                    status="CANDIDATE",
                    occurrences=count,
                    expansion_score=score,
                    suggested_status="EXPERIMENTAL",
                    evidence_summary={"rawPredicate": pred, "occurrences": count}
                )
                candidates.append(candidate)
        return candidates
