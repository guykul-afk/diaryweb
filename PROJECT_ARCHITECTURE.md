# ארכיטקטורת מערכת - Knowledge Viewer & Diary Analyzer

מסמך זה מתאר בצורה מקיפה את ארכיטקטורת המערכת של פרויקט ה-Knowledge Viewer, הכולל את שכבות הלקוח (Frontend), השרת (Backend), ניהול הנתונים, תהליכי ייבוא וסנכרון, ואת ממשקי הניתוח המבוססים על בינה מלאכותית.

---

## 1. סקירה כללית (High-Level Architecture)
המערכת פועלת בארכיטקטורת **Client-Server-Serverless** הנסמכת באופן נרחב על תשתית **Firebase** עבור אירוח (Hosting), מסד נתונים (Firestore), פונקציות ענן (Cloud Functions) והזדהות (Auth). הפרויקט משלב תצוגות מורכבות המבוססות על מנועי ויזואליזציה (כגון D3 ו-Three.js), תוך שילוב עיבוד נתונים "כבד" שנעשה הן בסקריפטים מקומיים מקדימים והן בסביבת ענן מבוססת פייתון.

### הרכיבים המרכזיים:
1. **Frontend (צד לקוח):** אפליקציית Web Single Page Application (SPA) מבוססת React ו-Vite.
2. **Backend & DB (צד שרת ומסד נתונים):** מבוסס על Firebase Firestore לאחסון, ו-Firebase Cloud Functions (Python) להרצת ניתוחי AI ושירותי Backend.
3. **Data Ingestion Pipeline (תהליך ייבוא נתונים):** סט סקריפטים (Node.js ו-Python) האוסף נתוני צד-שלישי (כגון Google Health/Fitbit Takeout ורשומות יומן טקסטואליות), מנתח אותם ומעלה אותם לפיירבייס.

---

## 2. צד הלקוח (Frontend)

אפליקציית הלקוח נבנתה באמצעות **React 19** ו-**Vite 8**. היא פועלת מהדפדפן ואחראית באופן בלעדי על חוויית המשתמש והצגת ויזואליזציות של הנתונים.

### תלויות וטכנולוגיות מרכזיות:
* **D3.js & React Force Graph:** משמשים להצגת רשתות מידע (גרף קשרים) בדו-מימד ובתלת-מימד (`react-force-graph-2d`, `react-force-graph-3d`, `d3-force`, `d3-sankey`).
* **עיצוב וממשק (UI):** שימוש ב-CSS טהור (`index.css`, `App.css`) במקום ספריות Utility, ושילוב אייקונים מבית `lucide-react`.
* **ניהול מצב (State Management):** מתבצע מקומית בעזרת React Hooks (כגון `useDiaryData.js`).
* **אבטחה (Passcode Gate):** רכיב מותאם המגן על הכניסה לאפליקציה, ומאמת קוד מול Firebase Functions בטרם הצגת נתונים רגישים.

### תצוגות (Views) מרכזיות:
1. **`GraphView.jsx`:** תצוגת הליבה של גרף הידע (Knowledge Graph). מציגה את הרשת של האנשים, המושגים, והרגשות המוזכרים ביומן, עם יכולות זום, חיפוש, ופילטור דינמי.
2. **`FeedView.jsx`:** תצוגת בלוג/פיד המציגה רשומות יומן באופן כרונולוגי עם יכולות סינון מתקדמות.
3. **`InsightsView.jsx` & `PersonalityAnalysisView.jsx`:** דשבורדים אנליטיים המציגים תובנות וניתוח אישיות באמצעות כלים ויזואליים שונים כגון Sankey Diagrams או Circle Packing.
4. **`MindMapBuilderView.jsx`:** כלי אינטראקטיבי לבניית מפות חשיבה מתוך תכנים מהיומן.

---

## 3. מסד הנתונים ואחסון (Firebase)

לפירוט מלא על מבנה האוספים ב-Firestore, מבנה קבצי הפרויקט, ואופן התקשורת ביניהם – ראו את הקובץ [PROJECT_STRUCTURE_AND_DB.md](file:///c:/Users/guyku/okf_knowledge_viewer/PROJECT_STRUCTURE_AND_DB.md).

המערכת משתמשת ב-**Firestore**, מסד הנתונים ה-NoSQL של Firebase. הנתונים מחולקים למספר "אוספים" (Collections) מרכזיים תחת מבנה המשתמש:

* **מבנה בסיס הנתונים (`users/{uid}/`):** כל המידע מסווג תחת מזהה המשתמש. במקרה וישנו משתמש זיהוי אנונימי, קיים Fallback קשיח (כפי שניתן לראות ב-`App.jsx`).
  * **`lifeTrackerData`:** מכיל את נתוני Google Health/Fitbit (צעדים, דופק, שינה) כפי שסונכרנו.
  * **`insights` & `personality`:** תוצאות הניתוח שהופקו מהיומנים, המופקים כ-JSON ומוצגים בדשבורד.
  * **`recommended_readings`:** רשומות קשורות שהמערכת ממליצה לקרוא.
  * **רשומות ויומנים (Entries & Graph Data):** ייצוג הפוסטים מהיומן וקשרי הישויות (Edges & Nodes).

הזדהות למערכת (Authentication) נעשית בצורה של כניסה אנונימית הנסמכת על קוד פנימי, ואימות צד-שרת מול פונקציית הענן.

---

## 4. צד שרת ופונקציות מבוססות AI (Firebase Cloud Functions)

במקום לנהל שרת מרכזי, הפרויקט מבוסס לחלוטין על פונקציות ענן, הכתובות ב-**Python** (`functions/main.py`), המאפשרות שימוש קל יותר בספריות Data Science ו-AI.

### פונקציות הענן הקיימות (Cloud Callable):
* **`verify_passcode`:** מאמתת את הקוד שהוקלד בצד הלקוח ומחזירה Token המאפשר המשך גישה לשאר המידע ב-Firestore.
* **`analyze_personality`:** מבצעת קריאה לניתוח מעמיק של אישיות הכותב, תוך סקירת קטעי יומן והסקת תובנות פסיכולוגיות.
* **`analyze_knowledge_graph`:** מריצה ניתוח מורכב על הגרף (ככל הנראה באמצעות שירות LLM), מזהה קשרים חסרים, קונפליקטים, ומפיקה שאילתות על בסיס רשת הקשרים (Knowledge Graph).

עבור פיתוח, קיים קובץ `firebase.json` הכולל קונפיגורציה מלאה לשימוש באמולטורים (Emulators) להרצת Firebase Auth, Firestore ו-Functions באופן לוקאלי על פורטים מוגדרים.

---

## 5. תהליך ייבוא נתונים (Data Ingestion Pipeline)

חלק קריטי בארכיטקטורה הוא הזנת המידע למערכת. תיקיית `scripts` מכילה תשתית ענפה של קוד ב-Node.js וב-Python להכנת המידע. תהליך זה הינו אסינכרוני ומתבצע כ-Offline Batch Process ולא בזמן ריצה של משתמש קצה.

### שלבי הייבוא והסנכרון:
1. **ייבוא מקורות מידע חיצוניים:**
   * `import_health_data.mjs` / `sync_google_health.mjs`: סקריפטים אלו קוראים קבצי CSV/JSON שמקורם בייצוא של Google Takeout או Google Fit, מסדרים את המידע למבנה של Time Series ומעלים אותם ל-Firestore כחלק מ-`lifeTrackerData`.
2. **בנייה ועיבוד גרף הידע (TKB - Text Knowledge Base):**
   * סקריפטים מבוססי פייתון כדוגמת `build_tkb_core.py`, `extract_tkb_graph.py` ו-`enrich_tkb.py`. אלו לוקחים ככל הנראה רשומות טקסט של היומן (בפורמט Markdown כנראה), מחלצים מהם ישויות וקשרים, ויוצרים מבנה היררכי (Graph).
   * `generate_edge_mappings.py` וסקריפטים דומים יוצרים את קבצי ה-JSON הסטטיים של הרשת המשמשים את מנוע ה-React Force Graph.
3. **תחזוקת גרף ומיגרציה:**
   * סקריפטים כמו `merge_duplicate_entities.mjs`, `count_nodes.mjs`, `backfill_temporal_edges.mjs` מתפקדים ככלים לניקוי, איחוד וטיוב מסד הנתונים הגרפי לאורך זמן.

---

## 6. זרימת מידע טיפוסית (Data Flow)

1. **שלב האופליין (הזנת נתונים):** המשתמש מייצא נתונים מהיומן (למשל Markdown) ומ-Google Health. בעזרת סקריפטים בספריית `scripts`, המידע מעובד, קשרים מחולצים ומועלים ל-Firestore.
2. **טעינת המערכת (Load):** משתמש קצה ניגש ל-Frontend. נטען מסך `PasscodeGate`.
3. **אימות (Authentication):** המשתמש מזין קוד אשר נשלח כבקשת HTTPS Callable לפונקציה `verify_passcode` (Python Firebase Function). אם מאושר, ה-Session מתחיל (כניסה אנונימית מאומתת לוגית).
4. **שליפת נתונים וניתוח (Fetch & Render):** 
   * `App.jsx` וה-Views השונים מתחברים ישירות ל-Firestore באמצעות Firebase Web SDK.
   * נתונים פיזיולוגיים (lifeTracker) נמשכים מתשתית השרת. רשת הקשרים (Graph Data) נמשכת ומוצגת על קנבס WebGL באמצעות D3.
5. **ניתוח On-Demand:** דרך הממשק (כמו ב-`InsightsView` או ב-`PersonalityAnalysisView`), המשתמש יוזם קריאה לפונקציות AI (כגון `analyze_knowledge_graph`). השרת מחשב באמצעות LLM את התובנות, מעדכן את המסמכים ב-Firestore, והקליינט מתעדכן בזמן אמת.

---

## סיכום

הארכיטקטורה של *Knowledge Viewer & Diary Analyzer* הינה מודרנית ומודולרית. היא מפרידה בצורה ברורה בין **עיבוד הנתונים המקדים** הכבד (Scripts), **ניהול הנתונים והאבטחה** מבוסס הענן (Firebase & Cloud Functions), ובין **התצוגה האינטראקטיבית** העשירה בדפדפן (React & D3). מבנה זה מאפשר חקירה וויזואליזציה מהירה של נתונים מורכבים במיוחד, בצורה מאובטחת, וללא צורך בניהול שרתי Web מסורתיים.
