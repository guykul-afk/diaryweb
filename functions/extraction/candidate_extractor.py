import os
import re
import json
import uuid
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("candidate_extractor")

CANDIDATE_EXTRACTION_SYSTEM_PROMPT = """אתה עוזר חילוץ ידע אפיסטמי ומבני מדויק עבור יומן אישי (Epistemic Diary Knowledge Extractor).
תפקידך לחלץ החלטות משתמעות, תחזיות, מחויבויות, מועמדים לאונטולוגיה (ערכים, כללים, דפוסים, פחדים), וישויות מתוך רשומת יומן באופן נאמן למקור.

עקרונות חילוץ קריטיים:
1. נאמנות מוחלטת לטקסט: אל תמציא פרטים שלא מופיעים בטקסט.
2. ציטוט חובה (quote): לכל החלטה, תחזית, מחויבות או מועמד לאונטולוגיה חובה לספק ציטוט מדויק מתוך הרשומה.
3. זיהוי החלטות משתמעות (Implicit Decisions): זהה החלטות שהתקבלו ברשומה, גם אם נוסחו כ"הבנתי שצריך...", "סגרתי ש...", "החלטתי ל...".
4. זיהוי תחזיות (Predictions): הערכות עתידיות לגבי תוצאות של פעולות או אירועים חיצוניים.
5. זיהוי מועמדים לאונטולוגיה (Ontology Candidates): מושגים עקרוניים, ערכים, כללים אישיים, פחדים חוזרים, או דפוסי התנהגות שראוי שיישמרו כצמתים בגרף הידע.

החזר פלט JSON תקין בלבד במבנה הבא:
{
  "implicitDecisions": [
    {
      "title": "תיאור קצר ותמציתי של ההחלטה בעברית (עד 6 מילים)",
      "chosenOption": "האפשרות שנבחרה או כיוון הפעולה",
      "rationale": "הנימוק או הסיבה לבחירה כפי שמתוארת בטקסט",
      "quote": "ציטוט מדויק מרשומת היומן",
      "confidence": 0.85,
      "status": "MADE"
    }
  ],
  "predictions": [
    {
      "predictionText": "מה צפוי לקרות להערכת הכותב",
      "expectedDirection": "POSITIVE | NEGATIVE | NEUTRAL",
      "timeHorizon": "טווח זמן משוער (למשל: שבוע, חודש, חצי שנה, תאריך ספציפי או null)",
      "probability": 0.7,
      "quote": "ציטוט מדויק מהטקסט",
      "successCriteria": "מה ייחשב כהתממשות התחזית",
      "failureCriteria": "מה ייחשב כהפרכת התחזית"
    }
  ],
  "commitments": [
    {
      "commitmentText": "המחויבות או ההבטחה שניתנה",
      "towards": "כלפי מי המחויבות (עצמי / משפחה / עבודה / אחר)",
      "quote": "ציטוט מדויק מהטקסט",
      "deadline": "מועד יעד אם צוין, אחרת null"
    }
  ],
  "ontologyCandidates": [
    {
      "name": "שם המושג / הערך / הכלל / הדפוס (1-3 מילים)",
      "typeHint": "Value | Goal | Fear | Rule | Pattern | Project | Person | Strategy",
      "definition": "הסבר קצר על המושג בהקשר של הכותב",
      "suggestedRelation": "משפיע_על | שואף_ל | חלק_מ | מחזק | מחליש | סותר | קשור_ל",
      "relatedTo": "שם ישות/מושג קשור (או null)",
      "quote": "ציטוט מדויק מהטקסט המבסס מועמד זה"
    }
  ],
  "candidateEntities": [
    {
      "name": "שם הישות כפי שמופיע בטקסט",
      "typeHint": "PERSON | PLACE | ORGANIZATION | PROJECT | CONCEPT | OBJECT | OTHER"
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

    def extract(
        self,
        entry_text: str,
        entry_date: Optional[str] = None,
        entry_id: Optional[str] = None,
        client=None,
        model: str = "gemini-3.5-flash-lite"
    ) -> Dict[str, Any]:
        """
        Extracts epistemic candidates (decisions, predictions, commitments, ontology candidates)
        from a single diary entry using Gemini 3.5 Flash Lite or model_client.
        """
        if not entry_text or not entry_text.strip():
            return self._empty_result()

        active_client = client or self.model_client
        if active_client is None:
            try:
                from google import genai
                api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                if api_key:
                    active_client = genai.Client(api_key=api_key)
            except Exception as e:
                logger.warning(f"Could not initialize genai.Client: {e}")

        prompt_str = self.build_prompt(entry_text, entry_date)

        if active_client:
            try:
                from google.genai import types
                config = types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    max_output_tokens=4096,
                    thinking_config=types.ThinkingConfig(thinking_budget=0)
                )
                response = active_client.models.generate_content(
                    model=model,
                    contents=prompt_str,
                    config=config
                )
                raw_text = response.text or "{}"
                clean_json = raw_text.strip().strip("`").replace("json\n", "")
                result = json.loads(clean_json)
                return self._post_process(result, entry_id=entry_id, entry_date=entry_date)
            except Exception as e:
                logger.error(f"AI extraction failed for entry {entry_id}: {e}. Falling back to heuristic.")

        # Heuristic fallback if LLM is unavailable
        return self._heuristic_extract(entry_text, entry_date, entry_id)

    def extract_from_entries_batch(
        self,
        entries: List[Dict[str, Any]],
        client=None,
        model: str = "gemini-3.5-flash-lite"
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extracts epistemic items from multiple entries and consolidates them.
        """
        all_decisions = []
        all_predictions = []
        all_commitments = []
        all_ontology = []
        all_entities = []
        all_claims = []

        for entry in entries:
            entry_id = entry.get("id") or str(uuid.uuid4())
            date_str = entry.get("date") or entry.get("frontmatter", {}).get("date") or str(entry.get("timestamp", ""))
            content = entry.get("content") or entry.get("transcript") or ""
            if not content:
                continue

            extracted = self.extract(content, entry_date=date_str, entry_id=entry_id, client=client, model=model)
            all_decisions.extend(extracted.get("implicitDecisions", []))
            all_predictions.extend(extracted.get("predictions", []))
            all_commitments.extend(extracted.get("commitments", []))
            all_ontology.extend(extracted.get("ontologyCandidates", []))
            all_entities.extend(extracted.get("candidateEntities", []))
            all_claims.extend(extracted.get("candidateClaims", []))

        return {
            "implicitDecisions": all_decisions,
            "predictions": all_predictions,
            "commitments": all_commitments,
            "ontologyCandidates": all_ontology,
            "candidateEntities": all_entities,
            "candidateClaims": all_claims
        }

    def _post_process(self, data: Dict[str, Any], entry_id: Optional[str] = None, entry_date: Optional[str] = None) -> Dict[str, Any]:
        """Enriches extracted items with IDs, dates, and origin markers."""
        res = self._empty_result()
        for key in res.keys():
            items = data.get(key, [])
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        if "id" not in item:
                            item["id"] = f"{key[:4]}_{uuid.uuid4().hex[:8]}"
                        if entry_id:
                            item["entryId"] = entry_id
                            item["sourceEntryId"] = entry_id
                        if entry_date:
                            item["entryDate"] = entry_date
                            item["recordedAt"] = entry_date
                        res[key].append(item)
        return res

    def _empty_result(self) -> Dict[str, List[Any]]:
        return {
            "implicitDecisions": [],
            "predictions": [],
            "commitments": [],
            "ontologyCandidates": [],
            "candidateEntities": [],
            "candidateClaims": []
        }

    def _heuristic_extract(self, text: str, entry_date: Optional[str] = None, entry_id: Optional[str] = None) -> Dict[str, Any]:
        """Simple regex heuristic fallback when offline."""
        res = self._empty_result()
        sentences = re.split(r'[.\n!?]+', text)
        
        decision_signals = ['החלטתי', 'סיכמתי', 'בחרתי', 'הגעתי למסקנה', 'סגרנו']
        prediction_signals = ['מעריך ש', 'בטח יקרה', 'אם אעשה', 'תוך שבוע', 'תוך חודש', 'הצפי הוא']
        commitment_signals = ['התחייבתי', 'אני חייב', 'מבטיח', 'חייב לסיים']

        for s in sentences:
            s_clean = s.strip()
            if not s_clean or len(s_clean) < 8:
                continue

            for sig in decision_signals:
                if sig in s_clean:
                    res["implicitDecisions"].append({
                        "id": f"dec_{uuid.uuid4().hex[:8]}",
                        "title": s_clean[:50],
                        "chosenOption": s_clean,
                        "rationale": "נלמד מטקסט היומן",
                        "quote": s_clean,
                        "confidence": 0.65,
                        "status": "MADE",
                        "entryId": entry_id or "",
                        "entryDate": entry_date or ""
                    })
                    break

            for sig in prediction_signals:
                if sig in s_clean:
                    res["predictions"].append({
                        "id": f"pred_{uuid.uuid4().hex[:8]}",
                        "predictionText": s_clean,
                        "expectedDirection": "POSITIVE",
                        "timeHorizon": "משוער",
                        "probability": 0.6,
                        "quote": s_clean,
                        "successCriteria": s_clean,
                        "failureCriteria": "ההפך ממה שצויין",
                        "entryId": entry_id or "",
                        "entryDate": entry_date or ""
                    })
                    break

            for sig in commitment_signals:
                if sig in s_clean:
                    res["commitments"].append({
                        "id": f"comm_{uuid.uuid4().hex[:8]}",
                        "commitmentText": s_clean,
                        "towards": "עצמי",
                        "quote": s_clean,
                        "deadline": None,
                        "entryId": entry_id or "",
                        "entryDate": entry_date or ""
                    })
                    break

        return res
