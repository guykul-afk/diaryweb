from typing import Tuple, List, Optional
from functions.ontology.loader import OntologyLoader
from functions.knowledge.assertions import Assertion
from functions.knowledge.entities import Entity

class OntologyValidator:
    def __init__(self, loader: Optional[OntologyLoader] = None):
        self.loader = loader or OntologyLoader()

    def validate_entity(self, entity: Entity) -> Tuple[bool, List[str]]:
        errors = []
        valid_types = self.loader.get_entity_types()
        if entity.type not in valid_types:
            errors.append(f"Invalid entity type '{entity.type}'. Must be one of {valid_types}.")
        if not entity.canonicalName:
            errors.append("Entity canonicalName cannot be empty.")
        return len(errors) == 0, errors

    def validate_assertion(self, assertion: Assertion) -> Tuple[bool, List[str]]:
        errors = []
        relations_map = self.loader.relations.get("relations", {})
        if assertion.predicate not in relations_map:
            errors.append(f"Invalid canonical predicate '{assertion.predicate}'.")
        
        valid_statuses = self.loader.get_epistemic_statuses()
        if assertion.epistemicStatus not in valid_statuses:
            errors.append(f"Invalid epistemic status '{assertion.epistemicStatus}'. Must be one of {valid_statuses}.")

        # Check evidence requirement
        rel_info = relations_map.get(assertion.predicate, {})
        if rel_info.get("requiresEvidence", False) and not assertion.evidence:
            errors.append(f"Predicate '{assertion.predicate}' requires supporting evidence (quote + source entry).")

        if not assertion.subjectId:
            errors.append("Assertion subjectId cannot be empty.")

        if not assertion.objectId and assertion.literalValue is None:
            errors.append("Assertion must have either objectId or literalValue.")

        return len(errors) == 0, errors
