import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import urllib.request
import re
import uuid
from datetime import datetime
from functions.ontology.loader import OntologyLoader
from functions.ontology.normalizer import SemanticNormalizer
from functions.ontology.validator import OntologyValidator
from functions.knowledge.assertions import Assertion, Evidence
from functions.knowledge.entities import Entity
from functions.knowledge.events import Event
from functions.knowledge.insights import Insight

UID = "K9j4Nx0WK7NKYJs6iDUz35LXFai1"
PROJECT_ID = "mindcloud-8ccc6"

def fetch_all_raw_entries():
    print("Fetching raw entries from Firestore REST API...")
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users/{UID}/entries?pageSize=300"
    req = urllib.request.Request(url, headers={'User-Agent': 'V2RebuildPipeline'})
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
    
    docs = res_data.get('documents', [])
    entries = []
    for doc in docs:
        name = doc.get('name', '')
        doc_id = name.split('/')[-1]
        fields = doc.get('fields', {})

        content_val = ""
        for k in ['content', 'transcript', 'text']:
            if k in fields and 'stringValue' in fields[k]:
                content_val = fields[k]['stringValue']
                break
        if content_val:
            content_val = re.sub(r'(^|[\n\r]|(?<=\s))(?:\*\*)?משתמש(?:\*\*)?\s*(:|[-–—])', lambda m: m.group(0).replace('משתמש', 'אני'), content_val)

        date_val = None
        if 'date' in fields and 'stringValue' in fields['date']:
            date_val = fields['date']['stringValue']
        elif 'timestamp' in fields and 'timestampValue' in fields['timestamp']:
            date_val = fields['timestamp']['timestampValue']

        topics = []
        if 'topics' in fields and 'arrayValue' in fields['topics']:
            values = fields['topics']['arrayValue'].get('values', [])
            topics = [v.get('stringValue', '') for v in values if 'stringValue' in v]

        mood = "neutral"
        if 'mood' in fields and 'stringValue' in fields['mood']:
            mood = fields['mood']['stringValue']
        elif 'sentiment' in fields and 'stringValue' in fields['sentiment']:
            mood = fields['sentiment']['stringValue']

        entries.append({
            "id": doc_id,
            "date": date_val,
            "mood": mood,
            "topics": topics,
            "content": content_val
        })
    return entries

def main():
    print("=== Phase 4: Full Corpus Rebuild (v2-Core) ===")
    
    # 1. Pass A: Snapshot raw data
    raw_entries = fetch_all_raw_entries()
    print(f"Pass A: Preserved {len(raw_entries)} raw entries to raw_entries_snapshot.json")
    with open("raw_entries_snapshot.json", "w", encoding="utf-8") as f:
        json.dump(raw_entries, f, ensure_ascii=False, indent=2)

    # 2. Initialize Ontology components
    loader = OntologyLoader()
    normalizer = SemanticNormalizer(loader)
    validator = OntologyValidator(loader)

    entities_registry = {}  # key: entity_id or canonicalName -> Entity
    assertions_list = []
    events_list = []
    insights_list = []
    
    run_id = f"rebuild_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

    # Load legacy graph to preserve historical entity labels/insights
    legacy_nodes = []
    if os.path.exists("graph_backup.json"):
        with open("graph_backup.json", "r", encoding="utf-8") as f:
            legacy_nodes = json.load(f)

    # Pre-register entities from legacy nodes
    for node in legacy_nodes:
        nid = node.get("id") or node.get("name")
        if not nid:
            continue
        raw_type = node.get("type", "CONCEPT")
        norm_type = normalizer.normalize_entity_type(raw_type)
        label = node.get("label") or node.get("name") or nid
        aliases = node.get("aliases", [])
        if label not in aliases:
            aliases.append(label)
        
        ent = Entity(
            id=nid,
            type=norm_type,
            canonicalName=label,
            aliases=aliases,
            createdAt=node.get("createdAt") or "legacy"
        )
        entities_registry[nid] = ent

    # 3. Pass C & D: Extract assertions and normalize
    # Parse assertions from raw entries and legacy edges
    for entry in raw_entries:
        entry_id = entry["id"]
        content = entry["content"]
        entry_date = entry["date"]
        topics = entry["topics"]

        # Topic assertions
        for topic in topics:
            if topic:
                topic_id = f"concept_{topic.strip()}"
                if topic_id not in entities_registry:
                    entities_registry[topic_id] = Entity(
                        id=topic_id,
                        type="CONCEPT",
                        canonicalName=topic.strip(),
                        aliases=[topic.strip()]
                    )
                
                assertion = Assertion(
                    id=f"ast_{uuid.uuid4().hex[:12]}",
                    subjectId=f"entry_{entry_id}",
                    predicate="ABOUT",
                    rawPredicate="נושא הרשומה",
                    objectId=topic_id,
                    epistemicStatus="SELF_REPORTED",
                    validFrom=entry_date,
                    evidence=Evidence(entryId=entry_id, quote=topic),
                    origin="RETROSPECTIVE_EXTRACTION",
                    extractionRunId=run_id
                )
                assertions_list.append(assertion)

    # Process legacy edges into assertions
    edge_seen = set()
    for node in legacy_nodes:
        source_id = node.get("id")
        if not source_id:
            continue
        for edge in node.get("relatedEdges", []):
            raw_rel = edge.get("relation", "").strip()
            target_id = edge.get("target") or edge.get("targetId")
            if not raw_rel or not target_id:
                continue

            edge_key = f"{source_id}->{raw_rel}->{target_id}"
            if edge_key in edge_seen:
                continue
            edge_seen.add(edge_key)

            canonical_pred, norm_status, in_backlog = normalizer.normalize_predicate(raw_rel)
            
            # Find evidence quote if available
            quote = edge.get("quote") or edge.get("context") or raw_rel
            entry_ref = edge.get("sourceEntryId") or edge.get("entryId") or "entry_legacy"

            ast = Assertion(
                id=f"ast_{uuid.uuid4().hex[:12]}",
                subjectId=source_id,
                predicate=canonical_pred,
                rawPredicate=raw_rel,
                objectId=target_id,
                epistemicStatus="SELF_REPORTED" if edge.get("sentimentScore") is not None else "INFERRED",
                evidence=Evidence(entryId=entry_ref, quote=quote),
                origin="RETROSPECTIVE_EXTRACTION",
                extractionRunId=run_id
            )
            assertions_list.append(ast)

    # 4. Pass E: Generate Entity Reconciliation Candidates for UI
    person_entities = [e for e in entities_registry.values() if e.type == "PERSON"]
    clusters = {}
    for p in person_entities:
        first_name = p.canonicalName.split()[0] if p.canonicalName else "Unknown"
        clusters.setdefault(first_name, []).append(p)

    reconciliation_candidates = []
    for first_name, group in clusters.items():
        if len(group) > 1:
            reconciliation_candidates.append({
                "groupKey": first_name,
                "candidates": [
                    {
                        "id": ent.id,
                        "canonicalName": ent.canonicalName,
                        "aliases": ent.aliases,
                        "occurrencesCount": sum(1 for a in assertions_list if a.subjectId == ent.id or a.objectId == ent.id)
                    }
                    for ent in group
                ]
            })

    with open("entity_review_candidates.json", "w", encoding="utf-8") as f:
        json.dump(reconciliation_candidates, f, ensure_ascii=False, indent=2)
    print(f"Pass E: Wrote {len(reconciliation_candidates)} reconciliation candidate groups to entity_review_candidates.json")

    # 5. Build Knowledge v2 Snapshot
    knowledge_v2 = {
        "metadata": {
            "version": "2.0.0",
            "extractionRunId": run_id,
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "totalEntries": len(raw_entries),
            "totalEntities": len(entities_registry),
            "totalAssertions": len(assertions_list),
            "totalBacklogItems": len(normalizer.semantic_backlog)
        },
        "entities": [e.to_dict() for e in entities_registry.values()],
        "assertions": [a.to_dict() for a in assertions_list],
        "events": [ev.to_dict() for ev in events_list],
        "insights": [i.to_dict() for i in insights_list],
        "semanticBacklog": normalizer.semantic_backlog
    }

    with open("knowledge_v2.json", "w", encoding="utf-8") as f:
        json.dump(knowledge_v2, f, ensure_ascii=False, indent=2)

    print(f"Pass F: Successfully compiled knowledge_v2.json with {len(entities_registry)} entities and {len(assertions_list)} assertions.")

if __name__ == "__main__":
    main()
