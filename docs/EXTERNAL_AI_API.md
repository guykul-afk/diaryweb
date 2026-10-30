# 🌐 מדריך אינטגרציה למערכות בינה מלאכותית (OKF Knowledge AI API)

מערכת ה-API החדשה מאפשרת למערכות AI חיצוניות — כולל **ChatGPT (Custom GPTs / Actions)**, **Claude (Claude Desktop / Projects)**, סוכני **LangChain / LlamaIndex / CrewAI**, ותוכנות פייתון — להתחבר ישירות למאגר הנתונים שלכם, לתשאל את היומן וגרף הידע, לנתח מגמות בריאות, ולשמור תובנות חדשות בחזרה ל-Firestore.

---

## 📑 תוכן עניינים
1. [ארכיטקטורה ונקודות קצה](#1-ארכיטקטורה-ונקודות-קצה)
2. [אבטחה ואימות (Authentication)](#2-אבטחה-ואימות-authentication)
3. [חיבור ל-ChatGPT (Custom GPT Actions)](#3-חיבור-ל-chatgpt-custom-gpt-actions)
4. [חיבור ל-Claude Desktop / Cursor (Model Context Protocol)](#4-חיבור-ל-claude-desktop--cursor-model-context-protocol)
5. [חיבור לקוד פייתון / סוכני LangChain](#5-חיבור-לקוד-פייתון--סוכני-langchain)
6. [הפעלה מקומית ופריסה לענן](#6-הפעלה-מקומית-ופריסה-לענן)

---

## 1. ארכיטקטורה ונקודות קצה

המערכת מספקת ממשק RESTful תקני מעל HTTPS עם תמיכה מלאה ב-CORS ו-JSON:

| Endpoint | Method | תיאור | פרמטרים עיקריים |
| :--- | :---: | :--- | :--- |
| `/api/v1/ping` | `GET` | בדיקת זמינות ואימות המפתח | ללא |
| `/api/v1/entries` | `GET` | חיפוש ושליפת רשומות יומן | `query`, `tag`, `mood`, `start_date`, `end_date`, `limit` |
| `/api/v1/entries/{entry_id}` | `GET` | שליפת רשומה בודדת מלאה | `entry_id` (בנתיב) |
| `/api/v1/graph/nodes` | `GET` | שליפת ישויות מגרף הידע | `type` (Domain, Person, Goal, Pattern, Strategy...), `search`, `limit` |
| `/api/v1/graph/subgraph` | `GET` | חילוץ תת-גרף מקושר סביב מושג | `node_id` או `query`, `hops` (1 או 2) |
| `/api/v1/health` | `GET` | שליפת מדדים פיזיולוגיים (שינה, דופק, צעדים) | `start_date`, `end_date`, `metric` |
| `/api/v1/insights` | `GET` | שליפת ניתוח אישיות (OCEAN, סיכומי עומק) | `limit` |
| `/api/v1/theoretical-concepts` | `GET` | שליפת מושגים תיאורטיים ומודלים מנטליים | `search`, `limit` |
| `/api/v1/query` | `POST` | **RAG Context Pack:** אריזת קונטקסט מותאם ישירות לפרומפט של LLM | Body: `{"query": "...", "top_k_entries": 5, "include_graph": true}` |
| `/api/v1/analyze` | `POST` | **AI Ingestion:** שמירת ניתוח/תובנות של מודל חיצוני בחזרה למאגר | Body: `{"title": "...", "summary": "...", "patterns_detected": [...]}` |
| `/api/v1/openapi.json` | `GET` | מפרט OpenAPI 3.1 תקני לטעינה ישירה לכלים | ללא |
| `/api/v1/mcp` | `GET` | הגדרות כלים ל-Model Context Protocol | ללא |
| `/api/docs` | `GET` | דף תיעוד אינטראקטיבי ומעוצב בדפדפן | ללא |

---

## 2. אבטחה ואימות (Authentication)

כל הבקשות (למעט דפי התיעוד ו-OpenAPI) מחייבות מפתח API.

ניתן להעביר את המפתח באחת משלוש דרכים:
1. **Header סטנדרטי (מומלץ):** `Authorization: Bearer <API_KEY>`
2. **Header ייעודי:** `X-API-Key: <API_KEY>`
3. **Query Parameter (לבדיקות מהירות בדפדפן):** `?api_key=<API_KEY>`

### ניהול מפתחות API עם הסקריפט:
```bash
# יצירת מפתח חדש עבור Claude
python scripts/manage_api_keys.py create --name "Claude Project"

# הצגת כל המפתחות הפעילים
python scripts/manage_api_keys.py list

# ביטול מפתח קיים
python scripts/manage_api_keys.py revoke --key <API_KEY>
```
*מפתח ברירת מחדל לפיתוח מקומי מוגדר ב-`.env`: `okf-ai-default-secret-key-2026`.*

---

## 3. חיבור ל-ChatGPT (Custom GPT Actions)

באפשרותכם לחבר את המאגר ישירות ל-ChatGPT כ-Custom GPT:

1. היכנסו ל-ChatGPT -> **Explore GPTs** -> **Create**.
2. עברו ללשונית **Configure**.
3. גללו לתחתית העמוד ולחצו על **Create new action**.
4. תחת **Schema**:
   - לחצו על **Import from URL** והזינו:  
     `https://<YOUR_DOMAIN>/api/v1/openapi.json`  
   - לחילופין, העתיקו והדביקו ישירות את תוכן הקובץ המקומי: [`docs/openapi.json`](file:///c:/Users/User/okf_knowledge_viewer/docs/openapi.json).
5. תחת **Authentication**:
   - סמנו **API Key**.
   - ב-Auth Type בחרו **Bearer**.
   - הדביקו את מפתח ה-API שלכם.
6. בפרומפט של ה-GPT (Instructions) כתבו:
   > "אתה עוזר אישי שמנתח את היומן וגרף הידע של המשתמש. לפני שאתה עונה על שאלות לגבי תחושות, מטרות או דפוסים בעבר, השתמש בכלי query_rag_context או search_entries כדי לבסס את המענה על עובדות מהיומן."

---

## 4. חיבור ל-Claude Desktop / Cursor (Model Context Protocol)

המערכת כוללת שרת MCP מובנה [`scripts/mcp_server.py`](file:///c:/Users/User/okf_knowledge_viewer/scripts/mcp_server.py).

להגדרת Claude Desktop:
1. פתחו את קובץ ההגדרות של Claude Desktop:  
   `%APPDATA%\Claude\claude_desktop_config.json`
2. הוסיפו את ההגדרה מתוך [`docs/claude_desktop_config.json`](file:///c:/Users/User/okf_knowledge_viewer/docs/claude_desktop_config.json):
```json
{
  "mcpServers": {
    "okf-knowledge-vault": {
      "command": "python",
      "args": [
        "c:/Users/User/okf_knowledge_viewer/scripts/mcp_server.py"
      ],
      "env": {
        "OKF_API_URL": "http://localhost:5005",
        "OKF_API_KEY": "okf-ai-default-secret-key-2026"
      }
    }
  }
}
```
3. הפעילו מחדש את Claude Desktop — כעת תראו את סמל הפטיש 🔨 עם כל הכלים זמינים ישירות בחלון הצ'אט!

---

## 5. חיבור לקוד פייתון / סוכני LangChain

דוגמה פשוטה לשליפה וניתוח באמצעות Python:

```python
import requests

API_KEY = "okf-ai-default-secret-key-2026"
BASE_URL = "http://localhost:5005"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# 1. שליפת קונטקסט ממוקד לשאלה
response = requests.post(f"{BASE_URL}/api/v1/query", headers=headers, json={
    "query": "מה הדפוסים שלי סביב עבודה ולחץ?",
    "top_k_entries": 4,
    "include_graph": True
})
context = response.json()["ready_llm_context"]

# 2. הזנת הקונטקסט למודל AI שלכם (למשל OpenAI / Anthropic / Gemini)
# prompt = f"להלן הנתונים מיומן המשתמש:\n{context}\nאנא נתח..."

# 3. שמירת תוצאות הניתוח בחזרה למאגר
analysis_payload = {
    "title": "ניתוח תקופות לחץ בעבודה",
    "summary": "זוהתה עלייה ברמת המתח בימי ראשון ושני עקב ריבוי משימות.",
    "patterns_detected": ["עומס בתחילת שבוע", "דחיית אימונים"],
    "action_recommendations": ["חלוקת משימות הדרגתית"],
    "source_agent": "MyCustomAgent"
}
save_res = requests.post(f"{BASE_URL}/api/v1/analyze", headers=headers, json=analysis_payload)
print("Analysis Saved with ID:", save_res.json()["id"])
```

קוד הדגמה מלא זמין בקובץ: [`scripts/ai_client_example.py`](file:///c:/Users/User/okf_knowledge_viewer/scripts/ai_client_example.py).

---

## 6. הפעלה מקומית ופריסה לענן

### הפעלה מקומית מהירה:
```bash
python scripts/run_api_server.py --port 5005
```
לאחר ההפעלה גלשו אל:  
👉 **`http://localhost:5005/api/docs`** לצפייה בתיעוד ובדיקה חיה.

### פריסה לענן (Firebase Cloud Functions + Hosting):
ה-API מוגדר אוטומטית כ-Cloud Function ב-`functions/main.py` ומופנה דרך Firebase Hosting:
```bash
firebase deploy --only functions:api,hosting
```
הכתובת הפומבית של ה-API תהיה:  
`https://mindcloud-viewer-guy.web.app/api/v1/...`
