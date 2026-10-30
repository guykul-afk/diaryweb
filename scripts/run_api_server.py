"""
OKF Knowledge API - Local Runner Server
=======================================
Runs the API locally for testing, development, and local AI agent integrations.

Usage:
    python scripts/run_api_server.py [--port 5005] [--host 0.0.0.0]
"""

import os
import sys
import argparse

# Setup path so functions directory is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
functions_dir = os.path.join(root_dir, "functions")
if functions_dir not in sys.path:
    sys.path.insert(0, functions_dir)

# Load environment variables if available
def load_env_file(filepath):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

load_env_file(os.path.join(root_dir, ".env"))
load_env_file(os.path.join(functions_dir, ".env"))

from api import api_app, MASTER_API_KEY, DEFAULT_USER_UID

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run OKF AI API Server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 5005)), help="Port to listen on")
    parser.add_argument("--host", default="0.0.0.0", help="Host IP to bind")
    args = parser.parse_args()

    print("\n" + "="*70)
    print(" 🚀 OKF KNOWLEDGE AI API SERVER")
    print("="*70)
    print(f" * Listening on:         http://localhost:{args.port}")
    print(f" * Documentation UI:     http://localhost:{args.port}/api/docs")
    print(f" * OpenAPI 3.1 Spec:     http://localhost:{args.port}/api/v1/openapi.json")
    print(f" * MCP Tools Endpoint:   http://localhost:{args.port}/api/v1/mcp")
    print(f" * Target User UID:      {DEFAULT_USER_UID}")
    print(f" * Default API Key:      {MASTER_API_KEY}")
    print("="*70)
    print(" Ready for incoming AI connections (ChatGPT, Claude, LangChain, etc.)\n")

    api_app.run(host=args.host, port=args.port, debug=False)
