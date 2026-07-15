# צלילה עמוקה (Deep Dive) - Knowledge Viewer & Diary Analyzer

מערכת אינטראקטיבית ומאובטחת לניהול, ויזואליזציה וניתוח של רשומות יומן אישיות בשילוב נתוני בריאות ופיטנס.

---

## 🎯 מהות הפרויקט ומטרתו

מטרת הפרויקט היא לספק למשתמש כלי חקירה מעמיק ("צלילה עמוקה") על גבי יומנים אישיים ונתוני מדדים פיזיולוגיים (כגון דופק, שינה וצעדים מתוך Fitbit ו-Google Health). 

המערכת מאפשרת למשתמשים:
1. **לזהות דפוסים וקשרים:** ויזואליזציה של קשרים מורכבים בין ישויות (אנשים, נושאים, רגשות וקונספטים) מתוך היומן באמצעות גרפים דינמיים.
2. **ניתוח אישיות ותובנות:** הפקת תובנות עמוקות (Insights) וניתוחי אישיות מתוך דפוסי הכתיבה והמדדים הפיזיולוגיים.
3. **מעקב בריאותי משולב:** שילוב נתונים פיזיולוגיים מיומנים ומכשירי לבישה (Fitbit/Google Fit) המאפשרים לבחון כיצד מצב הרוח והנושאים שנכתבו ביומן משפיעים על הבריאות הפיזית ולהיפך.

---

## 🏗️ ארכיטקטורה ורכיבי המערכת

הפרויקט בנוי בארכיטקטורת Client-Server מודרנית:

### 1. צד הלקוח (Frontend)
מבוסס על **React** ו-**Vite** לעבודה מהירה וחלקה עם רכיבים אינטראקטיביים:
* **ויזואליזציה וגרפים (D3 & React Force Graph):** תצוגות גרף דו-מימדיות ותלת-מימדיות המציגות את מפות הקשרים של המשתמש.
* **מערכת עיצוב:** שימוש ב-CSS מותאם ורכיבי ממשק מודרניים עם אייקונים של `lucide-react`.
* **שער אבטחה (Passcode Gate):** מנגנון אימות מאובטח מבוסס קוד גישה מול Firebase לפני כניסה למידע האישי הרגיש.

### 2. בסיס הנתונים (Backend & Storage)
* **Firebase Firestore:** משמש כבסיס הנתונים הראשי שבו נשמרים הפרופילים, רשומות היומן, הגרפים והמידע המסונכרן.

### 3. ייבוא וסנכרון נתונים (Data Ingestion)
תיקיית [scripts/](file:///c:/Users/guyku/okf_knowledge_viewer/scripts) מכילה סקריפטים ב-Node.js לייבוא נתוני Google Health/Fitbit Takeout וסנכרונם ל-Firebase:
* `sync_google_health.mjs` - מסנכרן נתוני בריאות וכושר של גוגל ישירות לשרת.
* `import_health_data.mjs` - מייבא קבצי CSV מקומיים מתוך Takeout של Google Health.

---

## 🖥️ תצוגות עיקריות במערכת ([src/](file:///c:/Users/guyku/okf_knowledge_viewer/src))

* **[App.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/App.jsx):** נקודת הכניסה הראשית, מנהלת את שער הגישה (PasscodeGate) והניווט בין התצוגות השונות.
* **[FeedView.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/FeedView.jsx):** פיד אינטראקטיבי לקריאה וחיפוש של רשומות היומן, כולל סינון לפי נושאים, מצבי רוח ותאריכים.
* **[GraphView.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/GraphView.jsx):** גרף קשרים דינמי המציג רשת של נושאים, רגשות, אנשים ומושגים והקשרים ביניהם.
* **[PersonalityAnalysisView.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/PersonalityAnalysisView.jsx):** ניתוח מגמות פסיכולוגיות ומאפייני אישיות מבוססי תוכן.
* **[InsightsView.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/InsightsView.jsx):** פנל תובנות המשלב גרפים ואינטגרציות מתקדמות (כמו Sankey, Circle Packing ועוד) להצגת התפלגויות נתונים.
* **[MindMapBuilderView.jsx](file:///c:/Users/guyku/okf_knowledge_viewer/src/MindMapBuilderView.jsx):** כלי לבנייה ועריכה של מפות חשיבה מבוססות רעיונות מהיומן.

---

## 🚀 הרצה מקומית

1. התקנת תלויות:
   ```bash
   npm install
   ```
2. הרצת שרת הפיתוח:
   ```bash
   npm run dev
   ```
3. בנייה לפרודקשן:
   ```bash
   npm run build
   ```
