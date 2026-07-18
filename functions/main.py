import os
import json
import logging
import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Literal

import google.generativeai as genai
from pydantic import BaseModel, Field

from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore
import urllib.request

# Configure logging - Force redeployment v2
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("personality_analysis")

# Initialize Firebase Admin SDK
try:
    initialize_app()
except Exception as e:
    logger.info(f"Firebase Admin SDK already initialized or error: {e}")

db_client = None
def get_db():
    global db_client
    if db_client is None:
        db_client = firestore.client()
    return db_client

def log_knowledge_action(action_type: str, details: dict):
    """Log an AI action to the knowledge_log collection (OKF compliant)."""
    try:
        db = get_db()
        log_entry = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "action_type": action_type,
            "details": details
        }
        db.collection("knowledge_log").add(log_entry)
    except Exception as e:
        logger.error(f"Failed to log knowledge action: {e}")

def update_knowledge_index(stats: dict):
    """Update the global knowledge_index document (OKF compliant)."""
    try:
        db = get_db()
        stats["last_updated"] = firestore.SERVER_TIMESTAMP
        db.collection("knowledge_index").document("global_stats").set(stats, merge=True)
    except Exception as e:
        logger.error(f"Failed to update knowledge index: {e}")

# =====================================================================
# Pydantic Schemas for Structured Output
# =====================================================================

class OceanMetrics(BaseModel):
    o: int = Field(..., description="Openness score, integer 0-100")
    c: int = Field(..., description="Conscientiousness score, integer 0-100")
    e: int = Field(..., description="Extraversion score, integer 0-100")
    a: int = Field(..., description="Agreeableness score, integer 0-100")
    n: int = Field(..., description="Neuroticism score, integer 0-100")

class LinguisticMetrics(BaseModel):
    emotional_density: int = Field(..., description="Emotional density score, integer 0-100")
    self_focus: int = Field(..., description="Self-focus score (use of 1st person), integer 0-100")
    stress_level: int = Field(..., description="Estimated stress level, integer 0-100")

class Metrics(BaseModel):
    ocean: OceanMetrics
    linguistic: LinguisticMetrics

ValidRelation = Literal[
    'גורם_ל', 'מרגיש', 'רוצה', 'מפחד_מ', 'חוסם', 'פתר', 
    'סותר', 'מחריף', 'מרגיע', 'מייצג', 'מושפע_מ', 'משפיע_על', 'קשור_ל'
]

class GraphEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    relation: ValidRelation = Field(..., description="Relationship type from a strict vocabulary: 'גורם_ל', 'מרגיש', 'רוצה', 'מפחד_מ', 'חוסם', 'פתר', 'סותר', 'מחריף', 'מרגיע', 'מייצג', 'מושפע_מ', 'משפיע_על', 'קשור_ל'")
    context: str = Field(..., description="The context or circumstances in which this relationship occurs (e.g., 'בעבודה', 'בזמן שיחה'). Use empty string if none.")
    sentimentScore: int = Field(..., description="Sentiment score of the relationship: -1 (negative/stressful), 0 (neutral), or 1 (positive/healing).")
    sourceQuotes: List[str] = Field(..., description="List of 1-2 direct quotes from the user's journal entries that prove this relationship.")

class GraphNode(BaseModel):
    id: str = Field(..., description="Unique atomic node ID in English or Hebrew, lowercase or clean name (1-3 words max, e.g., 'זוגיות' or 'חרדת_ביצוע'). Do NOT use long phrases or sentences.")
    label: str = Field(..., description="Short atomic node name/label in Hebrew (1-3 words max, e.g., 'זוגיות', 'שיחה', 'מגע'). Avoid using sentences, descriptions, or connector words like 'באמצעות', 'על ידי', 'של'.")
    aliases: List[str] = Field(..., description="List of synonyms or alternative names for this concept to prevent duplication (e.g., 'סטרס' for 'לחץ').")
    tags: List[str] = Field(..., description="List of explicit category tags for this concept.")
    coping_strategies: List[str] = Field(..., description="List of coping strategies or interventions that help with this concept (especially if negative).")
    type: str = Field(..., description="Node type, e.g., 'Insight', 'Trait', 'Pattern'")
    val: int = Field(..., description="Node value/weight, e.g. 2 or 3")
    content: str = Field(..., description="Detailed explanation/insight description in Hebrew")
    relatedEdges: List[GraphEdge] = Field(..., description="List of edges connected to this node")

class ApproachReports(BaseModel):
    clinical: str = Field(..., description="Professional clinical assessment report in Hebrew, mapping symptoms, distress and functioning based on Clinical OKF rules.")
    psychodynamic: str = Field(..., description="Deep psychodynamic formulation in Hebrew, detailing defense mechanisms, shadow, and attachment based on Psychodynamic OKF rules.")
    cbt: str = Field(..., description="Structured CBT formulation in Hebrew, identifying distortions, core beliefs, and thoughts-feelings-behaviors links based on CBT OKF rules.")
    behavioral: str = Field(..., description="Structured behavioral assessment (FBA) in Hebrew, mapping triggers (A), behaviors (B) and consequences (C) based on Behavioral OKF rules.")
    humanistic: str = Field(..., description="Existential-humanistic report in Hebrew, discussing meaning, freedom, isolation, and self-actualization based on Humanistic OKF rules.")
    fareast: str = Field(..., description="Far East Zen-Buddhist and Daoist philosophical analysis in Hebrew, analyzing the user's attachments, ego-clinging, and flow (Wu Wei).")

class RecommendedReading(BaseModel):
    thinker: str = Field(..., description="Name of the thinker, philosopher, poet, or psychologist from the knowledge base (e.g. 'דיוויד ברוקס', 'צ'ארלס דוהיג', 'יהודה עמיחי', 'סרן קירקגור').")
    source_work: str = Field(..., description="Title of the recommended book, essay, or poem (e.g. 'ההר השני', 'כוחו של הרגל', 'עכשיו ובימים האחרים').")
    quote: str = Field(..., description="A direct or representative quote/insight from the work in Hebrew.")
    relevance: str = Field(..., description="Empathic explanation in Hebrew connecting this quote/work directly to the issues discussed in the user's recent journal entries.")
    reflection_question: str = Field(..., description="A thought-provoking reflection question for the user to reflect upon or write about in their next journal entry.")

class OrchestratorOutput(BaseModel):
    executive_summary: str = Field(..., description="Integrative summary merging the insights from the 5 agents, written in Hebrew, about 2-4 paragraphs.")
    reports: ApproachReports = Field(..., description="Detailed clinical reports for each of the 5 theoretical approaches, written by applying their corresponding OKF knowledge rules.")
    significant_events: List[str] = Field(..., description="List of factual significant life events that occurred in the entry (e.g., 'פוטר מהעבודה', 'פגישה עם חבר').")
    action_items: List[str] = Field(..., description="List of intentions or goals the user resolved to do in the entry.")
    bio_psycho_correlation: str = Field(..., description="Brief analysis of correlation between physiological state (if available) and mental state described.")
    metrics: Metrics
    new_nodes: List[GraphNode] = Field(..., description="New psychological insight nodes to add to the knowledge graph, linking them to relevant existing concepts.")
    recommended_readings: List[RecommendedReading] = Field(default=[], description="List of 2-4 tailored reading recommendations and quotes from thinkers in the knowledge base relevant to the user's entries.")

# =====================================================================
# Specialized System Prompts
# =====================================================================

def load_okf_psychology() -> str:
    base_path = os.path.join(os.path.dirname(__file__), "okf", "psychology")
    content = ""
    try:
        if os.path.exists(base_path):
            for file in os.listdir(base_path):
                if file.endswith(".md"):
                    with open(os.path.join(base_path, file), "r", encoding="utf-8") as f:
                        content += f.read() + "\n\n"
    except Exception as e:
        logger.error(f"Failed to load OKF: {e}")
    return content

PSYCHOLOGY_KNOWLEDGE_BASE = load_okf_psychology()

_okf_cache_object = None
_okf_cache_created_at = None

def get_okf_generative_model(api_key: str, system_prompt: str) -> genai.GenerativeModel:
    """Helper to return a GenerativeModel utilizing Gemini Context Caching for the OKF base if available."""
    global _okf_cache_object, _okf_cache_created_at
    genai.configure(api_key=api_key)
    try:
        from google.generativeai import caching
        now = datetime.datetime.now(datetime.timezone.utc)
        if _okf_cache_object and _okf_cache_created_at and (now - _okf_cache_created_at).total_seconds() < 3300:
            return genai.GenerativeModel.from_cached_content(cached_content=_okf_cache_object)
        
        if len(PSYCHOLOGY_KNOWLEDGE_BASE) > 500:
            logger.info("Creating Gemini Context Cache for OKF Psychology Base...")
            _okf_cache_object = caching.CachedContent.create(
                model='models/gemini-2.5-flash',
                display_name='okf_psychology_base_cache',
                system_instruction=system_prompt,
                contents=[f"=== PSYCHOLOGICAL KNOWLEDGE BASE (OKF) ===\n{PSYCHOLOGY_KNOWLEDGE_BASE}"],
                ttl=datetime.timedelta(minutes=60)
            )
            _okf_cache_created_at = now
            return genai.GenerativeModel.from_cached_content(cached_content=_okf_cache_object)
    except Exception as e:
        logger.warning(f"Gemini Context Caching fallback to standard model generation: {e}")
        
    return genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_prompt
    )

def extract_authenticated_uid(req: https_fn.CallableRequest) -> str:
    """Extract authenticated user ID from req.auth, with fallback to req.data for backward compatibility."""
    if req.auth and req.auth.uid:
        return req.auth.uid
    uid = req.data.get('uid')
    if uid:
        logger.warning(f"Callable function executed without req.auth; using fallback uid from req.data: {uid}")
        return uid
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
        message="The function must be called while authenticated."
    )

def get_top_relevant_entries(entries_list: list, query_text: str, top_k: int = 15) -> list:
    """RAG helper to retrieve top_k entries relevant to query_text using semantic embeddings."""
    if not entries_list or len(entries_list) <= top_k:
        return entries_list
    try:
        query_emb = get_embedding(query_text)
        entry_sims = []
        for entry in entries_list:
            emb = entry.get('embedding')
            if not emb:
                content = entry.get('content') or entry.get('transcript') or ''
                topics = " ".join(entry.get('topics', []))
                emb = get_embedding(f"{topics} {content[:400]}")
            sim = cosine_similarity(query_emb, emb)
            entry_sims.append((sim, entry))
        entry_sims.sort(key=lambda x: x[0], reverse=True)
        return [entry for sim, entry in entry_sims[:top_k]]
    except Exception as e:
        logger.error(f"Failed RAG entries filtering, returning latest entries: {e}")
        return entries_list[-top_k:]

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Lead Clinical Orchestrator of the diary system.
Your task is to integrate the provided Psychological Knowledge Base (OKF formats) with the user's journal entries and produce a cohesive executive summary and structured profile.

Here are your inputs:
1. The user's recent journal entries.
2. The Psychological Knowledge Base (CBT, Psychodynamic, Clinical, Humanistic, Behavioral, Stoicism, Modern Thinkers, Poets).
3. The names/labels of existing concepts/nodes in the user's knowledge graph.
4. The user's physiological health metrics for the specific dates, represented as existing HealthMetric nodes.

Your output must be structured exactly as requested, containing:
1. An executive summary (integrative overview of the user's current psychological state, conflicts, coping mechanisms, and growth paths).
2. Six detailed approach reports (CBT, Psychodynamic, Humanistic, Behavioral, Clinical, and Far East Philosophy) populated in the `reports` field, applying the specific rules and terminology of each OKF model.
3. Metrics:
   - OCEAN profile (scores from 0 to 100).
   - Linguistic metrics (emotional density, self-focus, stress level, scores from 0 to 100).
4. A list of NEW psychological insight nodes to add to the knowledge graph.
5. A list of 2-4 tailored reading recommendations (`recommended_readings`) selecting relevant thinkers/writers from the Psychological Knowledge Base, complete with direct quotes, personal relevance explanations, and reflection questions.
   - CRITICAL WIKI-LINKS RULE: Inside the `content` and `executive_summary`, whenever you mention an existing concept, a new node you just created, or a specific psychologist, philosopher, or theory from the Psychological Knowledge Base (e.g., [[דיוויד ברוקס]], [[צ'ארלס דוהיג]], [[CBT]], [[תיאוריית הפוליווגל]]), wrap it in double brackets like `[[מושג]]`. This creates a live hyperlink in the UI and connects personal insights directly to the academic/practical frameworks. Make sure to use this extensively to interconnect knowledge!
   - CRITICAL NODE ATOMICITY RULE: Every node ID and label must be a short, atomic concept (1-3 words max, e.g. 'זוגיות', 'מגע', 'שיחה', 'חרדת_ביצוע'). DO NOT create nodes that represent sentences, processes, or relationships (e.g. do NOT create a node like 'זוגיות באמצעות שיחה ומגע'). Break complex relationships down into simple atomic nodes connected by Edges.
   - CRITICAL DISAMBIGUATION RULE: Always review the existing concepts provided. If the user mentions "סטרס", and "לחץ" exists, DO NOT create a new node. Use the existing concept ID and add "סטרס" to its `aliases` list.
   - Define relatedEdges to connect this new node to existing nodes or other new nodes. Provide `context` if applicable.
   - CRITICAL ONTOLOGY RULE: In relatedEdges, the `relation` field MUST be exactly one of the following Hebrew strings:
     * 'גורם_ל' (CAUSES) - if A causes/triggers B
     * 'מרגיש' (FEELS) - if A feels B (e.g. A feels anxiety)
     * 'רוצה' (DESIRES) - if A desires/aims for B
     * 'מפחד_מ' (FEARS) - if A fears/avoids B
     * 'חוסם' (BLOCKS) - if A blocks/prevents/restricts B
     * 'פתר' (RESOLVES) - if A resolves/solves/relieves B
     * 'סותר' (CONTRADICTS) - if A contradicts B
     * 'מחריף' (EXACERBATES) - if A makes B worse
     * 'מרגיע' (SOOTHES) - if A soothes/calms B
     * 'מייצג' (REPRESENTS) - if A represents/symbolizes B
     * 'מושפע_מ' (AFFECTED_BY) - if mental state is affected by physiological state (HealthMetric)
     * 'משפיע_על' (AFFECTS) - if mental state affects physiological state
     * 'קשור_ל' (RELATED_TO) - general fallback relationship
   - In relatedEdges, specify source, target, the relation, sentimentScore (-1 to 1), and sourceQuotes (actual quotes from text). Ensure you link the insights to the existing graph concepts where appropriate.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your executive summary STRICTLY on the provided journal entries and agent reports. 
- Quote directly from the text if needed, but only use actual words from the entries.

Write all summaries, node labels, and descriptions in HEBREW.
"""

# =====================================================================
# API Execution Helpers
# =====================================================================

def run_agent(agent_name: str, system_prompt: str, prompt_content: str, max_tokens: int = None, is_json: bool = False) -> str:
    """Helper function to call Gemini model for an individual agent."""
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt
        )
        generation_config = {"temperature": 0.2}
        if max_tokens:
            generation_config["max_output_tokens"] = max_tokens
        if is_json:
            generation_config["response_mime_type"] = "application/json"
            
        safety_settings = [
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
            
        response = model.generate_content(
            prompt_content,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        try:
            if response.candidates:
                candidate = response.candidates[0]
                finish_reason = candidate.finish_reason
                logger.info(f"Gemini agent {agent_name} finish reason: {finish_reason}")
                # In google-generativeai, finish_reason can be an enum or int. STOP is typically represented as STOP or 1
                if str(finish_reason) not in ("FinishReason.STOP", "STOP", "1", "FinishReason.1"):
                    logger.warning(f"Gemini agent {agent_name} finished abnormally! Full candidate info: {candidate}")
        except Exception as le:
            logger.error(f"Failed to log Gemini candidate details: {le}")
            
        return response.text
    except Exception as e:
        logger.error(f"Error running agent {agent_name}: {e}")
        return f"שגיאה בניתוח סוכן {agent_name}: {str(e)}"

def get_embedding(text: str) -> List[float]:
    """Helper function to generate embeddings using Gemini."""
    if not text or not isinstance(text, str):
        return []
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("No API key for embeddings")
            return []
        genai.configure(api_key=api_key)
        # Using text-embedding-004
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document"
        )
        return result.get('embedding', [])
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return []

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)

def extract_entities_from_text(text: str) -> List[str]:
    """
    Extracts key psychological or personal entities/concepts from a given text (Hebrew)
    using Gemini, to use as seed nodes for Graph-RAG traversal.
    """
    system_prompt = (
        "You are an expert NLP Entity Extractor. Extract the 3-7 core psychological concepts, "
        "personalities, projects, topics, or emotional terms from the user's text in Hebrew. "
        "Output strictly a JSON list of strings. Do not include markdown formatting or explanations."
    )
    prompt = f"Text to extract entities from:\n{text}\n\nOutput JSON list:"
    
    response = run_agent("EntityExtractor", system_prompt, prompt)
    
    entities = []
    try:
        clean_json = response.strip().strip('`').replace('json\n', '')
        entities = json.loads(clean_json)
        if not isinstance(entities, list):
            entities = []
    except Exception as e:
        logger.error(f"Failed to parse entities JSON: {e}. Raw response: {response}")
        pass
    
    cleaned_entities = []
    for ent in entities:
        if isinstance(ent, str):
            cleaned = ent.strip().lower()
            if cleaned:
                cleaned_entities.append(cleaned)
    return cleaned_entities


def get_subgraph_by_semantic_search(nodes_data: list, query_text: str, top_k: int = 15, max_hops: int = 1) -> dict:
    """
    Traverses the graph starting from nodes semantically similar to the query.
    Returns a dictionary with 'nodes' list and 'edges' list representing the subgraph.
    """
    query_emb = get_embedding(query_text)
    
    node_similarities = []
    for n in nodes_data:
        node_emb = n.get('embedding')
        if not node_emb:
            sim = 0.0
        else:
            sim = cosine_similarity(query_emb, node_emb)
        node_similarities.append((sim, n))
        
    node_similarities.sort(key=lambda x: x[0], reverse=True)
    top_nodes = [n for sim, n in node_similarities[:top_k] if sim > 0.1]
    
    seed_nodes = {n.get('id').strip().lower().replace(" ", "_") for n in top_nodes if n.get('id')}

    adj_list = {}
    nodes_by_id = {}
    
    for n in nodes_data:
        node_id = n.get('id')
        if not node_id:
            continue
        normalized_id = node_id.strip().lower().replace(" ", "_")
        nodes_by_id[normalized_id] = n
        adj_list[normalized_id] = []
        
    for normalized_id, n in nodes_by_id.items():
        edges = n.get('relatedEdges', [])
        for edge in edges:
            source = edge.get('source', '').strip().lower().replace(" ", "_")
            target = edge.get('target', '').strip().lower().replace(" ", "_")
            if source and target:
                if source in adj_list:
                    adj_list[source].append((target, edge))
                if target in adj_list:
                    adj_list[target].append((source, edge))

    visited_nodes = set(seed_nodes)
    visited_edges = []
    edge_ids_added = set()
    
    current_level = list(seed_nodes)
    
    for hop in range(max_hops):
        next_level = []
        for u in current_level:
            if u not in adj_list:
                continue
            for v, edge in adj_list[u]:
                edge_key = f"{edge.get('source')}-{edge.get('target')}-{edge.get('relation')}"
                if edge_key not in edge_ids_added:
                    visited_edges.append(edge)
                    edge_ids_added.add(edge_key)
                
                if v not in visited_nodes:
                    visited_nodes.add(v)
                    next_level.append(v)
        current_level = next_level

    subgraph_nodes = []
    for node_id in visited_nodes:
        if node_id in nodes_by_id:
            subgraph_nodes.append(nodes_by_id[node_id])
            
    return {
        "nodes": subgraph_nodes,
        "edges": visited_edges
    }


# =====================================================================
# Cloud Function Definition
# =====================================================================

@https_fn.on_call(timeout_sec=120)
def analyze_personality(req: https_fn.CallableRequest) -> dict:
    """
    Firebase Cloud Function Gen 2 callable to analyze personality using Multi-Agent System.
    """
    # 1. Resolve UID
    uid = extract_authenticated_uid(req)
    logger.info(f"Starting personality analysis for user: {uid}")

    # 2. Fetch User Config and Metadata
    user_ref = get_db().collection('users').document(uid)
    user_doc = user_ref.get()
    user_data = user_doc.to_dict() if user_doc.exists else {}
    new_entries_since_last = user_data.get('new_entries_since_last_analysis', 0)

    # 3. Fetch Entries
    entries_ref = get_db().collection('users').document(uid).collection('entries')
    entries_snapshot = entries_ref.stream()
    
    entries = []
    for doc in entries_snapshot:
        data = doc.to_dict()
        data['id'] = doc.id
        entries.append(data)

    if not entries:
        return {"status": "error", "message": "No entries found to analyze."}

    # Sort entries chronologically
    def get_timestamp_val(x):
        ts = x.get('timestamp')
        if not ts:
            return 0
        if hasattr(ts, 'timestamp'):  # firestore datetime / timestamp
            return ts.timestamp()
        if isinstance(ts, (int, float)):
            return ts
        try:
            return datetime.datetime.fromisoformat(str(ts).replace('Z', '+00:00')).timestamp()
        except:
            return 0

    entries = sorted(entries, key=get_timestamp_val)

    # 5. Fetch Previous Analysis to decide if it's baseline or delta
    analysis_ref = get_db().collection('users').document(uid).collection('personality_analysis')
    prev_analysis_query = analysis_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).stream()
    prev_analyses = list(prev_analysis_query)
    
    is_full = req.data.get('is_full', False)
    health_only = req.data.get('health_only', False)
    is_delta = len(prev_analyses) > 0 and new_entries_since_last > 0 and not is_full
    prev_analysis = prev_analyses[0].to_dict() if prev_analyses else None

    # Filter target entries depending on run type
    if health_only:
        graph_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
        health_nodes_snap = graph_ref.where(filter=firestore.FieldFilter("type", "==", "HealthMetric")).stream()
        health_dates = set([doc.to_dict().get('date') for doc in health_nodes_snap])
        
        target_entries = []
        for e in entries:
            date_str = e.get('date') or str(e.get('timestamp'))
            if hasattr(e.get('timestamp'), 'timestamp'):
                date_str = datetime.datetime.fromtimestamp(e.get('timestamp').timestamp()).strftime('%Y-%m-%d')
            elif 'frontmatter' in e and 'date' in e['frontmatter']:
                date_str = e['frontmatter']['date']
            elif isinstance(date_str, str) and 'T' in date_str:
                date_str = date_str.split('T')[0]
            if date_str in health_dates:
                target_entries.append(e)
        is_delta = False
        
    elif is_delta and prev_analysis:
        prev_time = prev_analysis.get('timestamp')
        prev_time_val = 0
        if prev_time:
            if hasattr(prev_time, 'timestamp'):
                prev_time_val = prev_time.timestamp()
            elif isinstance(prev_time, (int, float)):
                prev_time_val = prev_time
            else:
                try:
                    prev_time_val = datetime.datetime.fromisoformat(str(prev_time).replace('Z', '+00:00')).timestamp()
                except:
                    pass
        
        target_entries = [e for e in entries if get_timestamp_val(e) > prev_time_val]
        if not target_entries:
            target_entries = entries[-max(1, new_entries_since_last):]
    else:
        target_entries = entries

    # 4. Construct target text & prompt context
    combined_target_text = "\n".join([
        f"Topics: {', '.join(e.get('topics', []))}\nContent: {e.get('content') or e.get('transcript') or ''}"
        for e in target_entries
    ])

    prompt_context = ""
    if is_delta and prev_analysis:
        prompt_context += "=== PREVIOUS PERSONALITY ANALYSIS EXECUTIVE SUMMARY ===\n"
        prompt_context += f"{prev_analysis.get('executive_summary', '')}\n\n"
        prompt_context += "=== PREVIOUS REPORTS ===\n"
        for k, v in prev_analysis.get('reports', {}).items():
            prompt_context += f"Agent {k}: {v[:300]}...\n"
        prompt_context += "\n=== NEW JOURNAL ENTRIES SINCE LAST ANALYSIS ===\n"
    else:
        prompt_context += "=== ALL JOURNAL ENTRIES ===\n"

    for entry in target_entries:
        date_str = entry.get('date') or str(entry.get('timestamp'))
        topics = ", ".join(entry.get('topics', []))
        content = entry.get('content') or entry.get('transcript') or ""
        prompt_context += f"Date: {date_str}\nTopics: {topics}\nContent: {content}\n---\n"

    # Fetch and Filter Existing Graph Nodes using Graph-RAG (passing combined_target_text)
    graph_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
    graph_snapshot = graph_ref.stream()
    all_nodes = []
    for doc in graph_snapshot:
        data = doc.to_dict()
        data['id'] = data.get('id') or doc.id
        all_nodes.append(data)
        
    subgraph = get_subgraph_by_semantic_search(all_nodes, combined_target_text, top_k=15, max_hops=1)
    
    existing_nodes_context = "\n".join([
        f"- {n.get('id')} (Label: {n.get('label')})" 
        for n in subgraph['nodes']
    ])

    # Inject Health Metrics Nodes for the dates of the target entries
    target_dates = set()
    for e in target_entries:
        date_str = e.get('date') or str(e.get('timestamp'))
        if hasattr(e.get('timestamp'), 'timestamp'):
            date_str = datetime.datetime.fromtimestamp(e.get('timestamp').timestamp()).strftime('%Y-%m-%d')
        elif 'frontmatter' in e and 'date' in e['frontmatter']:
            date_str = e['frontmatter']['date']
        elif isinstance(date_str, str) and 'T' in date_str:
            date_str = date_str.split('T')[0]
        target_dates.add(date_str)

    health_nodes = [n for n in all_nodes if n.get('type') == 'HealthMetric' and n.get('date') in target_dates]
    if health_nodes:
        existing_nodes_context += "\n\n=== HEALTH METRICS FOR RELEVANT DATES ===\n"
        existing_nodes_context += "\n".join([
            f"- {n.get('id')} (Label: {n.get('label')}):\n  Content: {n.get('content')}" 
            for n in health_nodes
        ])

    logger.info(f"Filtered to {len(subgraph['nodes'])} relevant existing nodes and {len(health_nodes)} health nodes for context.")
    logger.info(f"Running {'delta' if is_delta else 'baseline'} analysis on {len(target_entries)} entries.")

    # 7. Execute single unified AI Orchestrator with OKF Context
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        
        orchestrator_model = get_okf_generative_model(api_key, ORCHESTRATOR_SYSTEM_PROMPT)
        
        orchestrator_prompt = f"""
=== USER ENTRIES ===
{prompt_context}

=== EXISTING GRAPH NODES ===
{existing_nodes_context}
"""
        orchestrator_response = orchestrator_model.generate_content(
            orchestrator_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=OrchestratorOutput,
                temperature=0.2
            )
        )
        
        orchestrator_output = OrchestratorOutput.model_validate_json(orchestrator_response.text)
    except Exception as e:
        logger.error(f"Error during orchestrator phase: {e}")
        # Build a raw/mock structure in case of orchestrator schema validation failure
        orchestrator_output = OrchestratorOutput(
            executive_summary="שגיאה בעיבוד האינטגרטיבי של הסוכנים. מוצג דוח משולב בסיסי.",
            reports=ApproachReports(
                clinical="שגיאה בטעינת הדוח הקליני.",
                psychodynamic="שגיאה בטעינת הדוח הפסיכודינמי.",
                cbt="שגיאה בטעינת דוח ה-CBT.",
                behavioral="שגיאה בטעינת הדוח ההתנהגותי.",
                humanistic="שגיאה בטעינת הדוח ההומניסטי.",
                fareast="שגיאה בטעינת דוח המזרח הרחוק."
            ),
            metrics=Metrics(
                ocean=OceanMetrics(o=50, c=50, e=50, a=50, n=50),
                linguistic=LinguisticMetrics(emotional_density=50, self_focus=50, stress_level=50)
            ),
            new_nodes=[]
        )

    # 9. Persist Personality Analysis Document & Reading Recommendations
    analysis_doc_id = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    readings_data = [r.model_dump() for r in orchestrator_output.recommended_readings]
    
    analysis_payload = {
        "timestamp": firestore.SERVER_TIMESTAMP,
        "executive_summary": orchestrator_output.executive_summary,
        "reports": orchestrator_output.reports.model_dump(),
        "metrics": orchestrator_output.metrics.model_dump(),
        "recommended_readings": readings_data,
        "new_entries_since_last_analysis": 0
    }
    
    analysis_ref.document(analysis_doc_id).set(analysis_payload)
    
    if readings_data:
        readings_ref = get_db().collection('users').document(uid).collection('recommended_readings')
        readings_ref.document("latest").set({
            "updated_at": firestore.SERVER_TIMESTAMP,
            "readings": readings_data,
            "analysis_id": analysis_doc_id
        })

    # 10. Write New Nodes to Firestore OKF Knowledge Graph
    for node in orchestrator_output.new_nodes:
        # Sanitize node id
        node_doc_id = node.id.strip().replace(" ", "_")
        node_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes').document(node_doc_id)
        
        # Format edges
        edges_list = []
        for edge in node.relatedEdges:
            edges_list.append({
                "source": edge.source.strip().replace(" ", "_"),
                "target": edge.target.strip().replace(" ", "_"),
                "relation": edge.relation,
                "sentimentScore": getattr(edge, "sentimentScore", 0),
                "sourceQuotes": getattr(edge, "sourceQuotes", [])
            })
            
        node_embedding = get_embedding(f"{node.label} {node.content}")
            
        node_ref.set({
            "id": node_doc_id,
            "label": node.label,
            "type": node.type,
            "val": node.val,
            "content": node.content,
            "relatedEdges": edges_list,
            "embedding": node_embedding,
            "last_active": firestore.SERVER_TIMESTAMP
        }, merge=True)

    # 11. Reset Counter in User Doc
    user_ref.set({"new_entries_since_last_analysis": 0}, merge=True)

    logger.info(f"Successfully completed and persisted personality analysis for user {uid}")
    
    return {
        "status": "success",
        "analysis_id": analysis_doc_id,
        "is_delta": is_delta,
        "new_nodes_added": len(orchestrator_output.new_nodes)
    }

@https_fn.on_call()
def dummy_force_redeploy(req: https_fn.CallableRequest) -> dict:
    return {"status": "ok"}

@https_fn.on_call()
def verify_passcode(req: https_fn.CallableRequest) -> dict:
    """
    Validates the passcode on the server side.
    """
    passcode = req.data.get('passcode')
    if passcode == "270107":
        return {"status": "success", "token": "session_approved_270107"}
    else:
        return {"status": "error", "message": "קוד גישה שגוי. נסה שוב."}


@https_fn.on_call(timeout_sec=120)
def sync_insights_to_graph(req: https_fn.CallableRequest) -> dict:
    """
    Reads existing insights from users/{uid}/insights/current and synchronizes them
    as Insight nodes in the users/{uid}/knowledge_graph_nodes collection.
    """
    uid = req.data.get('uid')
    if not uid and req.auth:
        uid = req.auth.uid
    if not uid:
        return {"status": "error", "message": "Missing UID"}

    db_conn = get_db()
    
    # 1. Fetch current insights
    insights_ref = db_conn.collection('users').document(uid).collection('insights').document('current')
    insights_snap = insights_ref.get()
    if not insights_snap.exists:
        return {"status": "error", "message": "לא נמצא מסמך תובנות פעיל לסנכרון."}
        
    insights_data = insights_snap.to_dict()
    
    # 2. Fetch existing graph nodes to map relationships and compare content
    nodes_ref = db_conn.collection('users').document(uid).collection('knowledge_graph_nodes')
    nodes_snapshot = nodes_ref.stream()
    existing_nodes = []
    existing_content_map = {}
    
    for doc in nodes_snapshot:
        data = doc.to_dict()
        node_id = data.get('id') or doc.id
        label = data.get('label') or node_id
        content = data.get('content', '')
        existing_nodes.append({"id": node_id, "label": label})
        existing_content_map[node_id] = content
        
    existing_nodes_context = "\n".join([f"- {n['id']} (Label: {n['label']})" for n in existing_nodes])

    # 3. Parse all insights into a flat dictionary of items to sync
    sync_items = {}
    
    # Major Insights
    major_list = insights_data.get('majorInsights', [])
    for i, ins in enumerate(major_list):
        sync_items[f"insight_major_{i}"] = {
            "label": f"תובנת מפתח {i+1}",
            "content": ins,
            "type": "Insight"
        }
        
    # Operating Manual Sections
    manual_sections = insights_data.get('operatingManual', {}).get('insight', {}).get('sections', [])
    for i, sec in enumerate(manual_sections):
        title = sec.get('title', f"סעיף מדריך {i+1}")
        bullets = "\n".join([f"- {b}" for b in sec.get('bullets', [])])
        sync_items[f"insight_manual_{i}"] = {
            "label": f"הנחיית מדריך: {title}",
            "content": bullets,
            "type": "Insight"
        }
        
    # Weekly Insight
    weekly = insights_data.get('weeklyInsight')
    if weekly:
        sync_items["insight_weekly"] = {
            "label": "תובנה שבועית מרוכזת",
            "content": weekly,
            "type": "Insight"
        }
        
    # Shadow Work
    shadow = insights_data.get('shadowWork', {}).get('insight')
    if shadow:
        sync_items["insight_shadow"] = {
            "label": "עבודת צללים",
            "content": shadow,
            "type": "Insight"
        }
        
    # Categorical Insights
    cat = insights_data.get('categoricalInsights', {})
    for key in ['work', 'personal', 'family']:
        val = cat.get(key)
        if val:
            cat_labels = {"work": "קריירה ועבודה", "personal": "אישי ומנטלי", "family": "משפחה וזוגיות"}
            sync_items[f"insight_category_{key}"] = {
                "label": f"תובנת תחום: {cat_labels.get(key, key)}",
                "content": val,
                "type": "Insight"
            }
            
    # Daily GTD
    daily = insights_data.get('dailyGtd', {}).get('insight')
    if daily:
        sync_items["insight_daily"] = {
            "label": "רפלקציה יומית (GTD)",
            "content": daily,
            "type": "Insight"
        }

    # Filter out insights that have already been synced and whose content has not changed
    sync_items_to_process = {}
    for key, item in sync_items.items():
        if key in existing_content_map and existing_content_map[key] == item["content"]:
            # Content matches exactly, skip mapping and writing
            continue
        sync_items_to_process[key] = item

    if not sync_items_to_process:
        return {"status": "success", "nodes_added": 0, "message": "כל התובנות כבר מסונכרנות ומעודכנות בגרף."}

    # 4. Run bulk AI extraction to link ONLY the new/changed insights to existing nodes
    insights_list_str = "\n\n".join([f"Key: {k}\nContent: {v['content']}" for k, v in sync_items_to_process.items()])
    
    mapping_prompt = f"""
For each of the following new insights (identified by Key), determine which 1-3 of the existing nodes in the knowledge graph they are most strongly related to.
Only select nodes from the list of Existing Nodes below. Do not create new node IDs.
If an insight does not relate to any existing node, map it to an empty list.

Existing Nodes:
{existing_nodes_context}

Insights to Map:
{insights_list_str}

Output strictly valid JSON mapping each Key to a list of related Node IDs:
{{
  "key_name": ["node_id1", "node_id2"]
}}
"""
    
    mapping_response = run_agent("Mapper", "You output only valid JSON without markdown formatting.", mapping_prompt)
    
    relations_map = {}
    try:
        import json
        clean_json = mapping_response.strip().strip('`').replace('json\n', '')
        relations_map = json.loads(clean_json)
    except Exception as e:
        logger.error(f"Failed to parse bulk relationship mapping JSON: {e}")
        
    # 5. Write each new/changed insight to Firestore as a Node
    nodes_added = 0
    for key, item in sync_items_to_process.items():
        node_ref = db_conn.collection('users').document(uid).collection('knowledge_graph_nodes').document(key)
        
        # Build related edges
        related_ids = relations_map.get(key, [])
        edges = []
        for rid in related_ids:
            edges.append({
                "source": key,
                "target": rid.strip().replace(" ", "_"),
                "relation": "קשור לתובנה",
                "sentimentScore": 0,
                "sourceQuotes": []
            })
            
        node_ref.set({
            "id": key,
            "label": item["label"],
            "type": item["type"],
            "val": 3,
            "content": item["content"],
            "relatedEdges": edges,
            "timestamp": firestore.SERVER_TIMESTAMP
        }, merge=True)
        nodes_added += 1
        
    return {
        "status": "success",
        "nodes_added": nodes_added
    }



DETECTIVE_SYSTEM_PROMPT = """You are an expert Psychological Detective Agent.
Your task is to analyze the user's complete knowledge graph (nodes and edges) and provide deep insights, or answer their specific question based on the graph.
Focus on:
1. Missing Links: Identify nodes that are semantically or psychologically related but have no direct edges. Suggest why this might be happening (e.g. defense mechanisms, compartmentalization).
2. Core Conflicts: Look at contradictory edges or central hubs with mixed sentiment and explain the underlying tension.
3. Emerging Patterns: Highlight overarching themes.

If the user asks a specific question, answer it directly using the graph data.
Output your response in Hebrew using markdown."""

@https_fn.on_call(timeout_sec=120)
def analyze_knowledge_graph(req: https_fn.CallableRequest) -> dict:
    uid = extract_authenticated_uid(req)
    query = req.data.get('query', 'אנא נתח את הגרף שלי ומצא קשרים חסרים, קונפליקטים ותבניות מעניינות.')

    logger.info(f"Detective agent analyzing graph for {uid} with query: {query}")

    # Fetch nodes excluding embeddings and isolating QAResponse nodes
    nodes_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
    nodes_snapshot = nodes_ref.select(['id', 'label', 'type', 'content', 'relatedEdges']).stream()
    
    graph_data = []
    for doc in nodes_snapshot:
        data = doc.to_dict()
        if data.get('type') == 'QAResponse':
            continue
        node_id = data.get('id', doc.id)
        label = data.get('label', node_id)
        edges = data.get('relatedEdges', [])
        edges_str = ", ".join([f"[{e.get('relation')}] to {e.get('target')} (Sentiment: {e.get('sentimentScore', 0)})" for e in edges])
        graph_data.append(f"Node: {label} (Type: {data.get('type', '')})\n  Connections: {edges_str if edges_str else 'None'}")
        
    graph_context = "\n".join(graph_data)
    
    prompt = f"User Query: {query}\n\nGraph Data:\n{graph_context}"
    
    response = run_agent("Detective", DETECTIVE_SYSTEM_PROMPT, prompt)
    
    import uuid
    insight_id = f"graph_insight_{uuid.uuid4().hex[:8]}"
    
    extraction_prompt = f"""Extract a short Hebrew label (max 5 words) for this insight, and list 1-3 related node IDs from the user's query/graph that it strongly discusses. 
Additionally, if the insight suggests a missing link or new relationship between existing nodes, provide a list of 'suggested_edges'.
Output strictly valid JSON like: 
{{
  "label": "...",
  "related_nodes": ["node1", "node2"],
  "suggested_edges": [
    {{"source": "node1", "target": "node2", "relation": "קשור_ל", "sentimentScore": -1}}
  ]
}}

Insight:
{response}"""
    extraction_response = run_agent("Extractor", "You output only valid JSON without markdown formatting.", extraction_prompt)
    
    label = "תובנת בלש (AI)"
    related_nodes = []
    suggested_edges = []
    try:
        import json
        clean_json = extraction_response.strip().strip('`').replace('json\n', '')
        extracted = json.loads(clean_json)
        label = extracted.get('label', label)
        related_nodes = extracted.get('related_nodes', [])
        suggested_edges = extracted.get('suggested_edges', [])
    except Exception as e:
        logger.error(f"Failed to extract JSON for insight node: {e}")
        pass
        
    edges_list = []
    for rn in related_nodes:
        edges_list.append({
            "source": insight_id,
            "target": rn.strip().replace(" ", "_"),
            "relation": "ניתוח בלש",
            "sentimentScore": 0,
            "sourceQuotes": []
        })
        
    get_db().collection('users').document(uid).collection('knowledge_graph_nodes').document(insight_id).set({
        "id": insight_id,
        "label": label,
        "type": "DetectiveInsight",
        "val": 3,
        "content": response,
        "relatedEdges": edges_list,
        "embedding": get_embedding(f"{label} {response}"),
        "timestamp": firestore.SERVER_TIMESTAMP,
        "last_active": firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    for edge in suggested_edges:
        source_id = edge.get("source", "").strip().replace(" ", "_")
        target_id = edge.get("target", "").strip().replace(" ", "_")
        if source_id and target_id:
            edge_payload = {
                "source": source_id,
                "target": target_id,
                "relation": edge.get("relation", "קשור_ל"),
                "sentimentScore": edge.get("sentimentScore", 0),
                "is_suggested": True,
                "sourceQuotes": []
            }
            try:
                source_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes').document(source_id)
                source_ref.update({
                    "relatedEdges": firestore.ArrayUnion([edge_payload]),
                    "last_active": firestore.SERVER_TIMESTAMP
                })
            except Exception as update_err:
                logger.warning(f"Failed to add suggested edge to {source_id}: {update_err}")
    
    return {
        "status": "success",
        "result": response
    }


INVESTIGATOR_SYSTEM_PROMPT = """You are an expert Psychological Investigator and Diary Analyst.
Your task is to answer the user's question by thoroughly researching and analyzing:
1. Their raw journal entries (the personal texts and transcripts).
2. Their structured insights (major insights, operating manual, categorical insights, weekly insights, shadow work).
3. Their knowledge base (concepts and connections in the knowledge graph).

Provide a deep, clear, empathetic, and organized answer in Hebrew.
CRITICAL RULES:
- Ground your answer strictly in the user's data. Do not make up events, topics, or relationships that are not in the provided texts or graph.
- Cite specific dates or concept names when discussing patterns or events where possible.
- If you cannot find relevant information to answer the question, state it clearly and suggest what is missing.
"""

@https_fn.on_call(timeout_sec=120)
def query_diary_insights(req: https_fn.CallableRequest) -> dict:
    uid = extract_authenticated_uid(req)
    query_text = req.data.get('query')
    if not query_text:
        return {"status": "error", "message": "Missing query"}
        
    history = req.data.get('history', [])
    history_lines = []
    for msg in history:
        role = msg.get('role')
        text = msg.get('text') or msg.get('content') or ""
        if "שאל אותי כל שאלה על היומנים" in text:
            continue
        text = text.replace('\n\n*(התשובה נשמרה אוטומטית כצומת תובנה בבסיס הידע)*', '')
        role_label = "User" if role == 'user' else "AI"
        history_lines.append(f"{role_label}: {text}")
        
    history_context = "\n".join(history_lines) if history_lines else ""

    logger.info(f"Investigating diary/insights/graph for {uid} with query: {query_text}. History length: {len(history)}")

    # 1. Fetch entries and filter with Semantic RAG
    entries_ref = get_db().collection('users').document(uid).collection('entries')
    entries_snapshot = entries_ref.stream()
    raw_entries = [doc.to_dict() for doc in entries_snapshot]
    relevant_entries = get_top_relevant_entries(raw_entries, query_text, top_k=35)
    
    entries_data = []
    for data in relevant_entries:
        date_str = data.get('date') or str(data.get('timestamp'))
        topics = ", ".join(data.get('topics', []))
        content = data.get('content') or data.get('transcript') or ""
        entries_data.append(f"- Date: {date_str} | Topics: {topics}\n  Content: {content}")
    entries_context = "\n\n".join(entries_data)

    # 2. Fetch original insights
    insights_ref = get_db().collection('users').document(uid).collection('insights').document('current')
    insights_snap = insights_ref.get()
    insights_context = "No structured insights found."
    if insights_snap.exists:
        insights_data = insights_snap.to_dict()
        major = "\n".join([f"- {ins}" for ins in insights_data.get('majorInsights', [])])
        weekly = insights_data.get('weeklyInsight', 'None')
        shadow = insights_data.get('shadowWork', {}).get('insight', 'None')
        manual_sections = []
        for s in insights_data.get('operatingManual', {}).get('insight', {}).get('sections', []):
            bullets_str = "\n  ".join([f"* {b}" for b in s.get('bullets', [])])
            manual_sections.append(f"{s.get('title')}:\n  {bullets_str}")
        manual_context = "\n".join(manual_sections)
        insights_context = f"Major Insights:\n{major}\n\nWeekly Insight:\n{weekly}\n\nShadow Work:\n{shadow}\n\nOperating Manual:\n{manual_context}"

    # 3. Fetch and filter graph nodes (Graph-RAG)
    nodes_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
    nodes_snapshot = nodes_ref.stream()
    all_nodes = []
    for doc in nodes_snapshot:
        data = doc.to_dict()
        if data.get('type') == 'QAResponse':
            continue
        data['id'] = data.get('id') or doc.id
        all_nodes.append(data)
        
    subgraph = get_subgraph_by_semantic_search(all_nodes, query_text, top_k=15, max_hops=1)
    logger.info(f"Graph-RAG traversal retrieved {len(subgraph['nodes'])} relevant nodes.")
    
    graph_data = []
    for n in subgraph['nodes']:
        node_id = n.get('id')
        label = n.get('label', node_id)
        content = n.get('content', '')
        edges = n.get('relatedEdges', [])
        edges_str = ", ".join([f"[{e.get('relation')}] -> {e.get('target')}" for e in edges])
        graph_data.append(f"- Concept: {label} ({content})\n  Connections: {edges_str if edges_str else 'None'}")
        
    graph_context = "\n".join(graph_data) if graph_data else "No relevant knowledge graph context found."

    # 4. Construct prompt
    prompt = f"User Question: {query_text}\n\n"
    if history_context:
        prompt += f"=== CONVERSATION HISTORY ===\n{history_context}\n\n"
    prompt += f"=== USER JOURNAL ENTRIES (TEXTS) ===\n{entries_context}\n\n=== USER STRUCTURED INSIGHTS ===\n{insights_context}\n\n=== USER KNOWLEDGE BASE (GRAPH CONCEPTS) ===\n{graph_context}"

    response = run_agent("Investigator", INVESTIGATOR_SYSTEM_PROMPT, prompt)
    
    import uuid
    insight_id = f"investigator_{uuid.uuid4().hex[:8]}"
    
    extraction_prompt = f"Extract a short Hebrew label (max 5 words) for this insight, and list 1-3 related node IDs from the knowledge base that it discusses. Output strictly valid JSON like: {{\n  \"label\": \"...\",\n  \"related_nodes\": [\"node1\", \"node2\"]\n}}\n\nInsight:\n{response}"
    extraction_response = run_agent("Extractor", "You output only valid JSON without markdown formatting.", extraction_prompt)
    
@https_fn.on_call(timeout_sec=60)
def explain_graph_link(req: https_fn.CallableRequest) -> dict:
    uid = extract_authenticated_uid(req)
    source = req.data.get('source')
    target = req.data.get('target')
    relation = req.data.get('relation', '')
    
    if not source or not target:
        return {"status": "error", "message": "Missing source or target"}
        
    db_conn = get_db()
    source_ref = db_conn.collection('users').document(uid).collection('knowledge_graph_nodes').document(source)
    target_ref = db_conn.collection('users').document(uid).collection('knowledge_graph_nodes').document(target)
    
    source_snap = source_ref.get()
    target_snap = target_ref.get()
    
    source_content = source_snap.to_dict().get('content', '') if source_snap.exists else ''
    target_content = target_snap.to_dict().get('content', '') if target_snap.exists else ''
    
    system_prompt = "You are an empathetic, insightful psychological analyzer. Explain in Hebrew in 1-2 sentences how these two concepts in the user's mind are connected, based on the provided context. Keep it direct and personal (using 'אתה'/'את')."
    prompt = f"Concept A: {source}\nDescription: {source_content}\n\nConcept B: {target}\nDescription: {target_content}\n\nRelation Label: {relation}\n\nExplain the connection:"
    
    response = run_agent("LinkExplainer", system_prompt, prompt)
    
    # Auto-save AI explanation to the edge
    if source_snap.exists:
        data = source_snap.to_dict()
        edges = data.get('relatedEdges', [])
        updated = False
        for edge in edges:
            # We match by target and relation (fallback to just target if relation missing)
            if edge.get('target') == target and edge.get('relation', '') == relation:
                edge['aiExplanation'] = response
                updated = True
        
        if updated:
            source_ref.update({'relatedEdges': edges})

    return {
        "status": "success",
        "explanation": response
    }


@https_fn.on_call(timeout_sec=300)
def resolve_and_cluster_entities(req: https_fn.CallableRequest) -> dict:
    """
    1. Fetch all nodes in the knowledge graph.
    2. Call Gemini to identify duplicates (to merge) and related groups (to cluster under meta-concepts).
    3. Update the database:
       - Merges duplicates (redirecting edges, merging descriptions, deleting redundant nodes).
       - Creates meta-concepts (parent nodes) and links children nodes to them.
    """
    import traceback
    try:
        uid = extract_authenticated_uid(req)
        db_conn = get_db()
        nodes_ref = db_conn.collection('users').document(uid).collection('knowledge_graph_nodes')
        nodes_snapshot = nodes_ref.stream()
        
        nodes_data = []
        for doc in nodes_snapshot:
            data = doc.to_dict()
            data['id'] = data.get('id') or doc.id
            nodes_data.append(data)
            
        if not nodes_data:
            return {"status": "success", "message": "הגרף ריק, אין מה לאחד."}
            
        # =========================================================
        # OKF Knowledge Indexing & Clustering (Graphify Logic)
        # =========================================================
        try:
            import networkx as nx
            from networkx.algorithms.community import louvain_communities
            
            G = nx.Graph()
            for n in nodes_data:
                node_id = n.get('id')
                if node_id:
                    G.add_node(node_id, label=n.get('label') or node_id)
                    for edge in n.get('relatedEdges', []):
                        target = edge.get('target')
                        if target:
                            if isinstance(target, dict):
                                target = target.get('id')
                            G.add_edge(node_id, target)
                            
            if len(G.nodes) > 0:
                louvain_comms = louvain_communities(G)
                pr = nx.pagerank(G)
                communities = []
                
                for i, comm in enumerate(louvain_comms):
                    god_node = max(comm, key=lambda x: pr.get(x, 0))
                    communities.append({
                        "community_id": f"cluster_{i}",
                        "god_node": god_node,
                        "size": len(comm),
                        "members": list(comm)
                    })
                    
                update_knowledge_index({
                    "total_nodes": len(G.nodes),
                    "total_edges": len(G.edges),
                    "communities": communities
                })
                log_knowledge_action("graph_clustering", {"communities_count": len(communities), "nodes": len(G.nodes)})
        except Exception as e:
            logger.error(f"NetworkX clustering failed: {e}")
        # =========================================================

        # Calculate degrees and detect lexical duplicate candidates in Python
        node_degrees = {}
        for n in nodes_data:
            node_id = n.get('id')
            if node_id:
                edges = n.get('relatedEdges', [])
                node_degrees[node_id] = len(edges)
                
        import difflib
        semantic_groups = []
        seen_semantic = set()
        
        for i in range(len(nodes_data)):
            n1 = nodes_data[i]
            id1 = n1.get('id')
            if not id1 or not isinstance(id1, str) or id1 in seen_semantic:
                continue
                
            group = [n1]
            seen_semantic.add(id1)
            
            emb1 = n1.get('embedding')
            lbl1 = n1.get('label') or id1
            
            for j in range(i + 1, len(nodes_data)):
                n2 = nodes_data[j]
                id2 = n2.get('id')
                if not id2 or not isinstance(id2, str) or id2 in seen_semantic:
                    continue
                    
                emb2 = n2.get('embedding')
                lbl2 = n2.get('label') or id2
                is_similar = False
                
                if emb1 and emb2:
                    sim = cosine_similarity(emb1, emb2)
                    if sim > 0.8:
                        is_similar = True
                else:
                    ratio = difflib.SequenceMatcher(None, lbl1, lbl2).ratio()
                    if ratio > 0.8:
                        is_similar = True
                        
                if is_similar:
                    group.append(n2)
                    seen_semantic.add(id2)
                    
            if len(group) > 1:
                semantic_groups.append(group)

        # Select nodes to send: semantic candidates + active nodes (degree >= 2)
        selected_node_ids = set()
        for grp in semantic_groups:
            for x in grp:
                x_id = x.get('id')
                if x_id:
                    selected_node_ids.add(x_id)
                
        for n in nodes_data:
            node_id = n.get('id')
            if node_id and node_degrees.get(node_id, 0) >= 2:
                selected_node_ids.add(node_id)
                
        # Compile summary of selected nodes
        nodes_summary = []
        for n in nodes_data:
            node_id = n.get('id')
            if node_id in selected_node_ids:
                nodes_summary.append({
                    "id": node_id,
                    "label": n.get('label'),
                    "type": n.get('type'),
                    "content": n.get('content', '')
                })
            
        logger.info(f"Total nodes in database: {len(nodes_data)}. Filtered nodes sent to Gemini: {len(nodes_summary)}")
            
        prompt = f"""
You are an expert Knowledge Graph Optimizer and Semantic Analyzer.
Review the following list of nodes from the user's psychological knowledge graph.

Your task is to identify:
1. Duplicate / Near-Duplicate Entities: Nodes that refer to the exact same concept or person (e.g. 'עבודה', 'מקום_העבודה', 'העבודה' or 'אמא שלי', 'אמי'). Choose one 'canonical' ID and list the duplicate IDs to merge into it.
2. Groupings for Meta-Concepts: Semantically related nodes (e.g., 'חובות', 'אוברדראפט', 'חוסר_כסף') that should be grouped under a new parent concept (e.g., 'ביטחון_כלכלי'). Provide a clean ID, Hebrew label, an extremely concise content description (why these are grouped - at most 1-2 short sentences, under 20 words), and the list of child IDs.

Nodes List:
{json.dumps(nodes_summary, ensure_ascii=False, indent=2)}

Output strictly valid JSON with the following schema:
{{
  "merges": [
    {{
      "canonical_id": "canonical_node_id",
      "canonical_label": "שם הצומת הראשי בעברית",
      "duplicate_ids": ["dup_id1", "dup_id2"]
    }}
  ],
  "meta_concepts": [
    {{
      "id": "new_meta_concept_id",
      "label": "שם מושג העל בעברית",
      "content": "הסבר קצר ותמציתי בעברית (עד 20 מילים, 1-2 משפטים) על מושג העל ואיך הוא מחבר את תתי המושגים",
      "child_ids": ["child_id1", "child_id2"]
    }}
  ]
}}

Ensure all ID strings contain only letters, numbers, and underscores (no spaces).
Only suggest merges/clusters that are highly relevant. Do not force them if not needed.
"""

        system_prompt = "You are a psychological knowledge graph optimizer. Output your analysis as a JSON object matching the requested schema. You may use markdown json code blocks."
        try:
            db_conn.collection('users').document(uid).collection('temp_logs').document('last_optimizer_prompt').set({
                "prompt": prompt,
                "system_prompt": system_prompt
            })
        except Exception as pe:
            logger.error(f"Failed to log prompt: {pe}")
            
        response = run_agent("GraphOptimizer", system_prompt, prompt, max_tokens=None, is_json=False)
        
        try:
            clean_json = response.strip().strip('`').replace('json\n', '')
            instructions = json.loads(clean_json)
        except Exception as e:
            logger.error(f"Failed to parse optimization JSON response: {e}. Raw response: {response}")
            try:
                db_conn.collection('users').document(uid).collection('temp_logs').document('last_optimizer_run').set({
                    "raw_response": response,
                    "clean_json": clean_json,
                    "error": str(e)
                })
            except Exception as fe:
                logger.error(f"Failed to write temp log to Firestore: {fe}")
            return {"status": "error", "message": "שגיאה בעיבוד תשובת ה-AI."}
            
        merges = instructions.get('merges', [])
        meta_concepts = instructions.get('meta_concepts', [])
        
        logger.info(f"Gemini raw response: {response}")
        logger.info(f"Parsed merges: {merges}")
        logger.info(f"Parsed meta_concepts: {meta_concepts}")
        
        # Track actions taken
        merges_count = 0
        clusters_count = 0
        
        # 3. Perform Merges in Firestore
        duplicate_to_canonical = {}
        for merge in merges:
            canon_id = merge.get('canonical_id')
            if not canon_id or not isinstance(canon_id, str) or not canon_id.strip():
                continue
            canon_id = canon_id.strip()
            dups = merge.get('duplicate_ids', [])
            for d in dups:
                if d and isinstance(d, str) and d.strip():
                    duplicate_to_canonical[d.strip()] = canon_id

        updated_nodes = {}
        nodes_to_delete = set()
        
        for n in nodes_data:
            node_id = n.get('id')
            if not node_id or not isinstance(node_id, str) or not node_id.strip():
                continue
            node_id = node_id.strip()
            if node_id in duplicate_to_canonical:
                nodes_to_delete.add(node_id)
                continue
            updated_nodes[node_id] = n

        for merge in merges:
            canon_id = merge.get('canonical_id')
            if not canon_id or not isinstance(canon_id, str) or not canon_id.strip():
                continue
            canon_id = canon_id.strip()
            canon_label = merge.get('canonical_label') or canon_id
            dups = merge.get('duplicate_ids', [])
            
            if canon_id in updated_nodes:
                canon_node = updated_nodes[canon_id]
                content_pieces = [canon_node.get('content', '')]
                for dup_id in dups:
                    if dup_id and isinstance(dup_id, str) and dup_id.strip():
                        dup_id = dup_id.strip()
                        dup_node = next((x for x in nodes_data if x.get('id') == dup_id), None)
                        if dup_node and dup_node.get('content'):
                            content_pieces.append(dup_node.get('content'))
                
                unique_contents = list(set([c.strip() for c in content_pieces if c.strip()]))
                canon_node['content'] = "\n\n".join(unique_contents)
                canon_node['label'] = canon_label
                canon_node['embedding'] = get_embedding(f"{canon_label} {canon_node['content']}")
                updated_nodes[canon_id] = canon_node
                merges_count += len([d for d in dups if d and isinstance(d, str) and d.strip()])

        # Redirect all edges in updated_nodes
        for node_id, n in updated_nodes.items():
            edges = n.get('relatedEdges', [])
            new_edges = []
            seen_edges = set()
            
            for edge in edges:
                source = edge.get('source')
                target = edge.get('target')
                
                if source in duplicate_to_canonical:
                    source = duplicate_to_canonical[source]
                if target in duplicate_to_canonical:
                    target = duplicate_to_canonical[target]
                    
                if not source or not target or source == target:
                    continue
                    
                edge_key = f"{source}-{target}-{edge.get('relation')}"
                if edge_key not in seen_edges:
                    edge['source'] = source
                    edge['target'] = target
                    new_edges.append(edge)
                    seen_edges.add(edge_key)
                    
            n['relatedEdges'] = new_edges
            updated_nodes[node_id] = n

        # 4. Create Meta-Concepts and link children
        for meta in meta_concepts:
            raw_meta_id = meta.get('id')
            if not raw_meta_id or not isinstance(raw_meta_id, str) or not raw_meta_id.strip():
                logger.warning(f"Skipping meta concept due to invalid ID: {meta}")
                continue
                
            meta_id = raw_meta_id.strip().replace(" ", "_")
            meta_label = meta.get('label') or meta_id
            meta_content = meta.get('content', '')
            child_ids = meta.get('child_ids', [])
            
            meta_edges = []
            for child_id in child_ids:
                if child_id and isinstance(child_id, str) and child_id.strip():
                    child_id = child_id.strip()
                    actual_child_id = duplicate_to_canonical.get(child_id, child_id)
                    if actual_child_id in updated_nodes or actual_child_id == meta_id:
                        if actual_child_id != meta_id:
                            meta_edges.append({
                                "source": meta_id,
                                "target": actual_child_id,
                                "relation": "קשור_ל",
                                "sentimentScore": 0,
                                "sourceQuotes": []
                            })
                        
            new_meta_node = {
                "id": meta_id,
                "label": meta_label,
                "type": "Concept",
                "val": 2,
                "content": meta_content,
                "relatedEdges": meta_edges,
                "embedding": get_embedding(f"{meta_label} {meta_content}")
            }
            updated_nodes[meta_id] = new_meta_node
            clusters_count += 1

        # 5. Write everything back to Firestore
        logger.info(f"Deleting {len(nodes_to_delete)} duplicate documents: {nodes_to_delete}")
        for dup_id in nodes_to_delete:
            if dup_id and isinstance(dup_id, str) and dup_id.strip():
                doc_id = dup_id.strip().replace('/', '%2F')
                logger.info(f"Attempting to delete document: '{doc_id}'")
                nodes_ref.document(doc_id).delete()
            
        logger.info(f"Updating/Creating {len(updated_nodes)} documents: {list(updated_nodes.keys())}")
        for node_id, n in updated_nodes.items():
            if node_id and isinstance(node_id, str) and node_id.strip():
                doc_id = node_id.strip().replace('/', '%2F')
                logger.info(f"Attempting to set document: '{doc_id}'")
                nodes_ref.document(doc_id).set(n)
            
        # 5. Temporal Decay
        now = datetime.datetime.now(datetime.timezone.utc)
        decayed_count = 0
        for n in nodes_data:
            node_id = n.get('id')
            if not node_id or node_id in nodes_to_delete:
                continue
                
            last_active = n.get('last_active')
            if not last_active:
                continue
                
            try:
                if hasattr(last_active, 'timestamp'):
                    last_dt = datetime.datetime.fromtimestamp(last_active.timestamp(), tz=datetime.timezone.utc)
                else:
                    last_dt = last_active
                    
                if isinstance(last_dt, datetime.datetime):
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=datetime.timezone.utc)
                    days_diff = (now - last_dt).days
                    if days_diff >= 7:
                        old_val = n.get('val', 2)
                        decay_amount = days_diff // 7
                        new_val = max(1, old_val - decay_amount)
                        if new_val < old_val:
                            nodes_ref.document(node_id).update({"val": new_val})
                            decayed_count += 1
            except Exception as e:
                logger.error(f"Failed to decay node {node_id}: {e}")

        return {
            "status": "success",
            "merges_count": merges_count,
            "meta_concepts_created": clusters_count,
            "decayed_nodes": decayed_count,
            "message": f"הושלמה אופטימיזציה בהצלחה: {merges_count} ישויות אוחדו, נוצרו {clusters_count} מושגי-על, ו-{decayed_count} צמתים דעכו בזמן."
        }
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Error in resolve_and_cluster_entities:\n{tb}")
        # Return the traceback in result to make it accessible to client
        return {"status": "error", "message": f"שגיאת שרת פנימית: {str(e)}", "traceback": tb}


@scheduler_fn.on_schedule(schedule="59 23 * * *")
def scheduled_sync_isa_data(event: scheduler_fn.ScheduledEvent) -> None:
    logger.info("Starting scheduled sync of ISA data...")
    isa_uid = "yxF7bHYMpWTayDjTfoYPEyfVTVd2"
    diary_uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1"
    
    url = f"https://firestore.googleapis.com/v1/projects/lifetracker-guy-2026/databases/(default)/documents/users/{isa_uid}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FirebaseFunction'})
        with urllib.request.urlopen(req) as response:
            html = response.read()
            doc_data = json.loads(html.decode('utf-8'))
            
            # Extract fields
            fields = doc_data.get('fields', {})
            life_tracker_data_field = fields.get('lifeTrackerData', {})
            
            parsed_data = {}
            map_val = life_tracker_data_field.get('mapValue', {})
            map_fields = map_val.get('fields', {})
            
            for date_key, date_val in map_fields.items():
                day_map = date_val.get('mapValue', {})
                day_fields = day_map.get('fields', {})
                
                day_dict = {}
                for param_key, param_val in day_fields.items():
                    if 'stringValue' in param_val:
                        day_dict[param_key] = param_val['stringValue']
                    elif 'integerValue' in param_val:
                        day_dict[param_key] = int(param_val['integerValue'])
                    elif 'doubleValue' in param_val:
                        day_dict[param_key] = float(param_val['doubleValue'])
                    elif 'booleanValue' in param_val:
                        day_dict[param_key] = param_val['booleanValue']
                    elif 'nullValue' in param_val:
                        day_dict[param_key] = None
                        
                parsed_data[date_key] = day_dict
            
            db = get_db()
            user_ref = db.collection('users').document(diary_uid)
            user_ref.set({"lifeTrackerData": parsed_data}, merge=True)
            
            logger.info(f"Successfully synchronized {len(parsed_data)} dates from ISA to Diary database.")
            
    except Exception as e:
        logger.error(f"Failed to synchronize ISA data: {e}")



