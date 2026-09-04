import unittest
from knowledge.decisions import DecisionProblem, DecisionOption, DecisionRecord, Prediction, OutcomeEvent, EmpiricalStatus, ContradictionType
from knowledge.epistemic_confidence import TriPartConfidence, EpistemicFitnessVector, EpistemicDistance
from knowledge.assertions import Assertion, Evidence
from knowledge.outcome_matcher import PassiveOutcomeMatcher, DecisionMirrorEngine

class TestEpistemicDecisions(unittest.TestCase):
    def test_decision_record_lifecycle(self):
        pred = Prediction(
            id="pred_1",
            decisionId="dec_1",
            predictionText="הפרויקט יגיע ל-100 משתמשים תוך חודשיים",
            expectedDirection="POSITIVE",
            probability=0.85,
            timeHorizon="2026-11-01",
            successCriteria="מעל 100 משתמשים רשומים",
            failureCriteria="פחות מ-20 משתמשים",
            empiricalStatus=EmpiricalStatus.UNTESTED.value
        )
        
        outcome = OutcomeEvent(
            id="out_1",
            decisionId="dec_1",
            actualOutcome="הגיעו 140 משתמשים רשומים תוך 6 שבועות",
            observedAt="2026-10-20",
            matchedExpectation="FULL",
            predictionIds=["pred_1"],
            humanConfirmation=True
        )

        dec = DecisionRecord(
            id="dec_1",
            decisionProblemId="prob_1",
            title="השקת פיצ'ר RIKMA Self",
            chosenOption="השקה מדורגת",
            rationale="למנוע עומס ולהבטיח דיוק אפיסטמי",
            assumptions=["המשתמש ירצה לראות תחזיות", "סגירת תוצאות לא תייצר חיכוך"],
            predictions=[pred],
            outcomes=[outcome]
        )

        d_dict = dec.to_dict()
        self.assertEqual(d_dict["id"], "dec_1")
        self.assertEqual(len(d_dict["predictions"]), 1)
        self.assertEqual(len(d_dict["outcomes"]), 1)
        self.assertEqual(d_dict["predictions"][0]["probability"], 0.85)
        self.assertEqual(d_dict["outcomes"][0]["matchedExpectation"], "FULL")

        # Roundtrip deserialization
        restored = DecisionRecord.from_dict(d_dict)
        self.assertEqual(restored.title, "השקת פיצ'ר RIKMA Self")
        self.assertEqual(restored.predictions[0].timeHorizon, "2026-11-01")
        self.assertEqual(restored.outcomes[0].actualOutcome, "הגיעו 140 משתמשים רשומים תוך 6 שבועות")

    def test_tri_part_confidence_and_fitness(self):
        conf = TriPartConfidence(
            extraction_confidence=0.98,
            epistemic_strength="HIGH",
            empirical_status="SUPPORTED",
            epistemic_distance=EpistemicDistance.DIRECT_ASSERTION.value
        )
        self.assertEqual(conf.to_dict()["extractionConfidence"], 0.98)
        self.assertEqual(conf.to_dict()["empiricalStatus"], "SUPPORTED")

        fitness = EpistemicFitnessVector(
            source_support=4,
            context_fit=0.8,
            outcome_support=3,
            recency=0.9,
            counterevidence=0,
            independent_sources=2
        )
        score = fitness.calculate_composite_score()
        self.assertGreater(score, 0.7)

    def test_passive_outcome_matcher(self):
        pred = Prediction(
            id="pred_collab",
            decisionId="dec_collab",
            predictionText="שיתוף הפעולה יביא לפחות שלושה לקוחות חדשים",
            timeHorizon="2026-12-01",
            empiricalStatus=EmpiricalStatus.UNTESTED.value
        )
        dec = DecisionRecord(
            id="dec_collab",
            decisionProblemId="prob_collab",
            title="חתימה על שותפות עסקית",
            chosenOption="חתימה",
            rationale="הרחבת פעילות"
        )
        entries = [
            {
                "id": "entry_future",
                "frontmatter": {"date": "2026-10-15"},
                "content": "התברר ששיתוף הפעולה הצליח מעל המשוער! כבר הגיעו 4 לקוחות חדשים דרכם."
            }
        ]
        matcher = PassiveOutcomeMatcher(min_confidence_threshold=0.3)
        candidates = matcher.find_pending_outcome_candidates([pred], {"dec_collab": dec}, entries)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].decision_id, "dec_collab")
        self.assertEqual(candidates[0].proposed_match_status, "FULL")

    def test_decision_mirror_ranking(self):
        dec1 = DecisionRecord(
            id="dec_hire",
            decisionProblemId="prob_hire",
            title="גיוס עובד ראשון לחברה",
            chosenOption="גיוס מיידי",
            rationale="עומס משימות",
            assumptions=["התקציב יספיק ל-6 חודשים"],
            outcomes=[OutcomeEvent(id="o1", decisionId="dec_hire", actualOutcome="העובד השתלב מצוין", observedAt="2026-06-01")]
        )
        dec2 = DecisionRecord(
            id="dec_vacation",
            decisionProblemId="prob_vacation",
            title="נסיעה לחופשה ביוון",
            chosenOption="יוון",
            rationale="מנוחה"
        )
        precedents = DecisionMirrorEngine.retrieve_precedents("אני מתלבט האם לגייס עובד נוסף לצוות הפיתוח", [dec1, dec2])
        self.assertGreater(len(precedents), 0)
        self.assertEqual(precedents[0]["decision"]["id"], "dec_hire")

if __name__ == "__main__":
    unittest.main()
