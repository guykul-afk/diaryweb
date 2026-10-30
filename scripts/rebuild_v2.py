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
            date_val = fields['timestamp']['timestampValue'][:10]
        
        if not date_val:
            m_date = re.search(r'(\d{4}-\d{2}-\d{2})', doc_id)
            if m_date:
                date_val = m_date.group(1)

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
        
        # Preserve all legacy metadata
        meta = {
            "domain": node.get("domain"),
            "val": node.get("val"),
            "sentimentScore": node.get("sentimentScore"),
            "firstSeen": node.get("firstSeen"),
            "lastSeen": node.get("lastSeen"),
            "sourceQuotes": node.get("sourceQuotes", []),
            "stances": node.get("stances", []),
            "summary": node.get("summary"),
            "description": node.get("description")
        }
        # filter out None
        meta = {k: v for k, v in meta.items() if v is not None and v != [] and v != ""}
        
        ent = Entity(
            id=nid,
            type=norm_type,
            canonicalName=label,
            aliases=aliases,
            createdAt=node.get("createdAt") or "legacy",
            metadata=meta
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
    # Build date / text lookup from raw_entries
    raw_entry_lookup = []
    for re_item in raw_entries:
        re_id = re_item["id"]
        re_date = re_item["date"]
        re_content = re_item["content"]
        raw_entry_lookup.append((re_id, re_date, re_content))

    edge_seen = set()
    for node in legacy_nodes:
        source_id = node.get("id")
        if not source_id:
            continue
        
        # also gather node stances dates / quotes for matching
        node_stances = node.get("stances", [])
        node_source_quotes = node.get("sourceQuotes", [])

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
            
            # Extract source quotes list
            sq = edge.get("sourceQuotes") or []
            single_q = edge.get("quote") or edge.get("context")
            if single_q and single_q not in sq:
                sq.append(single_q)
            
            # Attempt to find matching entry in raw_entries
            matched_entry_id = None
            matched_date = None
            matched_quote = single_q or (sq[0] if sq else None)
            provenance_type = "legacy_inferred"

            # 1. Try matching explicit entryId if present in edge
            cand_id = edge.get("sourceEntryId") or edge.get("entryId")
            if cand_id and any(re_id == cand_id for re_id, _, _ in raw_entry_lookup):
                matched_entry_id = cand_id
                for re_id, re_date, _ in raw_entry_lookup:
                    if re_id == cand_id:
                        matched_date = re_date
                        break
                provenance_type = "direct_entry"
            
            # 2. Try matching quote or target/source name against raw entries content
            if not matched_entry_id:
                search_terms = [t for t in [single_q, target_id, source_id] if t and len(t) > 2]
                for re_id, re_date, re_content in raw_entry_lookup:
                    if any(term in re_content for term in search_terms):
                        matched_entry_id = re_id
                        matched_date = re_date
                        provenance_type = "direct_entry"
                        # Extract a snippet around the match if no explicit quote
                        if not matched_quote:
                            for term in search_terms:
                                idx = re_content.find(term)
                                if idx != -1:
                                    start = max(0, idx - 40)
                                    end = min(len(re_content), idx + len(term) + 40)
                                    matched_quote = re_content[start:end].strip()
                                    break
                        break

            # If still no matched entry id, check node stances or fallback
            if not matched_entry_id and node_stances:
                for st in node_stances:
                    st_date = st.get("date")
                    st_quote = st.get("quote")
                    if st_quote:
                        for re_id, re_date, re_content in raw_entry_lookup:
                            if st_quote in re_content or (st_date and st_date == re_date):
                                matched_entry_id = re_id
                                matched_date = re_date
                                matched_quote = st_quote
                                provenance_type = "direct_entry"
                                break
                    if matched_entry_id:
                        break

            # Determine validFrom from edge timestamp (ms epoch) or matched date
            valid_from = matched_date
            edge_ts = edge.get("timestamp") or edge.get("createdAt")
            if edge_ts and isinstance(edge_ts, (int, float)) and edge_ts > 1000000000:
                try:
                    dt_val = datetime.utcfromtimestamp(edge_ts / 1000.0)
                    valid_from = dt_val.strftime('%Y-%m-%d')
                except Exception:
                    pass

            evidence_dict = {
                "entryId": matched_entry_id or "entry_legacy",
                "quote": matched_quote or raw_rel,
                "provenanceType": provenance_type
            }
            if sq:
                evidence_dict["sourceQuotes"] = sq

            ast = Assertion(
                id=f"ast_{uuid.uuid4().hex[:12]}",
                subjectId=source_id,
                predicate=canonical_pred,
                rawPredicate=raw_rel,
                objectId=target_id,
                epistemicStatus="SELF_REPORTED" if edge.get("sentimentScore") is not None or provenance_type == "direct_entry" else "INFERRED",
                validFrom=valid_from,
                evidence=Evidence(**evidence_dict),
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

    import shutil
    shutil.copy("knowledge_v2.json", "public/knowledge_v2.json")

    print(f"Pass F: Successfully compiled knowledge_v2.json and copied to public/knowledge_v2.json with {len(entities_registry)} entities and {len(assertions_list)} assertions.")

if __name__ == "__main__":
    main()
