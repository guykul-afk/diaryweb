import os
import json
import logging
import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional

import google.generativeai as genai
from pydantic import BaseModel, Field

from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore

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

class GraphEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    relation: str = Field(..., description="Relationship label in Hebrew, e.g., 'קשור ל', 'מעורר', 'משפיע על'")
    sentimentScore: int = Field(..., description="Sentiment score of the relationship: -1 (negative/stressful), 0 (neutral), or 1 (positive/healing).")
    sourceQuotes: List[str] = Field(..., description="List of 1-2 direct quotes from the user's journal entries that prove this relationship.")

class GraphNode(BaseModel):
    id: str = Field(..., description="Unique node ID in English or Hebrew, lowercase or clean name, e.g., 'rationalization_defense' or 'חרדת_ביצוע'")
    label: str = Field(..., description="Node name/label in Hebrew, e.g., 'מנגנון הגנה: רציונליזציה'")
    type: str = Field(..., description="Node type, e.g., 'Insight', 'Trait', 'Pattern'")
    val: int = Field(..., description="Node value/weight, e.g. 2 or 3")
    content: str = Field(..., description="Detailed explanation/insight description in Hebrew")
    relatedEdges: List[GraphEdge] = Field(..., description="List of edges connected to this node")

class OrchestratorOutput(BaseModel):
    executive_summary: str = Field(..., description="Integrative summary merging the insights from the 5 agents, written in Hebrew, about 2-4 paragraphs.")
    metrics: Metrics
    new_nodes: List[GraphNode] = Field(..., description="New psychological insight nodes to add to the knowledge graph, linking them to relevant existing concepts.")

# =====================================================================
# Specialized System Prompts
# =====================================================================

CLINICAL_SYSTEM_PROMPT = """You are an expert Clinical Psychiatrist specialized in DSM-5 diagnostics and clinical formulation.
Your task is to analyze the user's personal journal entries and construct a clinical report.
Focus on:
1. Clinical Symptoms & Distress: Identify signs of mood fluctuations, anxiety, stress, or other psychological symptoms.
2. Behavioral and Sleep Patterns: Analyze sleep quality, fatigue, energy levels, and daily functioning indicators.
3. Mood & Affect: Map out the emotional tone, reactivity, and general affect state.
4. DSM-5 Dimensions: Reference relevant DSM-5 diagnostic frameworks (e.g., anxiety features, depressive symptoms, sleep-wake concerns, adjustment issues) without diagnosing, but pointing out patterns and severity indicators.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your analysis STRICTLY on the provided journal entries. If the provided text is short, your report should be concise. Do not make up information to fill the report.
- Quote directly from the text if needed, but only use actual words from the entries.

Format your output as a professional clinical assessment report, in Hebrew. Be insightful and empathetic, but strictly evidence-based."""

PSYCHODYNAMIC_SYSTEM_PROMPT = """You are an expert Psychodynamic Therapist trained in Jungian, Freudian, and Object Relations theories.
Your task is to analyze the user's personal journal entries and construct a psychodynamic formulation.
Focus on:
1. Defense Mechanisms: Identify active defenses (e.g., intellectualization, rationalization, projection, repression, reaction formation, displacement, splitting) and how they manifest.
2. Jungian Archetypes & Shadows: Detect archetypal themes (e.g., Shadow, Persona, Anima/Animus, Self, Hero, Wise Old Man) and the integration/expression of the unconscious.
3. Object Relations & Attachment: Map out the user's internal working models of self and others, attachment style indicators (secure, anxious, avoidant), and repeating relational patterns.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your analysis STRICTLY on the provided journal entries. If the provided text is short, your report should be concise. Do not make up information to fill the report.
- Quote directly from the text if needed, but only use actual words from the entries.

Format your output as a deep psychodynamic formulation, in Hebrew. Be insightful and empathetic, but strictly evidence-based."""

CBT_SYSTEM_PROMPT = """You are an expert Cognitive Behavioral Therapist (CBT) specializing in identifying cognitive schemas and distortions.
Your task is to analyze the user's personal journal entries and construct a CBT formulation.
Focus on:
1. Cognitive Distortions: Identify patterns of all-or-nothing thinking, catastrophizing, mind reading, emotional reasoning, overgeneralization, personalization, should statements, etc.
2. Core Beliefs & Intermediate Beliefs: Extract underlying core beliefs about the self, others, and the world.
3. CBT Triangle: Describe the interactions between typical situations, negative automatic Thoughts, corresponding Feelings (physical and emotional), and subsequent Behaviors.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your analysis STRICTLY on the provided journal entries. If the provided text is short, your report should be concise. Do not make up information to fill the report.
- Quote directly from the text if needed, but only use actual words from the entries.

Format your output as a structured CBT analysis, in Hebrew. Be insightful and empathetic, but strictly evidence-based."""

BEHAVIORAL_SYSTEM_PROMPT = """You are a Board Certified Behavior Analyst (BCBA) specialized in functional behavior analysis (FBA).
Your task is to analyze the user's personal journal entries and construct a behavioral report.
Focus on:
1. Functional Analysis (ABC): Identify Antecedents (triggers, environmental/internal contexts), Behaviors (observable or described actions, habits, avoidance patterns), and Consequences (what happens after, including reinforcers).
2. Maintaining Reinforcers: Distinguish between negative reinforcement (e.g., relief from anxiety, avoidance of task) and positive reinforcement (e.g., approval, control, distraction).
3. Skill Deficits & Behavioral Assets: Identify strengths and areas where coping skills could be introduced or reinforced.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your analysis STRICTLY on the provided journal entries. If the provided text is short, your report should be concise. Do not make up information to fill the report.
- Quote directly from the text if needed, but only use actual words from the entries.

Format your output as a structured behavioral assessment, in Hebrew. Be insightful and empathetic, but strictly evidence-based."""

HUMANISTIC_SYSTEM_PROMPT = """You are an expert Humanistic and Existentialist Therapist focusing on meaning, self-actualization, and ultimate concerns.
Your task is to analyze the user's journal entries and construct an existential-humanistic report.
Focus on:
1. Ultimate Concerns: Track how the user relates to meaning of life (vs. meaninglessness), freedom/agency (vs. deterministic constraint), isolation/loneliness (vs. connection), and mortality/finitude.
2. Self-Actualization & Authenticity: Assess the degree of authenticity in self-expression vs. social compliance/pleasing, and their progress towards self-actualization.
3. Unconditional Self-Regard: Analyze the level of self-acceptance, conditions of worth, and overall growth.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your analysis STRICTLY on the provided journal entries. If the provided text is short, your report should be concise. Do not make up information to fill the report.
- Quote directly from the text if needed, but only use actual words from the entries.

Format your output as a warm, humanistic, and existential analysis, in Hebrew. Be insightful and empathetic, but strictly evidence-based."""

ORCHESTRATOR_SYSTEM_PROMPT = """You are the Orchestrator agent of a psychological multi-agent system.
Your task is to integrate the findings from 5 specialized psychological agents (Clinical, Psychodynamic, CBT, Behavioral, Humanistic) and produce a cohesive executive summary and structured profile.

Here are your inputs:
1. The user's recent journal entries.
2. The individual reports written by the 5 specialized agents.
3. The names/labels of existing concepts/nodes in the user's knowledge graph.

Your output must be structured exactly as requested, containing:
1. An executive summary (integrative overview of the user's current psychological state, conflicts, coping mechanisms, and growth paths).
2. Metrics:
   - OCEAN profile (scores from 0 to 100).
   - Linguistic metrics (emotional density, self-focus, stress level, scores from 0 to 100).
3. A list of NEW psychological insight nodes to add to the knowledge graph.
   - For each new node, define an ID, label (Hebrew), type (Insight, Trait, Pattern, Defense, etc.), value/weight, and description (content in Hebrew).
   - Define relatedEdges to connect this new node to existing nodes or other new nodes. In relatedEdges, specify source, target, the relation, sentimentScore (-1 to 1), and sourceQuotes (actual quotes from text). Ensure you link the insights to the existing graph concepts where appropriate.

CRITICAL RULES:
- DO NOT invent, hallucinate, or fabricate any quotes, entries, or events that the user did not explicitly write.
- Base your executive summary STRICTLY on the provided journal entries and agent reports. 
- Quote directly from the text if needed, but only use actual words from the entries.

Write all summaries, node labels, and descriptions in HEBREW.
"""

# =====================================================================
# API Execution Helpers
# =====================================================================

def run_agent(agent_name: str, system_prompt: str, prompt_content: str) -> str:
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
        response = model.generate_content(
            prompt_content,
            generation_config=genai.GenerationConfig(
                temperature=0.2  # Lower temperature to prevent hallucination
            )
        )
        return response.text
    except Exception as e:
        logger.error(f"Error running agent {agent_name}: {e}")
        return f"שגיאה בניתוח סוכן {agent_name}: {str(e)}"

# =====================================================================
# Cloud Function Definition
# =====================================================================

@https_fn.on_call(timeout_sec=120)
def analyze_personality(req: https_fn.CallableRequest) -> dict:
    """
    Firebase Cloud Function Gen 2 callable to analyze personality using Multi-Agent System.
    """
    # 1. Resolve UID
    uid = req.data.get('uid')
    if not uid:
        if req.auth:
            uid = req.auth.uid
        else:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="The function must be called with a user ID ('uid')."
            )

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
            # Try to parse string
            return datetime.datetime.fromisoformat(str(ts).replace('Z', '+00:00')).timestamp()
        except:
            return 0

    entries = sorted(entries, key=get_timestamp_val)

    # 4. Fetch Existing Graph Nodes (OKF)
    graph_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
    graph_snapshot = graph_ref.stream()
    existing_nodes = []
    for doc in graph_snapshot:
        data = doc.to_dict()
        node_id = data.get('id') or doc.id
        label = data.get('label') or node_id
        existing_nodes.append({"id": node_id, "label": label})

    existing_nodes_context = "\n".join([f"- {n['id']} (Label: {n['label']})" for n in existing_nodes])

    # 5. Fetch Previous Analysis to decide if it's baseline or delta
    analysis_ref = get_db().collection('users').document(uid).collection('personality_analysis')
    prev_analysis_query = analysis_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(1).stream()
    prev_analyses = list(prev_analysis_query)
    
    is_full = req.data.get('is_full', False)
    is_delta = len(prev_analyses) > 0 and new_entries_since_last > 0 and not is_full
    prev_analysis = prev_analyses[0].to_dict() if prev_analyses else None

    # Filter target entries depending on run type
    if is_delta and prev_analysis:
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
        # Fallback if filtering returns nothing but we have new entries counter
        if not target_entries:
            target_entries = entries[-max(1, new_entries_since_last):]
    else:
        target_entries = entries

    logger.info(f"Running {'delta' if is_delta else 'baseline'} analysis on {len(target_entries)} entries.")

    # 6. Format prompt context for the agents
    prompt_context = ""
    if is_delta and prev_analysis:
        prompt_context += "=== PREVIOUS PERSONALITY ANALYSIS EXECUTIVE SUMMARY ===\n"
        prompt_context += f"{prev_analysis.get('executive_summary', '')}\n\n"
        prompt_context += "=== PREVIOUS REPORTS ===\n"
        for k, v in prev_analysis.get('reports', {}).items():
            prompt_context += f"Agent {k}: {v[:300]}...\n" # Brief snippet of previous reports
        prompt_context += "\n=== NEW JOURNAL ENTRIES SINCE LAST ANALYSIS ===\n"
    else:
        prompt_context += "=== ALL JOURNAL ENTRIES ===\n"

    for entry in target_entries:
        date_str = entry.get('date') or str(entry.get('timestamp'))
        topics = ", ".join(entry.get('topics', []))
        content = entry.get('content') or entry.get('transcript') or ""
        prompt_context += f"Date: {date_str}\nTopics: {topics}\nContent: {content}\n---\n"

    # 7. Execute individual agents in parallel
    agents_to_run = {
        "clinical": CLINICAL_SYSTEM_PROMPT,
        "psychodynamic": PSYCHODYNAMIC_SYSTEM_PROMPT,
        "cbt": CBT_SYSTEM_PROMPT,
        "behavioral": BEHAVIORAL_SYSTEM_PROMPT,
        "humanistic": HUMANISTIC_SYSTEM_PROMPT
    }

    agent_reports = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(run_agent, name, sys_prompt, prompt_context): name
            for name, sys_prompt in agents_to_run.items()
        }
        for future in futures:
            name = futures[future]
            try:
                agent_reports[name] = future.result()
            except Exception as e:
                logger.error(f"Thread execution failed for {name}: {e}")
                agent_reports[name] = f"שגיאה בהפעלת סוכן: {str(e)}"

    # 8. Run the Orchestrator
    try:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is not configured.")
        
        genai.configure(api_key=api_key)
        orchestrator_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=ORCHESTRATOR_SYSTEM_PROMPT
        )
        
        orchestrator_prompt = f"""
=== USER ENTRIES ===
{prompt_context}

=== SPECIALIZED AGENT REPORTS ===
{json.dumps(agent_reports, ensure_ascii=False, indent=2)}

=== EXISTING GRAPH NODES ===
{existing_nodes_context}
"""
        orchestrator_response = orchestrator_model.generate_content(
            orchestrator_prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=OrchestratorOutput,
                temperature=0.2  # Lower temperature to prevent hallucination
            )
        )
        
        orchestrator_output = OrchestratorOutput.model_validate_json(orchestrator_response.text)
    except Exception as e:
        logger.error(f"Error during orchestrator phase: {e}")
        # Build a raw/mock structure in case of orchestrator schema validation failure
        orchestrator_output = OrchestratorOutput(
            executive_summary="שגיאה בעיבוד האינטגרטיבי של הסוכנים. מוצג דוח משולב בסיסי.",
            metrics=Metrics(
                ocean=OceanMetrics(o=50, c=50, e=50, a=50, n=50),
                linguistic=LinguisticMetrics(emotional_density=50, self_focus=50, stress_level=50)
            ),
            new_nodes=[]
        )

    # 9. Persist Personality Analysis Document
    analysis_doc_id = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    analysis_payload = {
        "timestamp": firestore.SERVER_TIMESTAMP,
        "executive_summary": orchestrator_output.executive_summary,
        "reports": agent_reports,
        "metrics": orchestrator_output.metrics.model_dump(),
        "new_entries_since_last_analysis": 0
    }
    
    analysis_ref.document(analysis_doc_id).set(analysis_payload)

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
            
        node_ref.set({
            "id": node_doc_id,
            "label": node.label,
            "type": node.type,
            "val": node.val,
            "content": node.content,
            "relatedEdges": edges_list
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
    uid = req.data.get('uid')
    if not uid and req.auth:
        uid = req.auth.uid
    if not uid:
        return {"status": "error", "message": "Missing UID"}
        
    query = req.data.get('query', 'אנא נתח את הגרף שלי ומצא קשרים חסרים, קונפליקטים ותבניות מעניינות.')

    logger.info(f"Detective agent analyzing graph for {uid} with query: {query}")

    # Fetch nodes
    nodes_ref = get_db().collection('users').document(uid).collection('knowledge_graph_nodes')
    nodes_snapshot = nodes_ref.stream()
    
    graph_data = []
    for doc in nodes_snapshot:
        data = doc.to_dict()
        node_id = data.get('id', doc.id)
        label = data.get('label', node_id)
        edges = data.get('relatedEdges', [])
        edges_str = ", ".join([f"[{e.get('relation')}] to {e.get('target')} (Sentiment: {e.get('sentimentScore', 0)})" for e in edges])
        graph_data.append(f"Node: {label} (Type: {data.get('type', '')})\n  Connections: {edges_str if edges_str else 'None'}")
        
    graph_context = "\n".join(graph_data)
    
    prompt = f"User Query: {query}\n\nGraph Data:\n{graph_context}"
    
    response = run_agent("Detective", DETECTIVE_SYSTEM_PROMPT, prompt)
    
    return {
        "status": "success",
        "result": response
    }
