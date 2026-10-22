# מפת המודלים העדכנית של Google Gemini (אוקטובר 2026)

**תאריך עדכון:** 2026-10-20
**מקור רשמי מאומת:** `https://ai.google.dev/gemini-api/docs/models` (עודכן ב-2026-10-19 UTC)
**טריגר:** תיקון משתמש (User Correction Trigger) — שמות המודלים בתכנית הסוכנים ובקוד השרת לא שיקפו את הדור העדכני של מודלי Gemini (סדרות Gemini 4 ו-Gemini 3.8/3.6/3.5).

---

## 1. מודלי הדגל והחשיבה העמוקה (Frontier & Deep Reasoning — Stable / Preview)
| שם המודל | מזהה API (`Endpoint`) | סטטוס | ייעוד ורמת מאמץ מומלצת |
| :--- | :--- | :---: | :--- |
| **Gemini 4 Argon** | `gemini-4-argon` | **Stable (New)** | **מודל הדגל העליון (Flagship Reasoning):** חלון הקשר מאוחד של 1M טוקנים ופלט (Decode) עד 1M טוקנים. מיועד לארכיטקטורה מורכבת, אלגוריתמיקה מדעית, סוכנים אוטונומיים ארוכי-טווח ובקרת איכות White-Box (רמת מאמץ: **High / Max**). |
| **Gemini 3.1 Pro** | `gemini-3.1-pro-preview` | **Preview** | מודל חשיבה מתקדם מסדרת 3.1 לפתרון בעיות מורכבות ושימוש רב-שלבי בכלים. |

---

## 2. מודלי סוכנים והנדסת תוכנה מהירים (Flash Tier — Stable)
| שם המודל | מזהה API (`Endpoint`) | סטטוס | ייעוד ורמת מאמץ מומלצת |
| :--- | :--- | :---: | :--- |
| **Gemini 3.8 Flash** | `gemini-3.8-flash` | **Stable (New)** | **מודל ה-Flash החכם ביותר (Workhorse לסוכנים וקוד):** מתוכנן להנדסת תוכנה ארוכת-טווח, סוכנים אוטונומיים וזרימות עבודה מורכבות עם תמיכה ברמות חשיבה (`thinking_config` — Low / Medium / High). מומלץ כברירת המחדל ל-Cloud Functions חכמות ולסוכני פיתוח מרכזיים. |
| **Gemini 3.6 Flash** | `gemini-3.6-flash` | **Stable** | מודל Flash יציב ומהיר למשימות סוכנים כלליות, אינטגרציית UI/Backend וניתוח מולטי-מודאלי שוטף (רמת מאמץ: **Medium**). |
| **Gemini 3 Flash** | `gemini-3-flash-preview` | **Preview** | גרסת Preview של סדרת Gemini 3 Flash. |

---

## 3. מודלים מהירים וחסכוניים לעיבוד נפח גבוה (Flash-Lite Tier — Stable)
| שם המודל | מזהה API (`Endpoint`) | סטטוס | ייעוד ורמת מאמץ מומלצת |
| :--- | :--- | :---: | :--- |
| **Gemini 3.5 Flash-Lite** | `gemini-3.5-flash-lite` | **Stable** | **המודל המהיר והחסכוני ביותר בסדרת 3.5:** מיועד לביצוע בתפוקה גבוהה (High-Throughput), חילוץ ישויות מהיר, סקריפטי המרה ונרמול אונטולוגי (רמת מאמץ: **Low / Minimal**). |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite` | **Stable** | ביצועים גבוהים בעלות מזערית למשימות סיווג וטרנספורמציה מהירות. |

---

## 4. מודלי Embeddings, סוכנים מנוהלים, אודיו ומדיה (אוקטובר 2026)
- **Embeddings:**
  - `gemini-embedding-2-preview` (**Gemini Embedding 2** — מודל ה-Embedding המולטי-מודאלי הראשון לטקסט, תמונות, וידאו, אודיו ו-PDF; *שים לב: ב-`functions/main.py` הופיע השם השגוי `gemini-embedding-2` ללא `-preview`*).
  - `gemini-embedding-001` (**Gemini Embedding** — מודל Embedding יציב לחיפוש סמנטי ו-RAG טקסטואלי).
- **Tool & Managed Agent Models:**
  - `antigravity-preview-09-2026` (**Antigravity Agent**)
  - `deep-research-preview-04-2026` (**Gemini Deep Research**)
  - `deep-research-max-preview-04-2026` (**Gemini Deep Research Max**)
- **Audio & Live Speech:**
  - `gemini-3.8-live` (**Gemini 3.8 Live** — ברירת מחדל לשיחה קולית בזמן אמת)
  - `gemini-3.8-live-extended-thinking` (**Gemini 3.8 Live Extended Thinking**)
  - `gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts` (יצירת דיבור TTS)
  - `gemini-3.5-transcribe` / `gemini-3.5-transcribe-live` (תמלול STT מהיר ומדויק)
- **Generative Media:**
  - `gemini-nano-banana-2.1` (**Nano Banana 2.1**), `gemini-3.1-flash-image` (**Nano Banana 2**), `gemini-3.1-flash-lite-image` (**Nano Banana 2 Lite**), `gemini-3-pro-image` (**Nano Banana Pro**), `gemini-omni-1.1-flash` (**Gemini Omni Flash** לוידאו).

---

## 5. מודלים מוגבלים (Legacy 2.5) ומודלים שהושבתו (Shut Down)
- **סדרת Gemini 2.5 (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`):**
  גוגל מגבילה את הגישה למודלי 2.5 ומנחה מפורשות בתיעוד הרשמי:
  > *"For any new projects, use our latest models: `gemini-3.5-flash-lite` or `gemini-3.8-flash`."*
- **מודלים שהושבתו סופית (Shut Down — אסור להשתמש בהם):**
  - `gemini-2.0-flash`, `gemini-2.0-flash-lite`
  - `gemini-3-pro-preview`, `gemini-3.1-flash-lite-preview`
  - `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview` (מושבתים ב-22 באוקטובר 2026 לטובת `gemini-omni-1.1-flash`).
