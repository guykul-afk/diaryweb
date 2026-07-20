import os
import re

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

    # Robust regex matching frontmatter:
    # Optional ```yaml wrapping at the start
    # Then --- followed by lazy match of yaml content, followed by ---
    # Optional closing ``` and then body
    pattern = r'^(?:```yaml\s*\n)?---\s*\n(.*?)\n---\s*\n(?:```\s*\n)?(.*)'
    match = re.match(pattern, content, re.DOTALL)
    
    if not match:
        # Fallback to pure markdown with no frontmatter (highly unlikely, but safe)
        print(f"Skipping {os.path.basename(file_path)}: No frontmatter pattern matched.")
        return

    fm_text = match.group(1)
    body = match.group(2)

    if not fm_text:
        print(f"Skipping {os.path.basename(file_path)}: Frontmatter text is empty.")
        return

    # Process frontmatter lines
    lines = fm_text.split('\n')
    new_lines = []
    
    has_maps_to_patterns = False
    has_counterpart = False
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            new_lines.append(line)
            continue
            
        # 1. Check maps_to_patterns
        if stripped.startswith('maps_to_patterns:'):
            has_maps_to_patterns = True
            
        # 2. Check counterpart
        if stripped.startswith('counterpart:'):
            has_counterpart = True
            # Fix broken counterparts
            if 'stoicism_aurelius.md' in line:
                line = line.replace('stoicism_aurelius.md', 'stoicism.md')
            elif 'radical_acceptance_linehan.md' in line:
                line = line.replace('radical_acceptance_linehan.md', 'act.md')
        
        # 3. Check domain
        if stripped.startswith('domain:'):
            # Map domain values
            for eng, heb in DOMAIN_MAP.items():
                line = re.sub(r'\b' + re.escape(eng) + r'\b', heb, line)
                
        new_lines.append(line)

    # Add missing keys if they were not present
    if not has_maps_to_patterns:
        new_lines.append("maps_to_patterns: []")
    if not has_counterpart:
        new_lines.append('counterpart: ""')

    # Assemble back with standard --- prefix and suffix (no markdown code fence wrapper)
    new_fm = "\n".join(new_lines)
    new_content = f"---\n{new_fm}\n---\n\n{body.strip()}"
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Successfully fixed frontmatter for {os.path.basename(file_path)}")

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
