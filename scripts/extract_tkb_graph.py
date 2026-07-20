import os
import json
import re
import yaml

import google.generativeai as genai
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

TKB_DIR = os.path.join(os.path.dirname(__file__), "..", "functions", "okf", "tkb")
API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("FIREBASE_API_KEY")

if not API_KEY:
    print("Warning: GEMINI_API_KEY or FIREBASE_API_KEY not found in environment.")
else:
    genai.configure(api_key=API_KEY)

class ExtractedNode(BaseModel):
    id: str = Field(..., description="Unique node ID (clean name, lowercase english or hebrew)")
    label: str = Field(..., description="Display label (1-3 words)")
    type: str = Field(..., description="One of: 'TheoryConcept', 'Technique', 'Question', 'Quote', 'Domain', 'Pattern', 'Thinker'")
    content: str = Field(..., description="Detailed content or explanation")

class ExtractedEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    relation: str = Field(..., description="One of: 'מגדיר', 'מציע', 'שואל', 'ממחיש', 'חלק_מ', 'קשור_ל'")

class ExtractionResult(BaseModel):
    nodes: list[ExtractedNode]
    edges: list[ExtractedEdge]

def parse_frontmatter(content: str):
    fm_match = re.search(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
    if not fm_match:
        return {}, content
    try:
        fm = yaml.safe_load(fm_match.group(1))
    except:
        fm = {}
    return fm, fm_match.group(2)

def extract_from_file(file_path: str):
    filename = os.path.basename(file_path)
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    fm, body = parse_frontmatter(content)
    
    file_id = filename.replace(".md", "")
    title = fm.get("title", file_id)
    
    root_node = {
        "id": file_id,
        "label": title,
        "type": fm.get("type", "Concept"),
        "content": body[:200] + "..." if len(body) > 200 else body
    }
    
    local_graph = {"nodes": [root_node], "edges": []}
    
    domains = fm.get("domain", [])
    if isinstance(domains, str): domains = [domains]
    for d in domains:
        local_graph["edges"].append({"source": file_id, "target": d, "relation": "שייך_ל"})
        
    patterns = fm.get("maps_to_patterns", [])
    if isinstance(patterns, str): patterns = [patterns]
    for p in patterns:
        local_graph["edges"].append({"source": file_id, "target": p, "relation": "קשור_ל"})
        
    counterpart = fm.get("counterpart", "")
    if counterpart:
        cp_id = counterpart.replace(".md", "")
        local_graph["edges"].append({"source": file_id, "target": cp_id, "relation": "דומה_ל"})

    if not API_KEY:
        return local_graph

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"""
        Analyze the following psychological/philosophical document.
        Extract the key TheoryConcepts, Techniques, Questions, and Quotes as nodes.
        Extract edges connecting them (e.g., this Thinker 'מציע' this Technique, this Technique 'ממחיש' this Concept).
        Use relationships like 'מגדיר', 'מציע', 'שואל', 'ממחיש', 'קשור_ל'.
        All extracted node IDs must be unique strings. Connect them to the root node ID '{file_id}'.
        
        Document Content:
        {body}
        """
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=ExtractionResult
            )
        )
        
        extracted = json.loads(response.text)
        local_graph["nodes"].extend(extracted.get("nodes", []))
        local_graph["edges"].extend(extracted.get("edges", []))
    except Exception as e:
        print(f"Failed to run LLM extraction on {filename}: {e}")

    return local_graph

def main():
    if not os.path.exists(TKB_DIR):
        print(f"Directory {TKB_DIR} not found.")
        return

    files = [os.path.join(TKB_DIR, f) for f in os.listdir(TKB_DIR) if f.endswith(".md")]
    print(f"Starting extraction on {len(files)} files...")
    
    global_graph = {"nodes": [], "edges": []}
    
    for file in files:
        print(f"Processing {os.path.basename(file)}...")
        g = extract_from_file(file)
        global_graph["nodes"].extend(g["nodes"])
        global_graph["edges"].extend(g["edges"])

    out_path = os.path.join(os.path.dirname(__file__), "..", "tkb_graph.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(global_graph, f, ensure_ascii=False, indent=2)
    
    print(f"Extracted {len(global_graph['nodes'])} nodes and {len(global_graph['edges'])} edges.")

if __name__ == "__main__":
    main()
