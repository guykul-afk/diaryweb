from typing import List, Optional, Dict, Any

class Event:
    def __init__(
        self,
        id: str,
        type: str,
        title: str,
        participants: Optional[List[str]] = None,
        validFrom: Optional[str] = None,
        validTo: Optional[str] = None,
        sourceEntryIds: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.id = id
        self.type = type
        self.title = title
        self.participants = participants or []
        self.validFrom = validFrom
        self.validTo = validTo
        self.sourceEntryIds = sourceEntryIds or []
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "participants": self.participants,
            "validFrom": self.validFrom,
            "validTo": self.validTo,
            "sourceEntryIds": self.sourceEntryIds,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Event":
        return cls(
            id=data["id"],
            type=data.get("type", "EVENT"),
            title=data.get("title", ""),
            participants=data.get("participants", []),
            validFrom=data.get("validFrom"),
            validTo=data.get("validTo"),
            sourceEntryIds=data.get("sourceEntryIds", []),
            metadata=data.get("metadata", {})
        )
