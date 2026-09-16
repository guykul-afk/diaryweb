import os
import json
import time
from typing import List, Dict, Any
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load env variables from functions directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'functions', '.env'))



# ==========================================
# 1. OKF Ontology Definitions
# ==========================================
OKF_NODE_TYPES = [
    "Domain", "Person", "Goal", "Pattern", 
    "Strategy", "Emotion", "Event", "Insight"
]

OKF_EDGE_TYPES = [
    "חלק_מ", "סותר", "מתועד_ב", "דומה_ל", 
    "קשור_ל", "שואף_ל", "שייך_ל", "חווה", 
    "מפעיל", "משפיע_על", "מחזק", "מחליש"
]

# ==========================================
# 2. Pydantic Schemas for AI Mapping
# ==========================================
class RelationMapping(BaseModel):
    original_relation: str
    mapped_relation: str = Field(description=f"Must be one of: {', '.join(OKF_EDGE_TYPES)}")

class RelationBatchOutput(BaseModel):
    mappings: List[RelationMapping]

class NodeClassification(BaseModel):
    node_id: str
    node_type: str = Field(description=f"Must be one of: {', '.join(OKF_NODE_TYPES)}")

class NodeBatchOutput(BaseModel):
    classifications: List[NodeClassification]

# ==========================================
# 3. AI Processing Functions
# ==========================================
def get_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Please set GEMINI_API_KEY environment variable.")
    return genai.Client(api_key=api_key)

def map_relations_batch(client: genai.Client, relations: List[str]) -> Dict[str, str]:
    if not relations:
        return {}
    
    prompt = f"""
    You are an expert Ontologist mapping legacy free-text relationship edges to a strict canonical ontology in Hebrew.
    
    Map the following list of raw relations to the most appropriate canonical edge type.
    
    Raw relations to map:
    {json.dumps(relations, ensure_ascii=False)}
    
    Canonical Edge Types (CHOOSE ONLY FROM THESE):
    {json.dumps(OKF_EDGE_TYPES, ensure_ascii=False)}
    
    If a relation is completely meaningless, map it to 'קשור_ל'.
    """
    
    print(f"Calling Gemini to map {len(relations)} relations...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RelationBatchOutput,
            temperature=0.1
        )
    )
    
    try:
        output = RelationBatchOutput.model_validate_json(response.text)
        return {m.original_relation: m.mapped_relation for m in output.mappings}
    except Exception as e:
        print(f"Error parsing relation mappings: {e}")
        return {}

def classify_nodes_batch(client: genai.Client, nodes_info: List[dict]) -> Dict[str, str]:
    if not nodes_info:
        return {}
        
    prompt = f"""
    You are an expert Ontologist classifying psychological and personal knowledge graph nodes.
    
    Classify the following list of nodes into one of the strict canonical node types.
    
    Nodes to classify (id and label):
    {json.dumps(nodes_info, ensure_ascii=False)}
    
    Canonical Node Types (CHOOSE ONLY FROM THESE):
    {json.dumps(OKF_NODE_TYPES, ensure_ascii=False)}
    
    Examples:
    - 'חרדה', 'שמחה' -> Emotion
    - 'גיא', 'אמא' -> Person
    - 'עבודה', 'בריאות' -> Domain
    - 'לרדת במשקל' -> Goal
    - 'פרפקציוניזם', 'דחיינות' -> Pattern
    - 'מדיטציה', 'טיפול' -> Strategy
    - 'תאונה', 'פגישה' -> Event
    - 'הבנתי ש...' -> Insight
    """
    
    print(f"Calling Gemini to classify {len(nodes_info)} nodes...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=NodeBatchOutput,
            temperature=0.1
        )
    )
    
    try:
        output = NodeBatchOutput.model_validate_json(response.text)
        return {m.node_id: m.node_type for m in output.classifications}
    except Exception as e:
        print(f"Error parsing node classifications: {e}")
        return {}

# ==========================================
# 4. Main Normalization Flow
# ==========================================
def run_normalization():
    # We will read from the latest backup or export to be safe before writing to Firestore.
    input_file = "../graph_backup.json"
    output_file = "../graphify-out/normalized_graph_v2.json"
    
    if not os.path.exists(input_file):
        print(f"Error: Could not find {input_file}")
        return
        
    print("Loading graph data...")
    with open(input_file, 'r', encoding='utf-8') as f:
        nodes = json.load(f)
        
    print(f"Loaded {len(nodes)} nodes.")
    
    # 1. Gather all unique invalid relations
    unique_invalid_relations = set()
    unknown_nodes = []
    
    for node in nodes:
        # Check edges
        edges = node.get("relatedEdges", [])
        for edge in edges:
            rel = edge.get("relation")
            if rel and rel not in OKF_EDGE_TYPES:
                unique_invalid_relations.add(rel)
                
        # Check node type
        n_type = node.get("type", "Unknown")
        if n_type not in OKF_NODE_TYPES:
            unknown_nodes.append({"id": node.get("id"), "label": node.get("label", node.get("id"))})
            
    print(f"Found {len(unique_invalid_relations)} unique invalid relations to map.")
    print(f"Found {len(unknown_nodes)} nodes with unknown/invalid types to classify.")
    
    client = get_gemini_client()
    
    # 2. Map Relations (in batches of 100)
    relation_map = {}
    invalid_rels_list = list(unique_invalid_relations)
    batch_size = 100
    
    for i in range(0, len(invalid_rels_list), batch_size):
        batch = invalid_rels_list[i:i+batch_size]
        mapped = map_relations_batch(client, batch)
        relation_map.update(mapped)
        time.sleep(2) # rate limit protection
        
    # 3. Map Nodes (in batches of 50)
    node_type_map = {}
    batch_size_nodes = 50
    
    for i in range(0, len(unknown_nodes), batch_size_nodes):
        batch = unknown_nodes[i:i+batch_size_nodes]
        mapped = classify_nodes_batch(client, batch)
        node_type_map.update(mapped)
        time.sleep(2)
        
    # 4. Apply Mappings
    print("\nApplying mappings to data...")
    for node in nodes:
        # Update Node Type
        if node.get("id") in node_type_map:
            mapped_type = node_type_map[node["id"]]
            if mapped_type in OKF_NODE_TYPES:
                node["type"] = mapped_type
            
        # Update Edges
        valid_edges = []
        for edge in node.get("relatedEdges", []):
            rel = edge.get("relation")
            if rel in OKF_EDGE_TYPES:
                valid_edges.append(edge)
            elif rel in relation_map:
                mapped_rel = relation_map[rel]
                if mapped_rel in OKF_EDGE_TYPES:
                    edge["relation"] = mapped_rel
                    valid_edges.append(edge)
            else:
                # Fallback
                edge["relation"] = "קשור_ל"
                valid_edges.append(edge)
                
        node["relatedEdges"] = valid_edges
        
    # 5. Save Output
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)
        
    print(f"\nSuccess! Normalized graph saved to {output_file}")
    print("You can review this file. Once approved, we can write a script to upload it to Firestore.")

if __name__ == "__main__":
    run_normalization()
