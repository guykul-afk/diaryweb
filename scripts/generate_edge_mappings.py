import os
import json
import time
import google.generativeai as genai

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Ensure API Key is configured
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    for env_path in [".env", "functions/.env"]:
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if "GEMINI_API_KEY" in line or "GOOGLE_API_KEY" in line:
                        parts = line.strip().split("=")
                        if len(parts) >= 2:
                            api_key = parts[1].strip().strip('"').strip("'")
                            break
                if api_key:
                    break
if api_key:
    genai.configure(api_key=api_key)
else:
    print("Warning: Gemini API Key not found. The script might fail.")

CANONICAL_RELATIONS = [
    'חלק_מ', 'סותר', 'מתועד_ב', 'דומה_ל', 'קשור_ל', 'שואף_ל', 'שייך_ל', 'חווה', 'מפעיל', 'משפיע_על', 'מחזק', 'מחליש'
]

def load_relations():
    if not os.path.exists("graph_backup.json"):
        print("graph_backup.json not found.")
        return []
    with open("graph_backup.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    relations = set()
    for node in data:
        for edge in node.get("relatedEdges", []):
            rel = edge.get("relation")
            if rel:
                relations.add(rel.strip())
    return sorted(list(relations))

def get_mappings_from_gemini_with_retry(relations_to_map, retries=3):
    prompt = f"""
You are a linguistic ontology assistant. You are given a list of Hebrew relations extracted from a personal journal database.
You must map each of these Hebrew relations to exactly ONE of the following 12 canonical Hebrew relations:
{", ".join(CANONICAL_RELATIONS)}

Rules for mapping:
1. 'חלק_מ' (part of)
2. 'סותר' (contradicts)
3. 'מתועד_ב' (documented in)
4. 'דומה_ל' (similar to)
5. 'קשור_ל' (related to)
6. 'שואף_ל' (aspires to)
7. 'שייך_ל' (belongs to / is part of a domain)
8. 'חווה' (experiences)
9. 'מפעיל' (triggers)
10. 'משפיע_על' (influences)
11. 'מחזק' (strengthens)
12. 'מחליש' (weakens)

Input relations to map:
{json.dumps(relations_to_map, ensure_ascii=False, indent=2)}

Output format:
Return ONLY a valid JSON object of mapping where keys are the input relations and values are their mapped canonical relations from the list above. No explanation, no extra text.
"""
    model = genai.GenerativeModel("gemini-2.5-flash")
    for attempt in range(retries):
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            # Try parsing the json text
            return json.loads(response.text)
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            time.sleep(2)
    return {}

def main():
    relations = load_relations()
    if not relations:
        return
        
    print(f"Loaded {len(relations)} unique relations from graph_backup.json")
    
    # Load existing mappings if available
    mappings = {}
    if os.path.exists("scripts/edges_to_map.json"):
        try:
            with open("scripts/edges_to_map.json", "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                mappings = existing_data.get("mappings", {})
                print(f"Loaded {len(mappings)} existing mappings from scripts/edges_to_map.json")
        except Exception as e:
            print(f"Error loading existing mappings: {e}")
            
    # Self mappings for canonical relations
    for rel in CANONICAL_RELATIONS:
        mappings[rel] = rel
        
    # Filter to only relations we need to map (non-canonical AND not already mapped)
    to_map = [r for r in relations if r not in mappings]
    print(f"Need to map {len(to_map)} remaining non-canonical relations using Gemini API...")
    
    if to_map:
        batch_size = 100
        for i in range(0, len(to_map), batch_size):
            batch = to_map[i:i+batch_size]
            print(f"Processing batch {i//batch_size + 1}/{(len(to_map)-1)//batch_size + 1} (size: {len(batch)})...")
            
            batch_mappings = get_mappings_from_gemini_with_retry(batch)
            
            if "relation_mappings" in batch_mappings:
                flat_mappings = batch_mappings["relation_mappings"]
            else:
                flat_mappings = batch_mappings
                
            for k, v in flat_mappings.items():
                if v in CANONICAL_RELATIONS:
                    mappings[k] = v
                    
            time.sleep(1)
            
    # Double check if any relations are still unmapped, set them to default
    unmapped_count = 0
    for r in relations:
        if r not in mappings:
            mappings[r] = "קשור_ל"
            unmapped_count += 1
            
    if unmapped_count > 0:
        print(f"Warning: {unmapped_count} relations were not mapped by Gemini and fell back to default 'קשור_ל'")
        
    output_data = {
        "mappings": mappings,
        "metadata": {
            "total_unique_types_found": len(relations),
            "total_mapped_types": len(mappings),
            "fallback_type": "קשור_ל"
        }
    }
    
    with open("scripts/edges_to_map.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully mapped all edges and updated scripts/edges_to_map.json. Total mapped: {len(mappings)}")

if __name__ == "__main__":
    main()
