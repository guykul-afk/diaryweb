import os
import urllib.request
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_sync():
    isa_uid = os.getenv("ISA_UID", "yxF7bHYMpWTayDjTfoYPEyfVTVd2")
    url = f"https://firestore.googleapis.com/v1/projects/lifetracker-guy-2026/databases/(default)/documents/users/{isa_uid}"
    print(f"Fetching from: {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'FirebaseFunction'})
        with urllib.request.urlopen(req) as response:
            html = response.read()
            doc_data = json.loads(html.decode('utf-8'))
            print("Successfully fetched data:")
            # Just print the top-level keys
            print(doc_data.keys())
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_sync()
