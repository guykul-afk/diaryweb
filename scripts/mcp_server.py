"""
OKF Model Context Protocol (MCP) Server
=======================================
Allows Anthropic Claude Desktop and Cursor to natively query the OKF Knowledge Base
via standard MCP (JSON-RPC over stdin/stdout).

Configuration for Claude Desktop (claude_desktop_config.json):
{
  "mcpServers": {
    "okf-knowledge": {
      "command": "python",
      "args": ["c:/Users/User/okf_knowledge_viewer/scripts/mcp_server.py"],
      "env": {
        "OKF_API_URL": "http://localhost:5005",
        "OKF_API_KEY": "okf-ai-default-secret-key-2026"
      }
    }
  }
}
"""

import sys
import os
import json
import urllib.request
import urllib.error

API_URL = os.environ.get("OKF_API_URL", "http://localhost:5005").rstrip("/")
API_KEY = os.environ.get("OKF_API_KEY", "okf-ai-default-secret-key-2026")

def call_api(path: str, method: str = "GET", payload: dict = None):
    url = f"{API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return {"error": f"HTTP {e.code}", "details": err_msg}
    except Exception as e:
        return {"error": str(e)}

TOOLS = [
    {
        "name": "search_journal_entries",
        "description": "Search personal journal entries by topic, mood, or free-text query.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Text search query"},
                "mood": {"type": "string", "description": "Filter by emotional state"},
                "limit": {"type": "integer", "default": 5}
            }
        }
    },
    {
        "name": "query_knowledge_graph",
        "description": "Extract connected psychological entities, domains, and patterns centered around a topic.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "concept": {"type": "string", "description": "Target entity or topic (e.g., 'משפחה', 'עבודה', 'חרדה')"},
                "hops": {"type": "integer", "default": 1}
            },
            "required": ["concept"]
        }
    },
    {
        "name": "get_rag_context",
        "description": "Gathers relevant journal entries, knowledge graph connections, and health metrics into an LLM-ready context block.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language question about the user's life or mindset"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "record_ai_analysis",
        "description": "Record an AI-generated analysis, insight, or action recommendation into the user's permanent vault.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Headline of the analysis"},
                "summary": {"type": "string", "description": "Summary of findings"},
                "patterns_detected": {"type": "array", "items": {"type": "string"}},
                "action_recommendations": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["title", "summary"]
        }
    }
]

def handle_tool_call(name: str, args: dict):
    if name == "search_journal_entries":
        query = args.get("query", "")
        limit = args.get("limit", 5)
        path = f"/api/v1/entries?query={urllib.parse.quote(query)}&limit={limit}"
        return call_api(path)
    elif name == "query_knowledge_graph":
        concept = args.get("concept", "")
        hops = args.get("hops", 1)
        path = f"/api/v1/graph/subgraph?query={urllib.parse.quote(concept)}&hops={hops}"
        return call_api(path)
    elif name == "get_rag_context":
        return call_api("/api/v1/query", method="POST", payload={"query": args.get("query", "")})
    elif name == "record_ai_analysis":
        return call_api("/api/v1/analyze", method="POST", payload=args)
    else:
        return {"error": f"Unknown tool: {name}"}

def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")

            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {"name": "okf-knowledge-mcp", "version": "1.0.0"},
                        "capabilities": {"tools": {}}
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"tools": TOOLS}
                }
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name")
                args = params.get("arguments", {})
                tool_output = handle_tool_call(name, args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {"type": "text", "text": json.dumps(tool_output, indent=2, ensure_ascii=False)}
                        ]
                    }
                }
            else:
                res = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}

            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error handling MCP line: {e}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()
