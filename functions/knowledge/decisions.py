from typing import List, Optional, Dict, Any
from enum import Enum
import time

class EmpiricalStatus(str, Enum):
    UNTESTED = "UNTESTED"
    SUPPORTED = "SUPPORTED"
    PARTIAL = "PARTIAL"
    FALSIFIED = "FALSIFIED"
    INCONCLUSIVE = "INCONCLUSIVE"

class ContradictionType(str, Enum):
    LOGICAL = "LOGICAL_CONTRADICTION"
    EMPIRICAL = "EMPIRICAL_DISAGREEMENT"
    TEMPORAL = "TEMPORAL_SUPERSEDED"
    CONTEXTUAL = "CONTEXTUAL_DIVERGENCE"
    QUALIFICATION = "QUALIFICATION"
    EXCEPTION_TO = "EXCEPTION_TO"
    ALTERNATIVE_TO = "ALTERNATIVE_TO"

class DecisionOption:
    def __init__(
        self,
        id: str,
        description: str,
        pros: Optional[List[str]] = None,
        cons: Optional[List[str]] = None,
        assumptions: Optional[List[str]] = None,
        supportingClaimIds: Optional[List[str]] = None,
        contradictingClaimIds: Optional[List[str]] = None,
        perceivedProbability: Optional[float] = None,
        perceivedRisk: Optional[str] = "MEDIUM"  # LOW | MEDIUM | HIGH
    ):
        self.id = id
        self.description = description
        self.pros = pros or []
        self.cons = cons or []
        self.assumptions = assumptions or []
        self.supportingClaimIds = supportingClaimIds or []
        self.contradictingClaimIds = contradictingClaimIds or []
        self.perceivedProbability = perceivedProbability
        self.perceivedRisk = perceivedRisk

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "description": self.description,
            "pros": self.pros,
            "cons": self.cons,
            "assumptions": self.assumptions,
            "supportingClaimIds": self.supportingClaimIds,
            "contradictingClaimIds": self.contradictingClaimIds,
            "perceivedProbability": self.perceivedProbability,
            "perceivedRisk": self.perceivedRisk
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionOption":
        return cls(
            id=data.get("id", ""),
            description=data.get("description", ""),
            pros=data.get("pros", []),
            cons=data.get("cons", []),
            assumptions=data.get("assumptions", []),
            supportingClaimIds=data.get("supportingClaimIds", []),
            contradictingClaimIds=data.get("contradictingClaimIds", []),
            perceivedProbability=data.get("perceivedProbability"),
            perceivedRisk=data.get("perceivedRisk", "MEDIUM")
        )

class Prediction:
    def __init__(
        self,
        id: str,
        decisionId: str,
        predictionText: str,
        expectedDirection: str = "POSITIVE",
        probability: float = 0.5,
        timeHorizon: Optional[str] = None,
        successCriteria: Optional[str] = None,
        failureCriteria: Optional[str] = None,
        empiricalStatus: str = EmpiricalStatus.UNTESTED.value,
        recordedAt: Optional[str] = None,
        claimIds: Optional[List[str]] = None
    ):
        self.id = id
        self.decisionId = decisionId
        self.predictionText = predictionText
        self.expectedDirection = expectedDirection
        self.probability = probability
        self.timeHorizon = timeHorizon
        self.successCriteria = successCriteria or ""
        self.failureCriteria = failureCriteria or ""
        self.empiricalStatus = empiricalStatus
        self.recordedAt = recordedAt or time.strftime("%Y-%m-%dT%H:%M:%SZ")
        self.claimIds = claimIds or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "decisionId": self.decisionId,
            "predictionText": self.predictionText,
            "expectedDirection": self.expectedDirection,
            "probability": self.probability,
            "timeHorizon": self.timeHorizon,
            "successCriteria": self.successCriteria,
            "failureCriteria": self.failureCriteria,
            "empiricalStatus": self.empiricalStatus,
            "recordedAt": self.recordedAt,
            "claimIds": self.claimIds
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Prediction":
        return cls(
            id=data.get("id", ""),
            decisionId=data.get("decisionId", ""),
            predictionText=data.get("predictionText", ""),
            expectedDirection=data.get("expectedDirection", "POSITIVE"),
            probability=data.get("probability", 0.5),
            timeHorizon=data.get("timeHorizon"),
            successCriteria=data.get("successCriteria", ""),
            failureCriteria=data.get("failureCriteria", ""),
            empiricalStatus=data.get("empiricalStatus", EmpiricalStatus.UNTESTED.value),
            recordedAt=data.get("recordedAt"),
            claimIds=data.get("claimIds", [])
        )

class OutcomeEvent:
    def __init__(
        self,
        id: str,
        decisionId: str,
        actualOutcome: str,
        observedAt: str,
        matchedExpectation: str = "FULL",  # FULL | PARTIAL | FAILED | UNEXPECTED
        predictionIds: Optional[List[str]] = None,
        unexpectedConsequences: Optional[List[str]] = None,
        sourceEntryIds: Optional[List[str]] = None,
        humanConfirmation: bool = False,
        confidence: float = 1.0,
        epistemicNotes: Optional[str] = None
    ):
        self.id = id
        self.decisionId = decisionId
        self.actualOutcome = actualOutcome
        self.observedAt = observedAt
        self.matchedExpectation = matchedExpectation
        self.predictionIds = predictionIds or []
        self.unexpectedConsequences = unexpectedConsequences or []
        self.sourceEntryIds = sourceEntryIds or []
        self.humanConfirmation = humanConfirmation
        self.confidence = confidence
        self.epistemicNotes = epistemicNotes or ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "decisionId": self.decisionId,
            "actualOutcome": self.actualOutcome,
            "observedAt": self.observedAt,
            "matchedExpectation": self.matchedExpectation,
            "predictionIds": self.predictionIds,
            "unexpectedConsequences": self.unexpectedConsequences,
            "sourceEntryIds": self.sourceEntryIds,
            "humanConfirmation": self.humanConfirmation,
            "confidence": self.confidence,
            "epistemicNotes": self.epistemicNotes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OutcomeEvent":
        return cls(
            id=data.get("id", ""),
            decisionId=data.get("decisionId", ""),
            actualOutcome=data.get("actualOutcome", ""),
            observedAt=data.get("observedAt", ""),
            matchedExpectation=data.get("matchedExpectation", "FULL"),
            predictionIds=data.get("predictionIds", []),
            unexpectedConsequences=data.get("unexpectedConsequences", []),
            sourceEntryIds=data.get("sourceEntryIds", []),
            humanConfirmation=data.get("humanConfirmation", False),
            confidence=data.get("confidence", 1.0),
            epistemicNotes=data.get("epistemicNotes", "")
        )

class DecisionProblem:
    def __init__(
        self,
        id: str,
        title: str,
        description: str,
        options: Optional[List[DecisionOption]] = None,
        contextIds: Optional[List[str]] = None,
        triggerEventIds: Optional[List[str]] = None,
        claimIds: Optional[List[str]] = None,
        decisionCriteria: Optional[List[str]] = None,
        uncertainties: Optional[List[str]] = None,
        authority: str = "SELF",
        status: str = "OPEN",  # OPEN | RESOLVED | ABANDONED
        createdAt: Optional[str] = None
    ):
        self.id = id
        self.title = title
        self.description = description
        self.options = options or []
        self.contextIds = contextIds or []
        self.triggerEventIds = triggerEventIds or []
        self.claimIds = claimIds or []
        self.decisionCriteria = decisionCriteria or []
        self.uncertainties = uncertainties or []
        self.authority = authority
        self.status = status
        self.createdAt = createdAt or time.strftime("%Y-%m-%dT%H:%M:%SZ")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "options": [opt.to_dict() for opt in self.options],
            "contextIds": self.contextIds,
            "triggerEventIds": self.triggerEventIds,
            "claimIds": self.claimIds,
            "decisionCriteria": self.decisionCriteria,
            "uncertainties": self.uncertainties,
            "authority": self.authority,
            "status": self.status,
            "createdAt": self.createdAt
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionProblem":
        raw_options = data.get("options", [])
        options = [DecisionOption.from_dict(opt) if isinstance(opt, dict) else opt for opt in raw_options]
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            description=data.get("description", ""),
            options=options,
            contextIds=data.get("contextIds", []),
            triggerEventIds=data.get("triggerEventIds", []),
            claimIds=data.get("claimIds", []),
            decisionCriteria=data.get("decisionCriteria", []),
            uncertainties=data.get("uncertainties", []),
            authority=data.get("authority", "SELF"),
            status=data.get("status", "OPEN"),
            createdAt=data.get("createdAt")
        )

class DecisionRecord:
    def __init__(
        self,
        id: str,
        decisionProblemId: str,
        title: str,
        chosenOption: str,
        rationale: str,
        rejectedOptions: Optional[List[str]] = None,
        assumptions: Optional[List[str]] = None,
        confidenceAtTime: float = 0.8,
        epistemicStrength: str = "MEDIUM",  # LOW | MEDIUM | HIGH | AXIOMATIC
        decisionDate: Optional[str] = None,
        reviewDate: Optional[str] = None,
        expectedOutcomes: Optional[List[str]] = None,
        failureSignals: Optional[List[str]] = None,
        predictions: Optional[List[Prediction]] = None,
        outcomes: Optional[List[OutcomeEvent]] = None,
        relatedClaimIds: Optional[List[str]] = None,
        sourceAssertionIds: Optional[List[str]] = None,
        sourceEntryIds: Optional[List[str]] = None,
        status: str = "ACTIVE"  # ACTIVE | REVIEWED | SUPERSEDED
    ):
        self.id = id
        self.decisionProblemId = decisionProblemId
        self.title = title
        self.chosenOption = chosenOption
        self.rationale = rationale
        self.rejectedOptions = rejectedOptions or []
        self.assumptions = assumptions or []
        self.confidenceAtTime = confidenceAtTime
        self.epistemicStrength = epistemicStrength
        self.decisionDate = decisionDate or time.strftime("%Y-%m-%d")
        self.reviewDate = reviewDate
        self.expectedOutcomes = expectedOutcomes or []
        self.failureSignals = failureSignals or []
        self.predictions = predictions or []
        self.outcomes = outcomes or []
        self.relatedClaimIds = relatedClaimIds or []
        self.sourceAssertionIds = sourceAssertionIds or []
        self.sourceEntryIds = sourceEntryIds or []
        self.status = status

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "decisionProblemId": self.decisionProblemId,
            "title": self.title,
            "chosenOption": self.chosenOption,
            "rationale": self.rationale,
            "rejectedOptions": self.rejectedOptions,
            "assumptions": self.assumptions,
            "confidenceAtTime": self.confidenceAtTime,
            "epistemicStrength": self.epistemicStrength,
            "decisionDate": self.decisionDate,
            "reviewDate": self.reviewDate,
            "expectedOutcomes": self.expectedOutcomes,
            "failureSignals": self.failureSignals,
            "predictions": [p.to_dict() for p in self.predictions],
            "outcomes": [o.to_dict() for o in self.outcomes],
            "relatedClaimIds": self.relatedClaimIds,
            "sourceAssertionIds": self.sourceAssertionIds,
            "sourceEntryIds": self.sourceEntryIds,
            "status": self.status
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DecisionRecord":
        raw_preds = data.get("predictions", [])
        preds = [Prediction.from_dict(p) if isinstance(p, dict) else p for p in raw_preds]
        raw_outs = data.get("outcomes", [])
        outs = [OutcomeEvent.from_dict(o) if isinstance(o, dict) else o for o in raw_outs]
        return cls(
            id=data.get("id", ""),
            decisionProblemId=data.get("decisionProblemId", ""),
            title=data.get("title", ""),
            chosenOption=data.get("chosenOption", ""),
            rationale=data.get("rationale", ""),
            rejectedOptions=data.get("rejectedOptions", []),
            assumptions=data.get("assumptions", []),
            confidenceAtTime=data.get("confidenceAtTime", 0.8),
            epistemicStrength=data.get("epistemicStrength", "MEDIUM"),
            decisionDate=data.get("decisionDate"),
            reviewDate=data.get("reviewDate"),
            expectedOutcomes=data.get("expectedOutcomes", []),
            failureSignals=data.get("failureSignals", []),
            predictions=preds,
            outcomes=outs,
            relatedClaimIds=data.get("relatedClaimIds", []),
            sourceAssertionIds=data.get("sourceAssertionIds", []),
            sourceEntryIds=data.get("sourceEntryIds", []),
            status=data.get("status", "ACTIVE")
        )
