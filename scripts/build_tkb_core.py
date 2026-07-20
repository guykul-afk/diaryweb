import os
import re

TKB_DIR = "c:/Users/guyku/okf_knowledge_viewer/functions/okf/tkb"
CORE_FILE = "c:/Users/guyku/okf_knowledge_viewer/functions/okf/tkb_core.md"

def build_core():
    core_content = "# TKB Core Index\n\n"
    
    for filename in os.listdir(TKB_DIR):
        if not filename.endswith(".md"):
            continue
            
        filepath = os.path.join(TKB_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Parse frontmatter
        match = re.search(r'^---\n(.*?)\n---', content, flags=re.DOTALL)
        if match:
            fm_text = match.group(1)
            
            # Simple string parsing
            title_m = re.search(r'^title:\s*(.*)$', fm_text, flags=re.MULTILINE)
            type_m = re.search(r'^type:\s*(.*)$', fm_text, flags=re.MULTILINE)
            desc_m = re.search(r'^description:\s*(.*)$', fm_text, flags=re.MULTILINE)
            rel_m = re.search(r'^relations:\s*\[(.*?)\]', fm_text, flags=re.MULTILINE | re.DOTALL)
            
            title = title_m.group(1).strip() if title_m else filename.replace('.md', '')
            type_val = type_m.group(1).strip() if type_m else 'Unknown'
            desc = desc_m.group(1).strip() if desc_m else ''
            rels = rel_m.group(1).strip() if rel_m else ''
            
            core_content += f"## {title} ({type_val})\n"
            if desc:
                core_content += f"- {desc}\n"
            if rels:
                core_content += f"- Relations: {rels}\n"
            core_content += "\n"

    with open(CORE_FILE, "w", encoding="utf-8") as f:
        f.write(core_content)
    print(f"Built core index at {CORE_FILE}")

if __name__ == "__main__":
    build_core()
