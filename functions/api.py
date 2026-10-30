"""
OKF Knowledge Viewer - AI External API (v1)
===========================================
RESTful API for external AI systems (ChatGPT Custom GPTs, Claude Projects, LangChain,
LlamaIndex, AutoGPT, external scripts, and MCP agents) to query, analyze, and enrich
knowledge graph nodes, journal entries, life tracker metrics, and psychological insights.
"""

import os
import sys
import json
import logging
import datetime
import secrets
from typing import Dict, Any, List, Optional

from flask import Flask, Blueprint, request, jsonify, make_response
import firebase_admin
from firebase_admin import firestore

logger = logging.getLogger("okf_api")
logger.setLevel(logging.INFO)

# Master Flask app
api_app = Flask(__name__)

# Blueprints for flexible mounting (/api/v1 and /v1)
api_bp = Blueprint("api_v1", __name__)

DEFAULT_USER_UID = os.environ.get("USER_UID", "K9j4Nx0WK7NKYJs6iDUz35LXFai1")
MASTER_API_KEY = os.environ.get("OKF_API_KEY", os.environ.get("EXTERNAL_AI_API_KEY", "okf-ai-default-secret-key-2026"))

# =====================================================================
# Local Snapshot Fallback Adapter (When running offline / without ADC)
# =====================================================================

class MockDoc:
    def __init__(self, doc_id: str, data: dict, exists: bool = True):
        self.id = doc_id
        self._data = data or {}
        self.exists = exists
        
    def to_dict(self):
        return dict(self._data)
        
    def get(self):
        return self

class LocalSnapshotAdapter:
    """Provides local read/write fallback when Google Cloud credentials are not configured locally."""
    _cache = None

    def __init__(self):
        if LocalSnapshotAdapter._cache is None:
            LocalSnapshotAdapter._load_snapshots()

    @classmethod
    def _load_snapshots(cls):
        workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cls._cache = {
            "entries": {},
            "nodes": {},
            "user_data": {
                "lifeTrackerData": {
                    "last_sync": "2026-10-22T23:59:00Z",
                    "daily_metrics": {
                        "2026-10-22": {"resting_heart_rate": 62, "sleep_minutes": 440, "steps": 8450},
                        "2026-10-21": {"resting_heart_rate": 65, "sleep_minutes": 410, "steps": 10200},
                        "2026-10-20": {"resting_heart_rate": 61, "sleep_minutes": 475, "steps": 7800}
                    }
                }
            },
            "external_analyses": {},
            "api_keys": {}
        }

        # 1. Load entries
        entries_file = os.path.join(workspace, "raw_entries_snapshot.json")
        if os.path.exists(entries_file):
            try:
                with open(entries_file, "r", encoding="utf-8") as f:
                    entries_list = json.load(f)
                    for item in entries_list:
                        eid = item.get("id")
                        if eid:
                            cls._cache["entries"][eid] = item
            except Exception as e:
                logger.warning(f"Could not load local entries snapshot: {e}")

        # 2. Load entities / graph
        knowledge_file = os.path.join(workspace, "knowledge_v2.json")
        if os.path.exists(knowledge_file):
            try:
                with open(knowledge_file, "r", encoding="utf-8") as f:
                    kdata = json.load(f)
                    for ent in kdata.get("entities", []):
                        eid = ent.get("id") or ent.get("canonicalName")
                        if eid:
                            cls._cache["nodes"][eid] = {
                                "id": eid,
                                "label": ent.get("canonicalName", eid),
                                "type": ent.get("type", "Concept"),
                                "relations": ent.get("relations", [])
                            }
            except Exception as e:
                logger.warning(f"Could not load local knowledge snapshot: {e}")

    def collection(self, col_name: str):
        adapter = self
        class CollectionRef:
            def __init__(self, cname, parent_path=""):
                self.cname = cname
                self.parent_path = parent_path

            def document(self, doc_id: str):
                parent = self
                class DocumentRef:
                    def __init__(self, did):
                        self.did = did

                    def get(self):
                        if parent.cname == "users":
                            return MockDoc(self.did, adapter._cache["user_data"])
                        elif parent.cname == "entries":
                            item = adapter._cache["entries"].get(self.did)
                            return MockDoc(self.did, item, exists=bool(item))
                        elif parent.cname == "knowledge_graph_nodes":
                            item = adapter._cache["nodes"].get(self.did)
                            return MockDoc(self.did, item, exists=bool(item))
                        elif parent.cname == "insights":
                            return MockDoc(self.did, {"ocean": {"o": 85, "c": 75, "e": 60, "a": 70, "n": 40}, "status": "active"})
                        return MockDoc(self.did, {}, exists=False)

                    def collection(self, sub_col_name: str):
                        return CollectionRef(sub_col_name, parent_path=f"{parent.cname}/{self.did}")

                    def set(self, data, merge=True):
                        return None

                return DocumentRef(doc_id)

            def stream(self):
                if self.cname == "entries":
                    return [MockDoc(k, v) for k, v in adapter._cache["entries"].items()]
                elif self.cname == "knowledge_graph_nodes":
                    return [MockDoc(k, v) for k, v in adapter._cache["nodes"].items()]
                elif self.cname == "theoretical_concepts":
                    return [
                        MockDoc("cbt", {"title": "CBT (טיפול קוגניטיבי התנהגותי)", "description": "זיהוי עיוותי חשיבה ודפוסי התנהגות"}),
                        MockDoc("brooks", {"title": "The Road to Character (דיוויד ברוקס)", "description": "מעלות קורות חיים מול מעלות הספד"})
                    ]
                elif self.cname == "personality_analysis":
                    return [
                        MockDoc("latest_analysis", {
                            "timestamp": datetime.datetime.now().isoformat(),
                            "ocean": {"o": 82, "c": 78, "e": 65, "a": 72, "n": 38},
                            "executive_summary": "מגמת התייצבות ומיקוד ביעדים אישיים."
                        })
                    ]
                return []

            def order_by(self, field, direction=None):
                return self

            def limit(self, count):
                parent = self
                class LimitedQuery:
                    def stream(self):
                        return parent.stream()[:count]
                return LimitedQuery()

            def add(self, doc_data: dict):
                new_id = f"local_{secrets.token_hex(8)}"
                adapter._cache["external_analyses"][new_id] = doc_data
                class Ref:
                    id = new_id
                return (None, Ref())

        return CollectionRef(col_name)


_firestore_client = None

def get_firestore_client():
    """Retrieve live Firestore client or fallback to LocalSnapshotAdapter when offline/local."""
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app()
        except Exception as e:
            logger.info(f"Firebase initialize_app info: {e}")

    try:
        _firestore_client = firestore.client()
        # Test connection with a fast lookup
        return _firestore_client
    except Exception as e:
        logger.info(f"Firestore ADC not available locally ({e}). Using LocalSnapshotAdapter.")
        _firestore_client = LocalSnapshotAdapter()
        return _firestore_client

def serialize_data(val: Any) -> Any:
    """Recursively serialize Firestore data into JSON-compliant structures."""
    if val is None:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.isoformat()
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if hasattr(val, "to_dict"):
        return serialize_data(val.to_dict())
    if isinstance(val, dict):
        return {str(k): serialize_data(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [serialize_data(x) for x in val]
    return val

# =====================================================================
# Authentication & Access Control
# =====================================================================

def authenticate_request() -> Optional[Dict[str, Any]]:
    """
    Validates API key from Authorization header, X-API-Key header, or ?api_key query param.
    Returns caller info dictionary if valid, or None if invalid.
    """
    auth_header = request.headers.get("Authorization", "")
    api_key = None
    if auth_header.startswith("Bearer "):
        api_key = auth_header[7:].strip()
    
    if not api_key:
        api_key = request.headers.get("X-API-Key", "").strip()
    
    if not api_key:
        api_key = request.args.get("api_key", "").strip()
        
    if not api_key:
        return None

    # Check Master Key from Environment
    if MASTER_API_KEY and secrets.compare_digest(api_key, MASTER_API_KEY):
        return {
            "key_id": "master",
            "name": "Master Environment Key",
            "permissions": ["read", "write", "analyze"]
        }

    # Check Firestore 'api_keys' collection
    try:
        db = get_firestore_client()
        key_doc = db.collection("api_keys").document(api_key).get()
        if key_doc.exists:
            data = key_doc.to_dict()
            if data.get("active", True):
                return {
                    "key_id": key_doc.id,
                    "name": data.get("name", "External AI Agent"),
                    "permissions": data.get("permissions", ["read", "write", "analyze"]),
                    "owner_uid": data.get("uid")
                }
    except Exception as e:
        logger.warning(f"Error checking Firestore API key: {e}")

    return None

def get_target_uid(caller_info: Optional[Dict[str, Any]] = None) -> str:
    """Determine target UID from caller info, custom headers, or defaults."""
    header_uid = request.headers.get("X-User-UID") or request.args.get("uid")
    if header_uid:
        return header_uid.strip()
    if caller_info and caller_info.get("owner_uid"):
        return caller_info["owner_uid"]
    return DEFAULT_USER_UID

@api_app.before_request
def handle_cors_and_auth():
    """Handle CORS pre-flight OPTIONS and authentication."""
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key, X-User-UID"
        return resp

    # Public open paths that do not require an API key
    path = request.path.rstrip("/")
    public_suffixes = ["ping", "openapi.json", "mcp", "docs"]
    
    if any(path.endswith(p) for p in public_suffixes) or path in ("", "/api", "/api/v1", "/v1"):
        return None

    caller = authenticate_request()
    if not caller:
        return jsonify({
            "error": "Unauthorized",
            "message": "Valid API key required via 'Authorization: Bearer <KEY>' or 'X-API-Key: <KEY>' header.",
            "docs": "/api/docs"
        }), 401

    request.caller = caller

@api_app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key, X-User-UID"
    return response

# =====================================================================
# Blueprint API Endpoints
# =====================================================================

@api_bp.route("/ping", methods=["GET"])
def ping():
    """System status and API health check."""
    caller = authenticate_request()
    return jsonify({
        "status": "online",
        "service": "OKF Knowledge Viewer AI API",
        "version": "1.0.0",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "authenticated": caller is not None,
        "caller": caller.get("name") if caller else "Anonymous",
        "target_uid": get_target_uid(caller)
    })

# --- 1. Entries (Journal / Transcripts) ---

@api_bp.route("/entries", methods=["GET"])
def get_entries():
    """
    Search and retrieve journal entries.
    Query parameters:
    - query: text search across content, topics, and mood
    - tag / topic: filter by specific topic
    - mood: filter by mood string
    - start_date / end_date: ISO date filter
    - limit: int (default 20, max 100)
    - offset: int (default 0)
    - include_content: bool (default true)
    """
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    query_str = request.args.get("query", "").strip().lower()
    tag_filter = (request.args.get("tag") or request.args.get("topic") or "").strip().lower()
    mood_filter = request.args.get("mood", "").strip().lower()
    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()
    limit = min(int(request.args.get("limit", 20)), 100)
    offset = int(request.args.get("offset", 0))
    include_content = request.args.get("include_content", "true").lower() in ("true", "1", "yes")

    entries_ref = db.collection("users").document(uid).collection("entries")
    docs = list(entries_ref.stream())

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        
        date_val = str(data.get("date") or data.get("timestamp") or doc.id)

        # Date range filtering
        if start_date and date_val < start_date:
            continue
        if end_date and date_val > end_date:
            continue

        # Mood filtering
        entry_mood = str(data.get("mood") or data.get("sentiment") or "").lower()
        if mood_filter and mood_filter not in entry_mood:
            continue

        # Tag / Topic filtering
        topics = [str(t).lower() for t in data.get("topics", [])]
        if tag_filter and not any(tag_filter in t for t in topics):
            continue

        # Text query filtering
        content_text = str(data.get("content") or data.get("transcript") or "")
        if query_str:
            matched_in_content = query_str in content_text.lower()
            matched_in_topics = any(query_str in t for t in topics)
            matched_in_mood = query_str in entry_mood
            if not (matched_in_content or matched_in_topics or matched_in_mood):
                continue

        item = {
            "id": doc.id,
            "date": data.get("date") or data.get("timestamp"),
            "mood": data.get("mood") or data.get("sentiment"),
            "topics": data.get("topics", []),
            "char_count": len(content_text),
            "word_count": len(content_text.split())
        }

        if include_content:
            item["content"] = content_text
        else:
            item["content_preview"] = content_text[:200] + ("..." if len(content_text) > 200 else "")

        results.append(item)

    results.sort(key=lambda x: str(x.get("date") or x["id"]), reverse=True)
    total_count = len(results)
    paginated = results[offset : offset + limit]

    return jsonify({
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "count": len(paginated),
        "entries": serialize_data(paginated)
    })

@api_bp.route("/entries/<entry_id>", methods=["GET"])
def get_entry_by_id(entry_id: str):
    """Retrieve full detail for a single journal entry."""
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    doc = db.collection("users").document(uid).collection("entries").document(entry_id).get()
    if not doc.exists:
        return jsonify({"error": "NotFound", "message": f"Entry {entry_id} not found"}), 404

    data = doc.to_dict()
    data["id"] = doc.id
    return jsonify({"entry": serialize_data(data)})

# --- 2. Knowledge Graph (Nodes, Edges, Subgraphs) ---

@api_bp.route("/graph/nodes", methods=["GET"])
def get_graph_nodes():
    """
    List knowledge graph nodes.
    Query parameters:
    - type: filter by node type (e.g. Domain, Person, Goal, Pattern, Strategy, Emotion, Event, Insight)
    - search: search label or ID
    - limit: int (default 50, max 250)
    """
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    type_filter = request.args.get("type", "").strip().lower()
    search_str = request.args.get("search", "").strip().lower()
    limit = min(int(request.args.get("limit", 50)), 250)

    nodes_ref = db.collection("users").document(uid).collection("knowledge_graph_nodes")
    docs = list(nodes_ref.stream())

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        
        node_type = str(data.get("type", "")).lower()
        node_label = str(data.get("label", doc.id)).lower()

        if type_filter and type_filter != node_type:
            continue
        if search_str and (search_str not in node_label and search_str not in doc.id.lower()):
            continue

        results.append(data)
        if len(results) >= limit:
            break

    return jsonify({
        "total_fetched": len(results),
        "nodes": serialize_data(results)
    })

@api_bp.route("/graph/nodes/<node_id>", methods=["GET"])
def get_graph_node(node_id: str):
    """Get single knowledge graph node and its directly connected edges/relations."""
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    node_doc = db.collection("users").document(uid).collection("knowledge_graph_nodes").document(node_id).get()
    if not node_doc.exists:
        return jsonify({"error": "NotFound", "message": f"Graph node {node_id} not found"}), 404

    node_data = node_doc.to_dict()
    node_data["id"] = node_doc.id

    outbound = node_data.get("relations") or node_data.get("edges") or []
    
    inbound = []
    try:
        all_nodes = db.collection("users").document(uid).collection("knowledge_graph_nodes").stream()
        for other in all_nodes:
            if other.id == node_id:
                continue
            odata = other.to_dict()
            other_rels = odata.get("relations") or odata.get("edges") or []
            for r in other_rels:
                target = r.get("target") or r.get("target_id") or r.get("to")
                if target == node_id:
                    inbound.append({
                        "source": other.id,
                        "source_label": odata.get("label", other.id),
                        "relation": r.get("relation") or r.get("type", "related_to")
                    })
    except Exception as e:
        logger.warning(f"Error searching inbound edges: {e}")

    return jsonify({
        "node": serialize_data(node_data),
        "outbound_relations": serialize_data(outbound),
        "inbound_relations": serialize_data(inbound)
    })

@api_bp.route("/graph/subgraph", methods=["GET"])
def get_graph_subgraph():
    """
    Extract an ego-subgraph centered around a concept or search query.
    Query parameters:
    - node_id: central node ID
    - query: if node_id is omitted, searches for best matching node
    - hops: 1 or 2 (default 1)
    """
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    node_id = request.args.get("node_id", "").strip()
    query_str = request.args.get("query", "").strip().lower()
    hops = min(int(request.args.get("hops", 1)), 2)

    nodes_ref = db.collection("users").document(uid).collection("knowledge_graph_nodes")
    all_nodes = {d.id: {**d.to_dict(), "id": d.id} for d in nodes_ref.stream()}

    if not node_id and query_str:
        for nid, ndata in all_nodes.items():
            if query_str == nid.lower() or query_str in str(ndata.get("label", "")).lower():
                node_id = nid
                break

    if not node_id or node_id not in all_nodes:
        return jsonify({
            "error": "NotFound",
            "message": f"Central node '{node_id or query_str}' could not be located in knowledge graph."
        }), 404

    visited_nodes = {node_id}
    frontier = {node_id}
    edges = []

    for _ in range(hops):
        next_frontier = set()
        for cur_id in frontier:
            cur_data = all_nodes.get(cur_id, {})
            rels = cur_data.get("relations") or cur_data.get("edges") or []
            for r in rels:
                tgt = r.get("target") or r.get("target_id") or r.get("to")
                rel_name = r.get("relation") or r.get("type", "related_to")
                if tgt and tgt in all_nodes:
                    edges.append({
                        "source": cur_id,
                        "target": tgt,
                        "relation": rel_name
                    })
                    if tgt not in visited_nodes:
                        visited_nodes.add(tgt)
                        next_frontier.add(tgt)
        frontier = next_frontier

    subgraph_nodes = [all_nodes[nid] for nid in visited_nodes if nid in all_nodes]

    return jsonify({
        "center_node": node_id,
        "hops": hops,
        "nodes_count": len(subgraph_nodes),
        "edges_count": len(edges),
        "nodes": serialize_data(subgraph_nodes),
        "edges": serialize_data(edges)
    })

# --- 3. Physiological Data (Life Tracker / Health) ---

@api_bp.route("/health", methods=["GET"])
def get_health_metrics():
    """
    Retrieve physiological time-series data (sleep, resting heart rate, activity, steps).
    Query parameters:
    - start_date / end_date: ISO date filters (YYYY-MM-DD)
    - metric: filter by specific metric key
    """
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        return jsonify({"error": "NotFound", "message": "User document not found"}), 404

    user_data = user_doc.to_dict()
    life_tracker = user_data.get("lifeTrackerData") or {}

    if not life_tracker:
        lt_doc = db.collection("users").document(uid).collection("lifeTrackerData").document("current").get()
        if lt_doc.exists:
            life_tracker = lt_doc.to_dict()

    start_date = request.args.get("start_date", "").strip()
    end_date = request.args.get("end_date", "").strip()
    metric_filter = request.args.get("metric", "").strip()

    series = life_tracker.get("series") or life_tracker.get("daily_metrics") or life_tracker
    filtered_series = {}

    if isinstance(series, dict):
        for date_key, val in series.items():
            if start_date and date_key < start_date:
                continue
            if end_date and date_key > end_date:
                continue
            if metric_filter and isinstance(val, dict):
                filtered_series[date_key] = {metric_filter: val.get(metric_filter)}
            else:
                filtered_series[date_key] = val
    else:
        filtered_series = series

    return jsonify({
        "status": "success",
        "last_sync": life_tracker.get("last_sync") or life_tracker.get("updatedAt"),
        "data": serialize_data(filtered_series)
    })

# --- 4. Insights & Personality Analysis ---

@api_bp.route("/insights", methods=["GET"])
def get_insights():
    """
    Retrieve personality analyses, OCEAN profile, linguistic metrics, and summaries.
    Query parameters:
    - limit: number of past analysis snapshots to retrieve (default 5)
    """
    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))
    limit = min(int(request.args.get("limit", 5)), 20)

    current_insight_doc = db.collection("users").document(uid).collection("insights").document("current").get()
    current_insight = current_insight_doc.to_dict() if current_insight_doc.exists else {}

    analyses_ref = db.collection("users").document(uid).collection("personality_analysis")
    query = analyses_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
    analyses = []
    for doc in query.stream():
        d = doc.to_dict()
        d["id"] = doc.id
        analyses.append(d)

    return jsonify({
        "current_insight": serialize_data(current_insight),
        "recent_analyses": serialize_data(analyses)
    })

# --- 5. Theoretical Concepts (OKF Psychology Ontology) ---

@api_bp.route("/theoretical-concepts", methods=["GET"])
def get_theoretical_concepts():
    """Retrieve theoretical psychological concepts, mental models, and lenses."""
    db = get_firestore_client()
    search = request.args.get("search", "").strip().lower()
    limit = min(int(request.args.get("limit", 50)), 100)

    concepts_ref = db.collection("theoretical_concepts")
    docs = list(concepts_ref.stream())

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        title = str(data.get("title", doc.id)).lower()
        desc = str(data.get("description", "")).lower()

        if search and (search not in title and search not in desc):
            continue

        results.append(data)
        if len(results) >= limit:
            break

    return jsonify({
        "total": len(results),
        "theoretical_concepts": serialize_data(results)
    })

# --- 6. AI RAG Context Retrieval (Optimized for LLM Prompts) ---

@api_bp.route("/query", methods=["POST"])
def query_rag_context():
    """
    RAG Context Packing Endpoint for external AI Agents.
    Given a question or topic, gathers top relevant entries, graph entities,
    and recent health trends into a structured context bundle.
    """
    payload = request.get_json(silent=True) or {}
    query_text = payload.get("query", "").strip()
    if not query_text:
        return jsonify({"error": "BadRequest", "message": "'query' string is required in request body."}), 400

    top_k_entries = min(int(payload.get("top_k_entries", 5)), 20)
    include_graph = payload.get("include_graph", True)
    include_health = payload.get("include_health", True)

    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))

    entries_ref = db.collection("users").document(uid).collection("entries")
    docs = list(entries_ref.stream())
    
    scored_entries = []
    tokens = [t.lower() for t in query_text.split() if len(t) > 1]
    
    for doc in docs:
        edata = doc.to_dict()
        content = str(edata.get("content") or edata.get("transcript") or "")
        topics = [str(t).lower() for t in edata.get("topics", [])]
        mood = str(edata.get("mood") or edata.get("sentiment") or "")
        
        score = 0
        for token in tokens:
            if token in content.lower():
                score += 3
            if any(token in tp for tp in topics):
                score += 8
            if token in mood.lower():
                score += 5
                
        if score > 0:
            scored_entries.append((score, {
                "id": doc.id,
                "date": edata.get("date") or edata.get("timestamp") or doc.id,
                "mood": mood,
                "topics": edata.get("topics", []),
                "content": content
            }))

    scored_entries.sort(key=lambda x: x[0], reverse=True)
    top_entries = [e[1] for e in scored_entries[:top_k_entries]]

    if not top_entries and docs:
        sorted_all = sorted(docs, key=lambda d: d.id, reverse=True)[:top_k_entries]
        top_entries = [{
            "id": d.id,
            "date": d.to_dict().get("date") or d.id,
            "mood": d.to_dict().get("mood"),
            "topics": d.to_dict().get("topics", []),
            "content": d.to_dict().get("content", "")
        } for d in sorted_all]

    graph_context = []
    if include_graph:
        nodes_ref = db.collection("users").document(uid).collection("knowledge_graph_nodes")
        for ndoc in nodes_ref.stream():
            ndata = ndoc.to_dict()
            label = str(ndata.get("label", ndoc.id)).lower()
            if any(token in label for token in tokens):
                graph_context.append({
                    "id": ndoc.id,
                    "label": ndata.get("label", ndoc.id),
                    "type": ndata.get("type", "Concept"),
                    "relations": ndata.get("relations") or ndata.get("edges") or []
                })
                if len(graph_context) >= 10:
                    break

    health_summary = None
    if include_health:
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            health_summary = user_doc.to_dict().get("lifeTrackerData")

    formatted_markdown_context = f"### System Context for Query: '{query_text}'\n\n"
    formatted_markdown_context += f"**Relevant Journal Entries ({len(top_entries)} items):**\n"
    for e in top_entries:
        formatted_markdown_context += f"- **[{e['id']}] Date: {e.get('date')} | Mood: {e.get('mood')} | Topics: {', '.join(e.get('topics', []))}**\n  {e['content'][:400]}...\n\n"
    
    if graph_context:
        formatted_markdown_context += f"**Connected Knowledge Graph Entities ({len(graph_context)} items):**\n"
        for g in graph_context:
            formatted_markdown_context += f"- **{g['label']}** ({g['type']})\n"

    return jsonify({
        "query": query_text,
        "entries": serialize_data(top_entries),
        "graph_entities": serialize_data(graph_context),
        "health_data": serialize_data(health_summary),
        "ready_llm_context": formatted_markdown_context
    })

# --- 7. External AI Ingestion (Submit External Analysis) ---

@api_bp.route("/analyze", methods=["POST"])
def submit_external_analysis():
    """
    Allow external AI systems (Claude, GPTs, Custom Agents) to submit findings,
    patterns, or hypotheses back to the user's knowledge vault.
    """
    payload = request.get_json(silent=True) or {}
    if not payload.get("title") or not payload.get("summary"):
        return jsonify({
            "error": "BadRequest",
            "message": "Both 'title' and 'summary' fields are required."
        }), 400

    db = get_firestore_client()
    uid = get_target_uid(getattr(request, "caller", None))
    caller = getattr(request, "caller", {}) or {}

    analysis_doc = {
        "title": str(payload.get("title")).strip(),
        "summary": str(payload.get("summary")).strip(),
        "patterns_detected": payload.get("patterns_detected", []),
        "action_recommendations": payload.get("action_recommendations", []),
        "source_agent": str(payload.get("source_agent") or caller.get("name", "External AI")),
        "tags": payload.get("tags", []),
        "created_at": firestore.SERVER_TIMESTAMP if hasattr(firestore, "SERVER_TIMESTAMP") else datetime.datetime.now().isoformat(),
        "metadata": payload.get("metadata", {})
    }

    ref = db.collection("users").document(uid).collection("ai_external_analyses").add(analysis_doc)
    doc_id = ref[1].id

    return jsonify({
        "status": "success",
        "message": "Analysis successfully recorded in knowledge vault.",
        "id": doc_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }), 201

# --- 8. Specifications & Documentation ---

@api_bp.route("/openapi.json", methods=["GET"])
def get_openapi_spec():
    """Return complete OpenAPI 3.1 schema for ChatGPT Actions, Claude, Postman, etc."""
    base_url = request.host_url.rstrip("/")
    prefix = "/api/v1" if "/api" not in base_url else "/v1"
    server_url = base_url + (prefix if not base_url.endswith(prefix) else "")

    spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "OKF Knowledge Viewer AI API",
            "description": "Standardized REST API allowing external AI agents (ChatGPT, Claude, LangChain, AutoGPT) to access and analyze personal journal entries, knowledge graphs, and physiological data.",
            "version": "1.0.0"
        },
        "servers": [
            {"url": server_url, "description": "API Gateway"}
        ],
        "components": {
            "securitySchemes": {
                "ApiKeyAuth": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key"
                },
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer"
                }
            }
        },
        "security": [
            {"ApiKeyAuth": []},
            {"BearerAuth": []}
        ],
        "paths": {
            "/ping": {
                "get": {
                    "summary": "Health check",
                    "description": "Returns API status and authentication verification.",
                    "responses": {"200": {"description": "API is online"}}
                }
            },
            "/entries": {
                "get": {
                    "summary": "List & Search Journal Entries",
                    "description": "Search personal diary entries with filtering by query, mood, tag, and date range.",
                    "parameters": [
                        {"name": "query", "in": "query", "schema": {"type": "string"}, "description": "Text search query"},
                        {"name": "tag", "in": "query", "schema": {"type": "string"}, "description": "Filter by topic/tag"},
                        {"name": "mood", "in": "query", "schema": {"type": "string"}, "description": "Filter by mood string"},
                        {"name": "start_date", "in": "query", "schema": {"type": "string"}, "description": "Filter entries from this ISO date"},
                        {"name": "end_date", "in": "query", "schema": {"type": "string"}, "description": "Filter entries up to this ISO date"},
                        {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20}, "description": "Number of entries"}
                    ],
                    "responses": {"200": {"description": "List of entries"}}
                }
            },
            "/entries/{entry_id}": {
                "get": {
                    "summary": "Get Single Journal Entry",
                    "description": "Retrieve full text and metadata for a specific journal entry.",
                    "parameters": [
                        {"name": "entry_id", "in": "path", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "Entry details"}, "404": {"description": "Entry not found"}}
                }
            },
            "/graph/nodes": {
                "get": {
                    "summary": "List Knowledge Graph Nodes",
                    "description": "Retrieve entities, domains, patterns, emotions, and concepts in the knowledge graph.",
                    "parameters": [
                        {"name": "type", "in": "query", "schema": {"type": "string"}, "description": "Node type filter (e.g. Domain, Person, Goal, Pattern)"},
                        {"name": "search", "in": "query", "schema": {"type": "string"}, "description": "Search node label or id"},
                        {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 50}}
                    ],
                    "responses": {"200": {"description": "List of nodes"}}
                }
            },
            "/graph/subgraph": {
                "get": {
                    "summary": "Get Ego-Subgraph Around a Concept",
                    "description": "Returns connected nodes and edges centered around a given node or search query.",
                    "parameters": [
                        {"name": "node_id", "in": "query", "schema": {"type": "string"}, "description": "Center node id"},
                        {"name": "query", "in": "query", "schema": {"type": "string"}, "description": "Search keyword for center node"},
                        {"name": "hops", "in": "query", "schema": {"type": "integer", "default": 1}, "description": "Depth of relations (1 or 2)"}
                    ],
                    "responses": {"200": {"description": "Subgraph of nodes and edges"}}
                }
            },
            "/health": {
                "get": {
                    "summary": "Get Physiological & Life Tracker Data",
                    "description": "Retrieve sleep, heart rate, workouts, and activity records.",
                    "parameters": [
                        {"name": "start_date", "in": "query", "schema": {"type": "string"}},
                        {"name": "end_date", "in": "query", "schema": {"type": "string"}},
                        {"name": "metric", "in": "query", "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "Physiological metrics"}}
                }
            },
            "/insights": {
                "get": {
                    "summary": "Get Personality Analysis & Metrics",
                    "description": "Returns current OCEAN personality scores, linguistic indices, and past analyses.",
                    "responses": {"200": {"description": "Personality insights"}}
                }
            },
            "/theoretical-concepts": {
                "get": {
                    "summary": "Get Psychological Theoretical Concepts",
                    "description": "Returns theoretical lenses (CBT, Stoicism, Brooks, etc.) from OKF ontology.",
                    "responses": {"200": {"description": "Theoretical concepts"}}
                }
            },
            "/query": {
                "post": {
                    "summary": "AI RAG Context Retrieval",
                    "description": "Takes a natural language question and aggregates relevant entries, graph nodes, and metrics into an LLM-ready context block.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["query"],
                                    "properties": {
                                        "query": {"type": "string", "example": "מה הדפוסים שלי סביב עבודה ולחץ?"},
                                        "top_k_entries": {"type": "integer", "default": 5},
                                        "include_graph": {"type": "boolean", "default": True},
                                        "include_health": {"type": "boolean", "default": True}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "Synthesized AI context pack"}}
                }
            },
            "/analyze": {
                "post": {
                    "summary": "Submit External AI Analysis",
                    "description": "Allows an external AI to submit findings, patterns, or recommendations into the permanent vault.",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["title", "summary"],
                                    "properties": {
                                        "title": {"type": "string"},
                                        "summary": {"type": "string"},
                                        "patterns_detected": {"type": "array", "items": {"type": "string"}},
                                        "action_recommendations": {"type": "array", "items": {"type": "string"}},
                                        "source_agent": {"type": "string", "example": "Claude-3.5-Sonnet"},
                                        "tags": {"type": "array", "items": {"type": "string"}}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"201": {"description": "Analysis recorded"}}
                }
            }
        }
    }
    return jsonify(spec)

@api_bp.route("/mcp", methods=["GET"])
def get_mcp_manifest():
    """Model Context Protocol (MCP) Tool definitions for Anthropic Claude Desktop and Cursor."""
    base_url = request.host_url.rstrip("/")
    prefix = "/api/v1" if "/api" not in base_url else "/v1"
    mcp_tools = [
        {
            "name": "search_entries",
            "description": "Search personal journal entries by keyword, mood, or topics.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword or theme"},
                    "mood": {"type": "string", "description": "Emotional mood filter"},
                    "limit": {"type": "integer", "default": 10}
                }
            },
            "endpoint": f"{base_url}{prefix}/entries"
        },
        {
            "name": "get_graph_subgraph",
            "description": "Retrieve connected psychological entities and concepts around a topic from the knowledge graph.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Concept or entity name (e.g. 'זוגיות', 'עבודה', 'חרדה')"},
                    "hops": {"type": "integer", "default": 1}
                },
                "required": ["query"]
            },
            "endpoint": f"{base_url}{prefix}/graph/subgraph"
        },
        {
            "name": "query_rag_context",
            "description": "Gathers relevant journal entries, knowledge graph connections, and health trends for an AI to answer questions about the user.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The question to investigate"}
                },
                "required": ["query"]
            },
            "endpoint": f"{base_url}{prefix}/query"
        },
        {
            "name": "record_external_analysis",
            "description": "Save an AI-generated analysis or hypothesis back into the user's knowledge vault.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "patterns_detected": {"type": "array", "items": {"type": "string"}},
                    "action_recommendations": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["title", "summary"]
            },
            "endpoint": f"{base_url}{prefix}/analyze"
        }
    ]
    return jsonify({
        "protocol": "mcp-v1",
        "description": "Model Context Protocol Tools for OKF Knowledge Vault",
        "tools": mcp_tools
    })

# Register blueprint at both /api/v1 and /v1
api_app.register_blueprint(api_bp, url_prefix="/api/v1")
api_app.register_blueprint(api_bp, url_prefix="/v1", name="api_v1_direct")

# Top-level direct documentation routes
@api_app.route("/", methods=["GET"])
@api_app.route("/api", methods=["GET"])
@api_app.route("/docs", methods=["GET"])
@api_app.route("/api/docs", methods=["GET"])
@api_app.route("/api/v1/docs", methods=["GET"])
def root_documentation():
    """Clean interactive documentation HTML page."""
    html_content = """<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OKF Knowledge AI API - תיעוד למערכות בינה מלאכותית</title>
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #090d16;
            --surface: #131a2a;
            --surface-border: #1e293b;
            --primary: #38bdf8;
            --primary-glow: rgba(56, 189, 248, 0.15);
            --accent: #818cf8;
            --accent-green: #34d399;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --code-bg: #030712;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Assistant', sans-serif;
            background: var(--bg);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem 1rem;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }
        header {
            text-align: center;
            padding: 2.5rem 1rem;
            border-bottom: 1px solid var(--surface-border);
            margin-bottom: 2rem;
            background: radial-gradient(circle at center, rgba(56, 189, 248, 0.08) 0%, transparent 70%);
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        .badge {
            display: inline-block;
            background: rgba(56, 189, 248, 0.15);
            color: var(--primary);
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 9999px;
            padding: 0.25rem 0.85rem;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        .intro {
            font-size: 1.15rem;
            color: var(--text-muted);
            max-width: 700px;
            margin: 0 auto;
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        }
        .card h2 {
            font-size: 1.35rem;
            color: var(--primary);
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .endpoint-row {
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            background: rgba(15, 23, 42, 0.6);
        }
        .method {
            display: inline-block;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            font-weight: 700;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            margin-left: 0.5rem;
        }
        .method.get { background: #065f46; color: #34d399; }
        .method.post { background: #1e40af; color: #60a5fa; }
        .path {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            color: #f8fafc;
            direction: ltr;
            display: inline-block;
        }
        .endpoint-desc {
            margin-top: 0.5rem;
            color: var(--text-muted);
            font-size: 0.95rem;
        }
        pre {
            background: var(--code-bg);
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
            direction: ltr;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #e2e8f0;
            margin-top: 0.75rem;
        }
        .links-bar {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 1.5rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--surface-border);
            color: var(--text-main);
            text-decoration: none;
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        .btn:hover {
            background: rgba(56, 189, 248, 0.2);
            border-color: var(--primary);
            color: var(--primary);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <span class="badge">AI-Ready Knowledge API v1.0</span>
            <h1>OKF AI Integration Gateway</h1>
            <p class="intro">
                ממשק RESTful סטנדרטי המאפשר למערכות AI חיצוניות (ChatGPT Actions, Claude Projects, LangChain, MCP, AutoGPT)
                להתחבר, לשלוף רשומות יומן, לתשאל את גרף הידע ולנתח תובנות פסיכולוגיות ומדדי בריאות.
            </p>
            <div class="links-bar">
                <a href="/api/v1/openapi.json" class="btn" target="_blank">📄 OpenAPI Specification (JSON)</a>
                <a href="/api/v1/mcp" class="btn" target="_blank">🤖 Model Context Protocol (MCP)</a>
                <a href="/api/v1/ping" class="btn" target="_blank">⚡ Ping Test</a>
            </div>
        </header>

        <section class="card">
            <h2>🔑 אימות והרשאות (Authentication)</h2>
            <p>כל בקשה מוגנת על ידי מפתח API. ניתן להעביר את המפתח באחת הדרכים הבאות:</p>
            <pre><code># דרך 1: Header סטנדרטי (מומלץ למערכות AI)
Authorization: Bearer &lt;YOUR_API_KEY&gt;

# דרך 2: Header ייעודי
X-API-Key: &lt;YOUR_API_KEY&gt;

# דרך 3: Query Parameter (לבדיקות מהירות בדפדפן)
?api_key=&lt;YOUR_API_KEY&gt;</code></pre>
        </section>

        <section class="card">
            <h2>🚀 נקודות קצה מרכזיות (Endpoints)</h2>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/entries</span>
                <div class="endpoint-desc">חיפוש וסינון ברשומות היומן. תומך בפרמטרים: <code>query</code>, <code>tag</code>, <code>mood</code>, <code>start_date</code>, <code>end_date</code>, <code>limit</code>.</div>
            </div>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/entries/{entry_id}</span>
                <div class="endpoint-desc">קבלת רשומת יומן מלאה על פי מזהה, כולל תמלול מלא, תגיות רגש ונושאים.</div>
            </div>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/graph/nodes</span>
                <div class="endpoint-desc">שליפת ישויות מגרף הידע. תומך בסינון לפי סוג (<code>type=Domain|Person|Goal|Pattern|Strategy</code>) וחיפוש.</div>
            </div>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/graph/subgraph</span>
                <div class="endpoint-desc">שליפת תת-גרף מקושר סביב מושג או נושא (<code>node_id</code> או <code>query</code>) בעומק קשרים מבוקש (<code>hops=1|2</code>).</div>
            </div>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/health</span>
                <div class="endpoint-desc">שליפת מדדים פיזיולוגיים מסונכרנים (שעות שינה, דופק מנוחה, צעדים מ-Google Health / Fitbit).</div>
            </div>

            <div class="endpoint-row">
                <span class="method get">GET</span>
                <span class="path">/api/v1/insights</span>
                <div class="endpoint-desc">שליפת ניתוח אישיות עדכני (פרופיל OCEAN, מדדים לשוניים, אירועי חיים ויעדים).</div>
            </div>

            <div class="endpoint-row">
                <span class="method post">POST</span>
                <span class="path">/api/v1/query</span>
                <div class="endpoint-desc"><strong>RAG Context Retrieval:</strong> שולח שאילתה ומחזיר בלוק קונטקסט מובנה ומוכן ישירות לפרומפט של LLM (רשומות רלוונטיות + ישויות גרף).</div>
            </div>

            <div class="endpoint-row">
                <span class="method post">POST</span>
                <span class="path">/api/v1/analyze</span>
                <div class="endpoint-desc"><strong>External AI Ingestion:</strong> מאפשר למודל חיצוני לשמור בחזרה למאגר ניתוח, דפוסים חדשים או המלצות לפעולה.</div>
            </div>
        </section>

        <section class="card">
            <h2>💡 חיבור ל-ChatGPT (Custom GPT Actions)</h2>
            <ol style="margin-right: 1.5rem; margin-top: 0.5rem; color: var(--text-muted);">
                <li>פתח ב-ChatGPT את יצירת ה-GPT ועבור ללשונית <strong>Configure</strong>.</li>
                <li>גלול למטה ולחץ על <strong>Create new action</strong>.</li>
                <li>בחר <strong>Import from URL</strong> והדבק את כתובת ה-OpenAPI: <code>https://&lt;YOUR_HOST&gt;/api/v1/openapi.json</code>.</li>
                <li>תחת <strong>Authentication</strong>, בחר <strong>API Key</strong> -> <strong>Bearer</strong> והזן את המפתח שלך.</li>
            </ol>
        </section>

        <section class="card">
            <h2>🐍 דוגמת קוד בפייתון (Python Client)</h2>
            <pre><code>import requests

API_KEY = "okf-ai-default-secret-key-2026"
BASE_URL = "http://localhost:5005"  # או כתובת ה-Cloud Function בענן

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. תשאול RAG לקבלת קונטקסט עבור המודל
res = requests.post(f"{BASE_URL}/api/v1/query", headers=headers, json={
    "query": "מה הדפוסים שלי סביב עבודה ולחץ?",
    "top_k_entries": 3,
    "include_graph": True
})
print("Context for LLM:", res.json().get("ready_llm_context"))

# 2. שמירת תובנה בחזרה מ-AI חיצוני
analysis_res = requests.post(f"{BASE_URL}/api/v1/analyze", headers=headers, json={
    "title": "זיהוי מתאם בין עומס שבועי לדופק",
    "summary": "המודל זיהה כי בימים עם תיוג 'לחץ בעבודה' חלה עלייה ממוצעת של 8 BPM בדופק המנוחה.",
    "patterns_detected": ["עומס עבודה", "דופק מוגבר"],
    "action_recommendations": ["תזמון הפסקת נשימות בשעה 14:00"],
    "source_agent": "MyCustomAgent"
})
print("Analysis Saved ID:", analysis_res.json().get("id"))
</code></pre>
        </section>
    </div>
</body>
</html>
"""
    return html_content, 200, {"Content-Type": "text/html; charset=utf-8"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5005))
    print(f"Starting OKF AI API Server on port {port}...")
    api_app.run(host="0.0.0.0", port=port, debug=True)
