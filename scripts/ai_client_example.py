"""
OKF Knowledge Viewer - AI Client Example
========================================
Demonstrates how an external AI application (Claude, GPT, LangChain, or custom script)
connects to the OKF Knowledge API, analyzes personal data, and submits findings.

Usage:
    python scripts/ai_client_example.py [--url http://localhost:5005] [--key <YOUR_KEY>]
"""

import sys
import json
import argparse
import requests

DEFAULT_URL = "http://localhost:5005"
DEFAULT_KEY = "okf-ai-default-secret-key-2026"

def run_demo(base_url: str, api_key: str):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    print("\n" + "="*70)
    print(" 🤖 OKF AI CLIENT DEMO")
    print("="*70)
    print(f"Connecting to: {base_url}")
    print(f"API Key:       {api_key[:10]}...")

    # 1. Ping
    print("\n[Step 1] Checking API Status (Ping)...")
    try:
        res = requests.get(f"{base_url}/api/v1/ping", headers=headers, timeout=10)
        print("Status code:", res.status_code)
        print("Response:", json.dumps(res.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Failed to connect to API at {base_url}: {e}")
        return

    # 2. Search Entries
    print("\n[Step 2] Searching Journal Entries on topic 'ספורט' or 'ריצה'...")
    try:
        res = requests.get(f"{base_url}/api/v1/entries?query=ספורט&limit=3", headers=headers, timeout=10)
        data = res.json()
        print(f"Found {data.get('total', 0)} matching entries.")
        for item in data.get("entries", []):
            print(f"- ID: {item['id']} | Mood: {item.get('mood')} | Topics: {item.get('topics')}")
            print(f"  Content Preview: {item.get('content', '')[:120]}...\n")
    except Exception as e:
        print(f"Error querying entries: {e}")

    # 3. Query Knowledge Graph
    print("\n[Step 3] Querying Subgraph around 'זוגיות' / 'משפחה'...")
    try:
        res = requests.get(f"{base_url}/api/v1/graph/subgraph?query=זוגיות&hops=1", headers=headers, timeout=10)
        if res.status_code == 200:
            gdata = res.json()
            print(f"Sub-graph center: {gdata.get('center_node')}")
            print(f"Nodes found: {gdata.get('nodes_count')} | Edges found: {gdata.get('edges_count')}")
            for edge in gdata.get("edges", [])[:5]:
                print(f"  Relation: {edge['source']} --[{edge['relation']}]--> {edge['target']}")
        else:
            print(f"Subgraph query status: {res.status_code} ({res.text})")
    except Exception as e:
        print(f"Error querying graph: {e}")

    # 4. RAG Context Packing for LLM
    print("\n[Step 4] Requesting Pre-Synthesized RAG Context for LLM...")
    try:
        query_payload = {
            "query": "מה הדפוסים שלי סביב יעדי כושר ובריאות?",
            "top_k_entries": 3,
            "include_graph": True,
            "include_health": True
        }
        res = requests.post(f"{base_url}/api/v1/query", headers=headers, json=query_payload, timeout=15)
        rag_data = res.json()
        print("Ready Markdown Context for LLM Prompt:\n")
        print(rag_data.get("ready_llm_context", "No context returned"))
    except Exception as e:
        print(f"Error retrieving RAG context: {e}")

    # 5. Submit AI Analysis back
    print("\n[Step 5] Submitting External AI Findings Back to Knowledge Vault...")
    try:
        analysis_payload = {
            "title": "ניתוח מוטיבציה בריאותית ויעדים אישיים",
            "summary": "הניתוח מצביע על מוטיבציה גבוהה סביב תחרויות ריצה ויעדי משקל, עם צורך בשמירה על שגרה קבועה.",
            "patterns_detected": ["הצבת יעדים מאתגרים", "מיקוד בכושר וריצה"],
            "action_recommendations": [
                "תזמון שלוש ריצות קבועות בשבוע (רגילה, זון 2, ומתגברת)",
                "מעקב אחר מדדי דופק מנוחה לאחר אימונים"
            ],
            "source_agent": "PythonDemoAgent-v1",
            "tags": ["בריאות", "כושר", "יעדים"]
        }
        res = requests.post(f"{base_url}/api/v1/analyze", headers=headers, json=analysis_payload, timeout=15)
        print("Status code:", res.status_code)
        print("Saved Analysis Record:", json.dumps(res.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error submitting analysis: {e}")

    print("\n" + "="*70)
    print(" ✅ DEMO COMPLETE")
    print("="*70 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test OKF AI Client")
    parser.add_argument("--url", default=DEFAULT_URL, help="Base API URL")
    parser.add_argument("--key", default=DEFAULT_KEY, help="API Key")
    args = parser.parse_args()
    run_demo(args.url, args.key)
