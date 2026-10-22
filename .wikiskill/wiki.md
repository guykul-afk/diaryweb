# Project Knowledge Wiki (WikiSkill)

מאגר הידע המצטבר, לקחים, פתרונות לכשלים ודפוסי עבודה עבור הפרויקט.

## כללי יסוד (Core Guidelines)
1. **חובת תיעוד אוטונומית:** הפעלת תיעוד בעת כל שגיאת ריצה, ביצוע חוזר (rework), כשל שקט או תיקון משתמש.
2. **אימות מקור האמת:** שאילתה תמיד מול ה-DB / המקור הראשי, ללא הסתמכות על קבצים מקומיים עם שמות מטעים.
3. **בדיקת White-Box ו-Zero-Trust:** אימות לוגיקה פנימית ולא רק קודי סיום (Exit Code 0).

## לקחים מצטברים (Cumulative Lessons)
* **[2026-10-20 — מפת המודלים העדכנית של Google Gemini (אוקטובר 2026)](lessons/2026-10-20-gemini-models-lineup-2026.md):**
  - **Flagship Reasoning (Stable):** `gemini-4-argon` (Gemini 4 Argon — 1M context & 1M decode) ו-`gemini-3.1-pro-preview` (Preview).
  - **Agentic & Coding Flash (Stable):** `gemini-3.8-flash` (המודל המוביל להנדסת תוכנה, סוכנים וזרימות עבודה עם `thinking_config` גמיש) ו-`gemini-3.6-flash`.
  - **High-Throughput Lite (Stable):** `gemini-3.5-flash-lite` ו-`gemini-3.1-flash-lite`.
  - **Embeddings:** `gemini-embedding-2-preview` (מולטי-מודאלי) ו-`gemini-embedding-001` (יציב לטקסט).
  - **אזהרת Legacy:** מודלי `gemini-2.5-*` מוגבלים לפרויקטים ישנים בלבד — בקוד הפרויקט (`functions/main.py`) יש לשדרג מ-`gemini-2.5-flash` אל `gemini-3.8-flash` (למשימות עומק/מראה) ו-`gemini-3.5-flash-lite` (לחילוץ מהיר).
