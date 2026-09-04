from typing import Dict, Any, Optional, List
from enum import Enum

class EpistemicDistance(int, Enum):
    RAW_SOURCE = 0          # Direct text from journal/biometrics
    DIRECT_ASSERTION = 1    # Extracted statement made by user
    INTERPRETATION = 2      # Psychological/behavioral interpretation
    HYPOTHESIS = 3          # Inferred causal relation or correlation
    PATTERN = 4             # Recurring cross-entry pattern
    RECOMMENDATION = 5      # Actionable guideline or philosophical principle

class EpistemicStrengthLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    AXIOMATIC = "AXIOMATIC"

class TriPartConfidence:
    """
    Separates confidence into three orthogonal dimensions:
    1. extraction_confidence: How certain the parser/LLM is that it understood the input text.
    2. epistemic_strength: How well-grounded the claim/decision is epistemically.
    3. empirical_status: How reality and observed outcomes confirmed or challenged the claim.
    """
    def __init__(
        self,
        extraction_confidence: float = 1.0,           # 0.0 - 1.0
        epistemic_strength: str = "MEDIUM",          # LOW | MEDIUM | HIGH | AXIOMATIC
        empirical_status: str = "UNTESTED",          # UNTESTED | SUPPORTED | PARTIAL | FALSIFIED | INCONCLUSIVE
        epistemic_distance: int = EpistemicDistance.DIRECT_ASSERTION.value
    ):
        self.extraction_confidence = min(max(extraction_confidence, 0.0), 1.0)
        self.epistemic_strength = epistemic_strength
        self.empirical_status = empirical_status
        self.epistemic_distance = epistemic_distance

    def to_dict(self) -> Dict[str, Any]:
        return {
            "extractionConfidence": round(self.extraction_confidence, 3),
            "epistemicStrength": self.epistemic_strength,
            "empiricalStatus": self.empirical_status,
            "epistemicDistance": self.epistemic_distance
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TriPartConfidence":
        return cls(
            extraction_confidence=data.get("extractionConfidence", 1.0),
            epistemic_strength=data.get("epistemicStrength", "MEDIUM"),
            empirical_status=data.get("empiricalStatus", "UNTESTED"),
            epistemic_distance=data.get("epistemicDistance", EpistemicDistance.DIRECT_ASSERTION.value)
        )

class EpistemicFitnessVector:
    """
    Multi-dimensional vector tracking knowledge fitness over time:
    - source_support: Number of independent entries confirming this
    - context_fit: Applicability across diverse life contexts
    - outcome_support: Count of verified positive outcomes
    - recency: Decay/freshness factor
    - counterevidence: Count of contradicting claims or failed outcomes
    - independent_sources: Breadth of modalities (journal, biometrics, decisions)
    """
    def __init__(
        self,
        source_support: int = 1,
        context_fit: float = 0.5,
        outcome_support: int = 0,
        recency: float = 1.0,
        counterevidence: int = 0,
        independent_sources: int = 1
    ):
        self.source_support = source_support
        self.context_fit = context_fit
        self.outcome_support = outcome_support
        self.recency = recency
        self.counterevidence = counterevidence
        self.independent_sources = independent_sources

    def calculate_composite_score(self) -> float:
        # Balanced score between 0.0 and 1.0
        base = (min(self.source_support, 10) * 0.2) + (self.context_fit * 0.2) + (min(self.outcome_support, 5) * 0.3) + (self.recency * 0.15) + (min(self.independent_sources, 3) * 0.15)
        penalty = min(self.counterevidence * 0.15, 0.6)
        return round(max(min(base - penalty, 1.0), 0.0), 3)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sourceSupport": self.source_support,
            "contextFit": self.context_fit,
            "outcomeSupport": self.outcome_support,
            "recency": self.recency,
            "counterevidence": self.counterevidence,
            "independentSources": self.independent_sources,
            "compositeScore": self.calculate_composite_score()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EpistemicFitnessVector":
        return cls(
            source_support=data.get("sourceSupport", 1),
            context_fit=data.get("contextFit", 0.5),
            outcome_support=data.get("outcomeSupport", 0),
            recency=data.get("recency", 1.0),
            counterevidence=data.get("counterevidence", 0),
            independent_sources=data.get("independentSources", 1)
        )
