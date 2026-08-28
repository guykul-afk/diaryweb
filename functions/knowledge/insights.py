from typing import List, Optional, Dict, Any

class Insight:
    def __init__(
        self,
        id: str,
        type: str,
        text: str,
        derivedFromAssertions: Optional[List[str]] = None,
        epistemicStatus: str = "INFERRED",
        confidence: float = 1.0,
        generatedAt: Optional[str] = None,
        extractionRunId: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.id = id
        self.type = type
        self.text = text
        self.derivedFromAssertions = derivedFromAssertions or []
        self.epistemicStatus = epistemicStatus
        self.confidence = confidence
        self.generatedAt = generatedAt
        self.extractionRunId = extractionRunId
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "text": self.text,
            "derivedFromAssertions": self.derivedFromAssertions,
            "epistemicStatus": self.epistemicStatus,
            "confidence": self.confidence,
            "generatedAt": self.generatedAt,
            "extractionRunId": self.extractionRunId,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Insight":
        return cls(
            id=data["id"],
            type=data.get("type", "INSIGHT"),
            text=data.get("text", ""),
            derivedFromAssertions=data.get("derivedFromAssertions", []),
            epistemicStatus=data.get("epistemicStatus", "INFERRED"),
            confidence=data.get("confidence", 1.0),
            generatedAt=data.get("generatedAt"),
            extractionRunId=data.get("extractionRunId"),
            metadata=data.get("metadata", {})
        )
