"""
OKF Knowledge API - Key Management Utility
==========================================
Generate, list, and revoke API keys for external AI systems.

Usage:
    python scripts/manage_api_keys.py create --name "Claude Project"
    python scripts/manage_api_keys.py list
    python scripts/manage_api_keys.py revoke --key <api_key>
"""

import sys
import os
import argparse
import secrets
import datetime

# Ensure project and functions directories are in path
workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(workspace_dir, "functions"))

try:
    import firebase_admin
    from firebase_admin import firestore
except ImportError:
    print("Error: firebase_admin is required. Run 'pip install firebase-admin'")
    sys.exit(1)

def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()

def create_api_key(name: str, uid: str = None, permissions: list = None):
    # Format: okf_live_<random_hex>
    key = f"okf_live_{secrets.token_hex(24)}"
    if permissions is None:
        permissions = ["read", "write", "analyze"]
        
    doc_data = {
        "name": name,
        "active": True,
        "permissions": permissions,
        "created_at": firestore.SERVER_TIMESTAMP,
        "uid": uid or os.environ.get("USER_UID", "K9j4Nx0WK7NKYJs6iDUz35LXFai1")
    }
    
    try:
        db = get_db()
        db.collection("api_keys").document(key).set(doc_data)
        print("\n" + "="*60)
        print(" SUCCESS: API Key Created!")
        print("="*60)
        print(f"Name:        {name}")
        print(f"API Key:     {key}")
        print(f"Target UID:  {doc_data['uid']}")
        print(f"Permissions: {', '.join(permissions)}")
        print("\nKeep this key safe! Give this key to your external AI system.")
        print("="*60 + "\n")
        return key
    except Exception as e:
        print(f"Error creating API key in Firestore: {e}")
        print(f"Fallback: You can use the master key in functions/.env: OKF_API_KEY={key}")
        return key

def list_api_keys():
    try:
        db = get_db()
        docs = list(db.collection("api_keys").stream())
        print("\n" + "="*70)
        print(f" ACTIVE API KEYS ({len(docs)} registered)")
        print("="*70)
        if not docs:
            print("No keys found in Firestore collection 'api_keys'.")
            print("Note: Master key in environment is also active.")
        for d in docs:
            data = d.to_dict()
            status = "ACTIVE" if data.get("active", True) else "REVOKED"
            print(f"- Key: {d.id[:16]}... [{status}]")
            print(f"  Name: {data.get('name')} | Permissions: {data.get('permissions')} | UID: {data.get('uid')}")
        print("="*70 + "\n")
    except Exception as e:
        print(f"Error listing API keys: {e}")

def revoke_api_key(key: str):
    try:
        db = get_db()
        doc_ref = db.collection("api_keys").document(key)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"Key '{key}' not found.")
            return
        doc_ref.update({"active": False, "revoked_at": firestore.SERVER_TIMESTAMP})
        print(f"SUCCESS: Key '{key}' has been revoked.")
    except Exception as e:
        print(f"Error revoking API key: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage OKF API Keys")
    subparsers = parser.add_subparsers(dest="command")

    create_parser = subparsers.add_parser("create", help="Create a new API key")
    create_parser.add_argument("--name", required=True, help="Name of the AI system (e.g. 'Claude Project')")
    create_parser.add_argument("--uid", default=None, help="Target user UID")

    list_parser = subparsers.add_parser("list", help="List registered API keys")

    revoke_parser = subparsers.add_parser("revoke", help="Revoke an existing API key")
    revoke_parser.add_argument("--key", required=True, help="API key string to revoke")

    args = parser.parse_args()

    if args.command == "create":
        create_api_key(args.name, args.uid)
    elif args.command == "list":
        list_api_keys()
    elif args.command == "revoke":
        revoke_api_key(args.key)
    else:
        parser.print_help()
