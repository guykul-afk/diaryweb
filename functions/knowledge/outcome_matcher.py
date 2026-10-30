import os
import re
import json
import time
import logging
from typing import List, Dict, Any, Optional, Union
from .decisions import DecisionRecord, Prediction, OutcomeEvent, EmpiricalStatus

logger = logging.getLogger("outcome_matcher")

class OutcomeMatchCandidate:
    def __init__(
        self,
        decision_id: str,
        prediction_id: str,
        prediction_text: str,
        decision_title: str,
        entry_id: str,
        entry_date: str,
        matched_text_snippet: str,
        match_confidence: float,
        proposed_match_status: str = "PARTIAL", # FULL | PARTIAL | FAILED | UNEXPECTED
        reasoning: str = ""
    ):
        self.decision_id = decision_id
        self.prediction_id = prediction_id
        self.prediction_text = prediction_text
        self.decision_title = decision_title
        self.entry_id = entry_id
        self.entry_date = entry_date
        self.matched_text_snippet = matched_text_snippet
        self.match_confidence = match_confidence
        self.proposed_match_status = proposed_match_status
        self.reasoning = reasoning

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decisionId": self.decision_id,
            "predictionId": self.prediction_id,
            "predictionText": self.prediction_text,
            "decisionTitle": self.decision_title,
            "entryId": self.entry_id,
            "entryDate": self.entry_date,
            "matchedTextSnippet": self.matched_text_snippet,
            "matchConfidence": round(self.match_confidence, 2),
            "proposedMatchStatus": self.proposed_match_status,
            "reasoning": self.reasoning
        }

class PassiveOutcomeMatcher:
    """
    Scans journal entries against open predictions and decisions to propose passive outcome closures
    without requiring tedious manual linking.
    """
    def __init__(self, min_confidence_threshold: float = 0.5):
        self.min_confidence_threshold = min_confidence_threshold

    def extract_keywords(self, text: str) -> List[str]:
        if not text:
            return []
        cleaned = re.sub(r'[^\w\s\u0590-\u05FF]', ' ', str(text).lower())
        words = [w for w in cleaned.split() if len(w) > 2]
        stopwords = {
            'את', 'של', 'על', 'עם', 'זה', 'זהו', 'היה', 'היו', 'היא', 'הוא', 'מה', 'מי',
            'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי', 'לו', 'לה', 'שלי', 'שלו', 'שלה',
            'שם', 'פה', 'כבר', 'עוד', 'יותר', 'פחות', 'מאוד', 'טוב', 'הזה', 'הזאת', 'אלה', 'אלו'
        }
        return [w for w in words if w not in stopwords]

    def compute_overlap_score(self, query_keywords: List[str], target_keywords: List[str]) -> float:
        if not query_keywords or not target_keywords:
            return 0.0
        set_q = set(query_keywords)
        set_t = set(target_keywords)
        intersection = set_q.intersection(set_t)
        if not intersection:
            return 0.0
        return len(intersection) / (len(set_q) ** 0.5 * len(set_t) ** 0.5)

    def _resolve_pred_field(self, pred: Any, field: str, default: Any = "") -> Any:
        if isinstance(pred, dict):
            return pred.get(field, default)
        return getattr(pred, field, default)

    def _resolve_decision_field(self, dec: Any, field: str, default: Any = "") -> Any:
        if not dec:
            return default
        if isinstance(dec, dict):
            return dec.get(field, default)
        return getattr(dec, field, default)

    def find_pending_outcome_candidates(
        self,
        open_predictions: List[Union[Prediction, Dict[str, Any]]],
        decisions_map: Dict[str, Union[DecisionRecord, Dict[str, Any]]],
        entries: List[Dict[str, Any]]
    ) -> List[OutcomeMatchCandidate]:
        candidates = []

        for pred in open_predictions:
            empirical_status = self._resolve_pred_field(pred, "empiricalStatus", EmpiricalStatus.UNTESTED.value)
            if empirical_status != EmpiricalStatus.UNTESTED.value:
                continue
            
            decision_id = self._resolve_pred_field(pred, "decisionId", "")
            pred_id = self._resolve_pred_field(pred, "id", "")
            pred_text = self._resolve_pred_field(pred, "predictionText", "")
            success_crit = self._resolve_pred_field(pred, "successCriteria", "")
            fail_crit = self._resolve_pred_field(pred, "failureCriteria", "")

            decision = decisions_map.get(decision_id)
            decision_title = self._resolve_decision_field(decision, "title", "החלטה ללא כותרת")
            pred_keywords = self.extract_keywords(f"{decision_title} {pred_text} {success_crit} {fail_crit}")

            for entry in entries:
                entry_id = entry.get("id", "")
                entry_date = entry.get("date") or entry.get("frontmatter", {}).get("date", "") or str(entry.get("timestamp", ""))
                content = entry.get("content") or entry.get("transcript") or ""
                
                if not content:
                    continue

                entry_keywords = self.extract_keywords(content)
                overlap = self.compute_overlap_score(pred_keywords, entry_keywords)

                # Heuristic signal booster for outcome indicator words
                outcome_signals = ['בסוף', 'הסתבר', 'יצא ש', 'התוצאה', 'הצליח', 'נכשל', 'סגרנו', 'הוחלט שוב', 'בדיעבד', 'התברר', 'התממש', 'עבד', 'לא עבד']
                has_signal = any(sig in content for sig in outcome_signals)
                if has_signal:
                    overlap *= 1.35

                if overlap >= self.min_confidence_threshold:
                    snippet = content[:250] + "..." if len(content) > 250 else content
                    status = "FULL" if ("הצליח" in content or "התממש" in content or "עבד" in content) else ("FAILED" if ("נכשל" in content or "לא הצליח" in content or "לא עבד" in content) else "PARTIAL")

                    candidate = OutcomeMatchCandidate(
                        decision_id=decision_id,
                        prediction_id=pred_id,
                        prediction_text=pred_text,
                        decision_title=decision_title,
                        entry_id=entry_id,
                        entry_date=entry_date,
                        matched_text_snippet=snippet,
                        match_confidence=min(overlap, 0.98),
                        proposed_match_status=status,
                        reasoning=f"זוהתה התאמה מילולית וסמנטית ברשומה מתאריך {entry_date}"
                    )
                    candidates.append(candidate)

        return candidates

    def find_pending_outcome_candidates_with_ai(
        self,
        open_predictions: List[Union[Prediction, Dict[str, Any]]],
        decisions_map: Dict[str, Union[DecisionRecord, Dict[str, Any]]],
        entries: List[Dict[str, Any]],
        client=None,
        model: str = "gemini-3.5-flash-lite"
    ) -> List[OutcomeMatchCandidate]:
        """
        Uses preliminary keyword filter, then verifies top candidates using Gemini 3.5 Flash Lite
        for high accuracy outcome detection.
        """
        preliminary = self.find_pending_outcome_candidates(open_predictions, decisions_map, entries)
        if not preliminary:
            return []

        active_client = client
        if active_client is None:
            try:
                from google import genai
                api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                if api_key:
                    active_client = genai.Client(api_key=api_key)
            except Exception as e:
                logger.warning(f"PassiveOutcomeMatcher: genai client unavailable: {e}")

        if not active_client:
            return preliminary

        verified_candidates = []
        from google.genai import types

        for cand in preliminary[:8]: # limit to top 8 candidates to avoid high latency
            try:
                prompt = f"""אתה מומחה לאימות תוצאות של החלטות ותחזיות מתוך יומן אישי.
האם קטע היומן הבא מאשר, מפריך, או סוגר חלקית את התחזית/החלטה?

החלטה: {cand.decision_title}
תחזית: {cand.prediction_text}
קטע יומן (תאריך: {cand.entry_date}):
\"\"\"{cand.matched_text_snippet}\"\"\"

החזר JSON במבנה:
{{
  "isOutcomeMatch": true/false,
  "matchStatus": "FULL" | "PARTIAL" | "FAILED" | "UNEXPECTED",
  "confidence": 0.0-1.0,
  "reasoningHe": "הסבר בעברית",
  "quote": "ציטוט מדויק המעיד על התוצאה"
}}
"""
                resp = active_client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                        thinking_config=types.ThinkingConfig(thinking_budget=0)
                    )
                )
                raw_json = (resp.text or "{}").strip().strip("`").replace("json\n", "")
                res_data = json.loads(raw_json)
                if res_data.get("isOutcomeMatch", False):
                    cand.proposed_match_status = res_data.get("matchStatus", cand.proposed_match_status)
                    cand.match_confidence = float(res_data.get("confidence", cand.match_confidence))
                    cand.reasoning = res_data.get("reasoningHe", cand.reasoning)
                    if res_data.get("quote"):
                        cand.matched_text_snippet = res_data.get("quote")
                    verified_candidates.append(cand)
            except Exception as e:
                logger.error(f"AI outcome verification failed for cand {cand.prediction_id}: {e}")
                verified_candidates.append(cand)

        return verified_candidates if verified_candidates else preliminary


class DecisionMirrorEngine:
    """
    Ranks past decisions, assumptions, and outcomes to construct a Precedent Mirror
    when facing a new dilemma.
    """
    @staticmethod
    def retrieve_precedents(
        dilemma_text: str,
        past_decisions: List[Union[DecisionRecord, Dict[str, Any]]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        if not dilemma_text or not past_decisions:
            return []

        matcher = PassiveOutcomeMatcher(min_confidence_threshold=0.1)
        dilemma_kw = matcher.extract_keywords(dilemma_text)

        scored = []
        for dec in past_decisions:
            if isinstance(dec, dict):
                title = dec.get("title", "")
                chosen = dec.get("chosenOption", "")
                rationale = dec.get("rationale", "")
                assumptions = dec.get("assumptions", []) or []
                expected = dec.get("expectedOutcomes", []) or []
                outcomes = dec.get("outcomes", []) or []
                dec_dict = dec
            else:
                title = getattr(dec, "title", "")
                chosen = getattr(dec, "chosenOption", "")
                rationale = getattr(dec, "rationale", "")
                assumptions = getattr(dec, "assumptions", []) or []
                expected = getattr(dec, "expectedOutcomes", []) or []
                outcomes = getattr(dec, "outcomes", []) or []
                dec_dict = dec.to_dict()

            text_corpus = f"{title} {chosen} {rationale} {' '.join(assumptions)} {' '.join(expected)}"
            dec_kw = matcher.extract_keywords(text_corpus)
            score = matcher.compute_overlap_score(dilemma_kw, dec_kw)
            
            # Boost score if decision has verified outcomes (more valuable learning precedent)
            if outcomes:
                score *= 1.35

            scored.append((score, dec_dict, assumptions, outcomes))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_results = scored[:top_k]

        precedents = []
        for score, dec_dict, assumptions, outcomes in top_results:
            if score > 0.03:  # filter completely irrelevant
                outcomes_summary = []
                for o in outcomes:
                    if isinstance(o, dict):
                        outcomes_summary.append({
                            "actualOutcome": o.get("actualOutcome", ""),
                            "matchedExpectation": o.get("matchedExpectation", "PARTIAL"),
                            "observedAt": o.get("observedAt", "")
                        })
                    else:
                        outcomes_summary.append({
                            "actualOutcome": getattr(o, "actualOutcome", ""),
                            "matchedExpectation": getattr(o, "matchedExpectation", "PARTIAL"),
                            "observedAt": getattr(o, "observedAt", "")
                        })

                precedents.append({
                    "relevanceScore": round(score, 2),
                    "decision": dec_dict,
                    "outcomesSummary": outcomes_summary,
                    "assumptionsTested": assumptions
                })

        return precedents
