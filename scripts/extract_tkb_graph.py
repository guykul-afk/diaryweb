# extract_tkb_graph.py
import os
import json
import re

TKB_DIR = os.path.join(os.path.dirname(__file__), "..", "functions", "okf", "tkb")

def main():
    graph = {"nodes": [], "edges": []}
    for file in os.listdir(TKB_DIR):
        if not file.endswith(".md"): continue
        with open(os.path.join(TKB_DIR, file), "r", encoding="utf-8") as f:
            content = f.read()
            # In a real scenario, we'd run an LLM to extract TheoryConcept, Technique, Question, Quote
            # and edges: מגדיר, מציע, שואל, ממחיש
            pass
    
    with open("tkb_graph.json", "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
