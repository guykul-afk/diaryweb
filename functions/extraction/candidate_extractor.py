import json
from typing import Dict, Any, List, Optional

CANDIDATE_EXTRACTION_SYSTEM_PROMPT = """
אתה עוזר חילוץ ידע מדויק עבור יומן אישי (Diary Knowledge Extractor).
תפקידך לחלץ מועמדים לידע (Candidate Knowledge) מתוך רשומת יומן באופן נאמן למקור.

עקרונות חילוץ קריטיים:
1. אינך קובע אונטולוגיה סופית. אל תנסה להתאים בכוח לקטגוריות מורכבות.
2. שמור על הניסוח הגולמי של היחס (rawPredicate) כפי שמופיע בטקסט (למשל "הוביל ל", "התאכזב מ", "החליט לעזוב").
3. לכל טענה (claim), ספק חובה ציטוט מקור מדויק (quote) מתוך הרשומה.
4. זהה האם הטענה נאמרה במפורש על ידי הכותב (SELF_REPORTED) או שהיא תצפית/עובדה ישירה (OBSERVED).

מבנה ה-JSON הנדרש:
{
  "candidateEntities": [
    {
      "name": "שם הישות כפי שמופיע בטקסט",
      "typeHint": "PERSON | PLACE | ORGANIZATION | PROJECT | CONCEPT | OBJECT | OTHER"
    }
  ],
  "candidateEvents": [
    {
      "title": "תיאור קצר של האירוע",
      "participants": ["שמות ישויות שהשתתפו"],
      "timeHint": "זמן אם צוין, אחרת null"
    }
  ],
  "candidateClaims": [
    {
      "subject": "שם הנושא / הישות",
      "rawPredicate": "הניסוח הגולמי של הקשר/פעולה/השפעה",
      "object": "שם המושא / הישות או ערך טקסטואלי",
      "quote": "ציטוט מדויק מתוך רשומת היומן המבסס טענה זו",
      "epistemicStatus": "SELF_REPORTED | OBSERVED"
    }
  ]
}
"""

class CandidateExtractor:
    def __init__(self, model_client=None):
        self.model_client = model_client

    def build_prompt(self, entry_text: str, entry_date: Optional[str] = None) -> str:
        date_str = f" (תאריך רשומה: {entry_date})" if entry_date else ""
        return f"{CANDIDATE_EXTRACTION_SYSTEM_PROMPT}\n\nרשומת יומן לעיבוד{date_str}:\n---\n{entry_text}\n---\n\nהחזר פלט JSON תקין בלבד."
