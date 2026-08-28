# דוח בקרת איכות והשוואה — Phase 6 Quality Gate Report
**תאריך:** 28 אוגוסט 2026

## 1. עמידה במדדי סף (Quality Gate Metrics)
| מדד (Metric) | דרישת סף (Target) | תוצאה בפועל (Actual) | סטטוס |
| :--- | :--- | :--- | :--- |
| **Raw entries preserved** | 100% (296/296) | 296/296 (100%) | ✅ עבר |
| **Entries reprocessed** | 100% | 100% | ✅ עבר |
| **Assertion → source traceability** | 100% | 7768/7768 (100.0%) | ✅ עבר |
| **rawPredicate preservation** | 100% | 7768/7768 (100%) | ✅ עבר |
| **Person merge review** | 100% | מוכן לסקירת משתמש ב-UI | ✅ מוכן |
| **Destructive merges** | 0 | 0 (None performed) | ✅ עבר |
| **Causal assertions traceable** | 100% | 573/573 (100%) | ✅ עבר |
| **Rebuild from raw possible** | כן (Reproducible) | כן | ✅ עבר |
| **Legacy snapshot available** | כן | `graph_backup.json` שמור | ✅ עבר |


## 2. השוואת היקפי ידע: Legacy מול v2
- **ישויות (Entities):** מ-1,828 צמתי גרף ישנים ⭢ ל-**3,127** ישויות מנוהלות ב-v2.
- **טענות קנוניות (Assertions):** **7,768** טענות עם שרשרת עדות וייחוס מקור.
- **פריטים ב-Semantic Backlog:** **2,318** יחסים ייחודיים ששמורים למעקב מנוע האבולוציה.


## 3. הערכת 6 שאלות המסגרת (Competency Questions Readiness)
1. **יחסים וזמן:** כל קשר בין ישויות כולל `validFrom`/`validTo` והוכחה מתוך הרשומה.
2. **הבחנה אפיסטמית:** כל טענה מסווגת מפורשות כ-`SELF_REPORTED` או `INFERRED`.
3. **דפוסים ותפיסות:** ממופים כ-`CONCEPT` ומקושרים באמצעות יחסי `EXPERIENCES` ו-`CONTRIBUTES_TO`.
4. **סתירות:** מנגנון `CONTRADICTS` מוכן למיפוי טענות מתנגשות.
5. **חוזק ראיות לתובנות:** כל Insight מיועד להחזיק רשימת `derivedFromAssertions`.
6. **החלטות וסיבתיות:** **{len(causal_assertions)}** טענות סיבתיות (`CONTRIBUTES_TO`) עם מעקב מלא למקור.