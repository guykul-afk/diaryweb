from typing import Optional, Dict, Any, List
from .epistemic_confidence import EpistemicDistance, TriPartConfidence, EpistemicFitnessVector

class Evidence:
    def __init__(
        self,
        entryId: str,
        quote: str,
        offsetStart: Optional[int] = None,
        offsetEnd: Optional[int] = None,
        rootSourceIds: Optional[List[str]] = None,
        immediateSourceIds: Optional[List[str]] = None,
        derivationActivityId: Optional[str] = None,
        modelId: Optional[str] = None,
        promptVersion: Optional[str] = None
    ):
        self.entryId = entryId
        self.quote = quote.strip() if quote else ""
        self.offsetStart = offsetStart
        self.offsetEnd = offsetEnd
        self.rootSourceIds = rootSourceIds or ([entryId] if entryId else [])
        self.immediateSourceIds = immediateSourceIds or ([entryId] if entryId else [])
        self.derivationActivityId = derivationActivityId
        self.modelId = modelId
        self.promptVersion = promptVersion

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entryId": self.entryId,
            "quote": self.quote,
            "offsetStart": self.offsetStart,
            "offsetEnd": self.offsetEnd,
            "rootSourceIds": self.rootSourceIds,
            "immediateSourceIds": self.immediateSourceIds,
            "derivationActivityId": self.derivationActivityId,
            "modelId": self.modelId,
            "promptVersion": self.promptVersion
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Evidence":
        return cls(
            entryId=data.get("entryId", ""),
            quote=data.get("quote", ""),
            offsetStart=data.get("offsetStart"),
            offsetEnd=data.get("offsetEnd"),
            rootSourceIds=data.get("rootSourceIds"),
            immediateSourceIds=data.get("immediateSourceIds"),
            derivationActivityId=data.get("derivationActivityId"),
            modelId=data.get("modelId"),
            promptVersion=data.get("promptVersion")
        )

class Assertion:
    def __init__(
        self,
        id: str,
        subjectId: str,
        predicate: str,
        rawPredicate: str,
        objectId: Optional[str] = None,
        literalValue: Optional[Any] = None,
        epistemicStatus: str = "SELF_REPORTED",
        validFrom: Optional[str] = None,
        validTo: Optional[str] = None,
        evidence: Optional[Evidence] = None,
        origin: str = "CONTEMPORANEOUS_EXTRACTION",
        extractionRunId: Optional[str] = None,
        createdAt: Optional[str] = None,
        confidenceVector: Optional[TriPartConfidence] = None,
        epistemicDistance: int = EpistemicDistance.DIRECT_ASSERTION.value
    ):
        self.id = id
        self.subjectId = subjectId
        self.predicate = predicate
        self.rawPredicate = rawPredicate
        self.objectId = objectId
        self.literalValue = literalValue
        self.epistemicStatus = epistemicStatus
        self.validFrom = validFrom
        self.validTo = validTo
        self.evidence = evidence
        self.origin = origin
        self.extractionRunId = extractionRunId
        self.createdAt = createdAt
        self.confidenceVector = confidenceVector or TriPartConfidence(
            extraction_confidence=1.0,
            epistemic_strength="MEDIUM" if epistemicStatus != "SELF_REPORTED" else "HIGH",
            empirical_status="UNTESTED",
            epistemic_distance=epistemicDistance
        )
        self.epistemicDistance = epistemicDistance

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "subjectId": self.subjectId,
            "predicate": self.predicate,
            "rawPredicate": self.rawPredicate,
            "objectId": self.objectId,
            "literalValue": self.literalValue,
            "epistemicStatus": self.epistemicStatus,
            "validFrom": self.validFrom,
            "validTo": self.validTo,
            "evidence": self.evidence.to_dict() if self.evidence else None,
            "origin": self.origin,
            "extractionRunId": self.extractionRunId,
            "createdAt": self.createdAt,
            "confidenceVector": self.confidenceVector.to_dict() if self.confidenceVector else None,
            "epistemicDistance": self.epistemicDistance
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Assertion":
        ev_data = data.get("evidence")
        evidence = Evidence.from_dict(ev_data) if ev_data else None
        
        conf_data = data.get("confidenceVector")
        confidenceVector = TriPartConfidence.from_dict(conf_data) if conf_data else None
        
        return cls(
            id=data["id"],
            subjectId=data["subjectId"],
            predicate=data["predicate"],
            rawPredicate=data.get("rawPredicate", data["predicate"]),
            objectId=data.get("objectId"),
            literalValue=data.get("literalValue"),
            epistemicStatus=data.get("epistemicStatus", "SELF_REPORTED"),
            validFrom=data.get("validFrom"),
            validTo=data.get("validTo"),
            evidence=evidence,
            origin=data.get("origin", "CONTEMPORANEOUS_EXTRACTION"),
            extractionRunId=data.get("extractionRunId"),
            createdAt=data.get("createdAt"),
            confidenceVector=confidenceVector,
            epistemicDistance=data.get("epistemicDistance", EpistemicDistance.DIRECT_ASSERTION.value)
        )
