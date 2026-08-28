import uuid
from typing import List, Optional, Dict, Any

class Entity:
    def __init__(
        self,
        id: str,
        type: str,
        canonicalName: str,
        aliases: Optional[List[str]] = None,
        createdAt: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.id = id
        self.type = type.upper()
        self.canonicalName = canonicalName.strip()
        self.aliases = aliases or []
        self.createdAt = createdAt
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "canonicalName": self.canonicalName,
            "aliases": self.aliases,
            "createdAt": self.createdAt,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Entity":
        return cls(
            id=data["id"],
            type=data.get("type", "OTHER"),
            canonicalName=data.get("canonicalName") or data.get("name", "Unknown"),
            aliases=data.get("aliases", []),
            createdAt=data.get("createdAt"),
            metadata=data.get("metadata", {})
        )
