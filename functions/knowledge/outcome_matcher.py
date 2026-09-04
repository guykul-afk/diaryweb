import re
import time
from typing import List, Dict, Any, Optional
from .decisions import DecisionRecord, Prediction, OutcomeEvent, EmpiricalStatus

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
    Scans journal entries against open predictions to propose passive outcome closures
    without requiring tedious manual linking.
    """
    def __init__(self, min_confidence_threshold: float = 0.6):
        self.min_confidence_threshold = min_confidence_threshold

    def extract_keywords(self, text: str) -> List[str]:
        if not text:
            return []
        cleaned = re.sub(r'[^\w\s\u0590-\u05FF]', ' ', text.lower())
        words = [w for w in cleaned.split() if len(w) > 2]
        stopwords = {'את', 'של', 'על', 'עם', 'זה', 'זהו', 'היה', 'היו', 'היא', 'הוא', 'מה', 'מי', 'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי', 'לו', 'לה', 'שלי', 'שלו', 'שלה'}
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

    def find_pending_outcome_candidates(
        self,
        open_predictions: List[Prediction],
        decisions_map: Dict[str, DecisionRecord],
        entries: List[Dict[str, Any]]
    ) -> List[OutcomeMatchCandidate]:
        candidates = []

        for pred in open_predictions:
            if pred.empiricalStatus != EmpiricalStatus.UNTESTED.value:
                continue
            
            decision = decisions_map.get(pred.decisionId)
            decision_title = decision.title if decision else "החלטה ללא כותרת"
            pred_keywords = self.extract_keywords(f"{decision_title} {pred.predictionText} {pred.successCriteria} {pred.failureCriteria}")

            for entry in entries:
                entry_id = entry.get("id", "")
                entry_date = entry.get("frontmatter", {}).get("date", "")
                content = entry.get("content", "")
                
                if not content:
                    continue

                entry_keywords = self.extract_keywords(content)
                overlap = self.compute_overlap_score(pred_keywords, entry_keywords)

                # Heuristic signal booster for outcome indicator words
                outcome_signals = ['בסוף', 'הסתבר', 'יצא ש', 'התוצאה', 'הצליח', 'נכשל', 'סגרנו', 'הוחלט שוב', 'בדיעבד', 'התברר', 'התממש']
                has_signal = any(sig in content for sig in outcome_signals)
                if has_signal:
                    overlap *= 1.3

                if overlap >= self.min_confidence_threshold:
                    snippet = content[:200] + "..." if len(content) > 200 else content
                    status = "FULL" if "הצליח" in content or "התממש" in content else ("FAILED" if "נכשל" in content or "לא הצליח" in content else "PARTIAL")

                    candidate = OutcomeMatchCandidate(
                        decision_id=pred.decisionId,
                        prediction_id=pred.id,
                        prediction_text=pred.predictionText,
                        decision_title=decision_title,
                        entry_id=entry_id,
                        entry_date=entry_date,
                        matched_text_snippet=snippet,
                        match_confidence=min(overlap, 0.98),
                        proposed_match_status=status,
                        reasoning=f"זוהתה התאמה מילולית וסמנטית גבוהה ברשומה מתאריך {entry_date}"
                    )
                    candidates.append(candidate)

        return candidates


class DecisionMirrorEngine:
    """
    Ranks past decisions, assumptions, and outcomes to construct a Precedent Mirror
    when facing a new dilemma.
    """
    @staticmethod
    def retrieve_precedents(
        dilemma_text: str,
        past_decisions: List[DecisionRecord],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        if not dilemma_text or not past_decisions:
            return []

        matcher = PassiveOutcomeMatcher()
        dilemma_kw = matcher.extract_keywords(dilemma_text)

        scored = []
        for dec in past_decisions:
            text_corpus = f"{dec.title} {dec.chosenOption} {dec.rationale} {' '.join(dec.assumptions)} {' '.join(dec.expectedOutcomes)}"
            dec_kw = matcher.extract_keywords(text_corpus)
            score = matcher.compute_overlap_score(dilemma_kw, dec_kw)
            
            # Boost score if decision has verified outcomes (more valuable learning precedent)
            if dec.outcomes:
                score *= 1.25

            scored.append((score, dec))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_results = scored[:top_k]

        precedents = []
        for score, dec in top_results:
            if score > 0.05:  # filter completely irrelevant
                precedents.append({
                    "relevanceScore": round(score, 2),
                    "decision": dec.to_dict(),
                    "outcomesSummary": [
                        {
                            "actualOutcome": o.actualOutcome,
                            "matchedExpectation": o.matchedExpectation,
                            "observedAt": o.observedAt
                        } for o in dec.outcomes
                    ],
                    "assumptionsTested": dec.assumptions
                })

        return precedents
