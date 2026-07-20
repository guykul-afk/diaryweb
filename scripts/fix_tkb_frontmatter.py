import os
import re

TKB_DIR = "c:/Users/guyku/okf_knowledge_viewer/functions/okf/tkb"

def fix_frontmatter(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # If it has ```yaml ... ``` at the top, convert to --- ... ---
    if content.startswith("```yaml"):
        content = re.sub(r'^```yaml\s*\n(.*?)\n```', r'---\n\1\n---', content, flags=re.DOTALL)
    
    # If no frontmatter at all, just skip or add a blank one (we'll just ensure formatting for now)
    if not content.startswith("---"):
        content = "---\ntype: Uncategorized\n---\n\n" + content

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    if not os.path.exists(TKB_DIR):
        print(f"Directory {TKB_DIR} not found.")
        return
        
    for filename in os.listdir(TKB_DIR):
        if filename.endswith(".md"):
            fix_frontmatter(os.path.join(TKB_DIR, filename))
            
    # Write _index.yaml validator
    index_path = os.path.join(TKB_DIR, "_index.yaml")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("""required_fields:
  - type
  - domain
  - relations
allowed_types:
  - CBT
  - Psychodynamic
  - Behavioral
  - Humanistic
  - FarEast
  - Clinical
  - Thinker
  - Poet
""")

    print("Frontmatter fixed and _index.yaml created.")

if __name__ == "__main__":
    main()
