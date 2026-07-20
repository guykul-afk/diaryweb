import os
import re
import yaml

TKB_DIR = "c:/Users/guyku/okf_knowledge_viewer/functions/okf/tkb"

DOMAIN_MAP = {
    "inner_self": "עולם_פנימי",
    "meaning": "רוחניות_ומשמעות",
    "relationships": "זוגיות_ומשפחה",
    "health": "בריאות_ותזונה",
    "work": "עבודה_וקריירה",
    "social": "חברים_וקהילה",
    "finance": "פיננסים",
    "learning": "למידה_והתפתחות",
    "leisure": "פנאי_ותחביבים",
    "environment": "סביבה_ומגורים"
}

def fix_frontmatter(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Normalize weird ```yaml blocks to standard ---
    if content.startswith("```yaml"):
        content = re.sub(r'^```yaml\s*\n(.*?)\n```', r'---\n\1\n---', content, flags=re.DOTALL)
    if not content.startswith("---"):
        content = "---\ntype: Uncategorized\n---\n\n" + content
        
    # Also handle some files that might have --- then ```yaml then ---
    content = re.sub(r'^---\s*\n```yaml\s*\n(.*?)\n```\s*\n---', r'---\n\1\n---', content, flags=re.DOTALL)
    content = re.sub(r'^---\s*\n---\s*\ntype: concept\n(.*?)\n---', r'---\ntype: concept\n\1\n---', content, flags=re.DOTALL)

    fm_match = re.search(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
    if not fm_match:
        return

    fm_text = fm_match.group(1)
    body = fm_match.group(2)

    try:
        fm = yaml.safe_load(fm_text)
    except Exception as e:
        print(f"Error parsing YAML in {file_path}: {e}")
        return

    if not isinstance(fm, dict):
        fm = {}

    # Migrate Domain
    domain = fm.get('domain')
    if isinstance(domain, str):
        if domain in DOMAIN_MAP:
            fm['domain'] = DOMAIN_MAP[domain]
    elif isinstance(domain, list):
        fm['domain'] = [DOMAIN_MAP.get(d, d) for d in domain]
        
    # Ensure lists
    if 'maps_to_patterns' not in fm:
        fm['maps_to_patterns'] = []
    
    # Counterparts
    if 'counterpart' not in fm:
        fm['counterpart'] = ""
    else:
        # Fix broken counterparts
        if fm['counterpart'] == "stoicism_aurelius.md":
            fm['counterpart'] = "stoicism.md"
        elif fm['counterpart'] == "radical_acceptance_linehan.md":
            fm['counterpart'] = "act.md"

    new_fm_text = yaml.dump(fm, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    new_content = f"---\n{new_fm_text}---\n{body}"
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

def main():
    if not os.path.exists(TKB_DIR):
        print(f"Directory {TKB_DIR} not found.")
        return
        
    for filename in os.listdir(TKB_DIR):
        if filename.endswith(".md"):
            fix_frontmatter(os.path.join(TKB_DIR, filename))

    print("Frontmatter fixed successfully.")

if __name__ == "__main__":
    main()
