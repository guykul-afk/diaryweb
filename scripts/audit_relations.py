import json
import os
from collections import Counter, defaultdict

def run_audit():
    backup_file = "graph_backup.json"
    if not os.path.exists(backup_file):
        print(f"Error: {backup_file} not found.")
        return

    with open(backup_file, "r", encoding="utf-8") as f:
        nodes = json.load(f)

    print(f"Loaded {len(nodes)} nodes from {backup_file}.")

    node_types = Counter()
    relations_counter = Counter()
    node_ids = set()
    node_labels = {}
    persons = []
    
    total_edges = 0
    dangling_edges = 0
    outgoing_edges_per_node = defaultdict(int)
    incoming_edges_per_node = defaultdict(int)

    for node in nodes:
        nid = node.get("id") or node.get("name")
        node_ids.add(nid)
        ntype = node.get("type", "Unknown")
        node_types[ntype] += 1
        label = node.get("label") or node.get("name") or nid
        node_labels[nid] = label

        if ntype == "Person":
            persons.append({"id": nid, "label": label, "aliases": node.get("aliases", [])})

    for node in nodes:
        nid = node.get("id") or node.get("name")
        edges = node.get("relatedEdges", [])
        for edge in edges:
            total_edges += 1
            rel = edge.get("relation", "UNSPECIFIED").strip()
            target = edge.get("target") or edge.get("targetId") or edge.get("node")
            relations_counter[rel] += 1
            outgoing_edges_per_node[nid] += 1
            if target:
                incoming_edges_per_node[target] += 1
                if target not in node_ids:
                    dangling_edges += 1

    # Person resolution candidates (rough grouping by substring / similarity)
    person_clusters = defaultdict(list)
    for p in persons:
        first_word = p["label"].split()[0] if p["label"] else "Unknown"
        person_clusters[first_word].append(p["label"])

    potential_duplicate_persons = {k: v for k, v in person_clusters.items() if len(v) > 1}

    # Generate Markdown Report
    report = []
    report.append("# דוח ביקורת אונטולוגיה בסיסי — Phase 0 Baseline Audit")
    report.append(f"**תאריך יצירה:** 28 אוגוסט 2026")
    report.append(f"**מקור נתונים:** `{backup_file}`\n")

    report.append("## 1. סיכום כללי (General Summary)")
    report.append(f"- **סה\"כ צמתים (Nodes):** {len(nodes):,}")
    report.append(f"- **סה\"כ קשרים (Edges):** {total_edges:,}")
    report.append(f"- **סה\"כ סוגי יחסים ייחודיים (Unique Relations):** {len(relations_counter):,}")
    report.append(f"- **קשרים עם יעדים חסרים/יתומים (Dangling Edges):** {dangling_edges:,}")
    report.append(f"- **ישויות מסוג Person:** {len(persons):,}\n")

    report.append("## 2. התפלגות סוגי צמתים (Node Types Breakdown)")
    report.append("| סוג צומת (Node Type) | כמות | אחוז מסך הצמתים |")
    report.append("| :--- | :--- | :--- |")
    for ntype, count in node_types.most_common():
        pct = (count / len(nodes)) * 100
        report.append(f"| `{ntype}` | {count:,} | {pct:.1f}% |")
    report.append("\n")

    report.append("## 3. ניתוח יחסים וקשרים (Top Relations & Saturation)")
    report.append(f"מתוך **{len(relations_counter)}** סוגי יחסים שונים שנמצאו בגרף, להלן 25 המובילים:")
    report.append("| יחס גולמי (Raw Relation) | שכיחות | אחוז מסך הקשרים | סטטוס מיפוי מוערך |")
    report.append("| :--- | :--- | :--- | :--- |")
    for rel, count in relations_counter.most_common(25):
        pct = (count / total_edges) * 100 if total_edges > 0 else 0
        report.append(f"| `{rel}` | {count:,} | {pct:.2f}% | מועמד לנרמול קנוני |")
    report.append("\n")

    report.append("## 4. מועמדים ליישוב ישויות Person (Potential Person Clusters)")
    report.append("להלן ישויות מסוג Person החולקות שמות פרטיים דומים הדורשות סקירה ידנית ללא Destructive Merge:")
    for key, cluster in sorted(potential_duplicate_persons.items()):
        report.append(f"- **קבוצה '{key}':** {', '.join(set(cluster))}")
    report.append("\n")

    report.append("## 5. מסקנות לשלב 1 (v2-Core Schema & Normalization)")
    report.append("1. **עומס סמנטי על יחסים:** קיימים מאות יחסים ייחודיים שרובם מופיעים 1-2 פעמים בלבד. נדרש `Relation Registry` עם כ-10-15 יחסים קנוניים ו-`semanticBacklog` שיכיל את כל היתר.")
    report.append("2. **הפרדת הידע הקנוני ל-Assertions:** במקום צמתי ענק עם `relatedEdges` בלתי-מבוקרים, נבנה מודל `Assertion` מבוסס מקור עם שרשרת עדות (`Evidence`).")
    report.append("3. **יישוב זהויות Person:** ישנן ישויות מרובות עם שמות קרובים הדורשות איחוד קנוני ב-`Entity Registry` (עם Aliases) באמצעות ממשק הסקירה ב-UI.")

    report_content = "\n".join(report)
    with open("ONTOLOGY_BASELINE_REPORT.md", "w", encoding="utf-8") as f:
        f.write(report_content)

    print("Successfully generated ONTOLOGY_BASELINE_REPORT.md")

if __name__ == "__main__":
    run_audit()
