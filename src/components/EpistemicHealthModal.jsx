import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw, Check, X, Sparkles, Scale } from 'lucide-react';
import { fetchUserDecisions, fetchUserPredictions, fetchUserOutcomes, confirmOutcomeMatch } from '../firebase';

export default function EpistemicHealthModal({ isOpen, onClose, uid }) {
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [pendingMatches, setPendingMatches] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    if (isOpen && uid) {
      loadEpistemicData();
    }
  }, [isOpen, uid]);

  const loadEpistemicData = async () => {
    setLoading(true);
    try {
      const [decs, preds, outs] = await Promise.all([
        fetchUserDecisions(uid),
        fetchUserPredictions(uid),
        fetchUserOutcomes(uid)
      ]);

      // Demo fallback if collection is freshly initialized
      const loadedDecs = decs.length > 0 ? decs : [
        {
          id: 'dec_sample_1',
          title: 'השקת שיתוף פעולה מקצועי עם סוכנות הדיגיטל',
          chosenOption: 'חתימה על הסכם פיילוט',
          decisionDate: '2026-05-10',
          assumptions: ['שיתוף הפעולה יביא לפחות 3 לקוחות', 'העומס יהיה סביר ולא יפגע בפרויקטים קיימים'],
          status: 'ACTIVE'
        },
        {
          id: 'dec_sample_2',
          title: 'מעבר לעבודה היברידית 3 ימים מהבית',
          chosenOption: 'מעבר למודל היברידי קבוע',
          decisionDate: '2026-03-01',
          assumptions: ['הפרודוקטיביות תישאר זהה', 'איכות השינה תשתפר'],
          status: 'REVIEWED'
        }
      ];

      const loadedPreds = preds.length > 0 ? preds : [
        {
          id: 'pred_sample_1',
          decisionId: 'dec_sample_1',
          predictionText: 'השותפות תביא 3 לקוחות חדשים תוך חצי שנה',
          probability: 0.8,
          timeHorizon: '2026-11-10',
          empiricalStatus: 'UNTESTED'
        },
        {
          id: 'pred_sample_2',
          decisionId: 'dec_sample_2',
          predictionText: 'שעות השינה יעלו בממוצע ב-45 דקות',
          probability: 0.75,
          timeHorizon: '2026-06-01',
          empiricalStatus: 'SUPPORTED'
        }
      ];

      const loadedOuts = outs.length > 0 ? outs : [
        {
          id: 'out_sample_1',
          decisionId: 'dec_sample_2',
          predictionId: 'pred_sample_2',
          actualOutcome: 'עלייה ממוצעת של 52 דקות בשינה והפחתת סטרס',
          matchedExpectation: 'FULL',
          observedAt: '2026-06-15'
        }
      ];

      setDecisions(loadedDecs);
      setPredictions(loadedPreds);
      setOutcomes(loadedOuts);

      // Heuristic pending matches detection for demo
      const pending = [
        {
          id: 'candidate_match_1',
          decisionId: 'dec_sample_1',
          predictionId: 'pred_sample_1',
          predictionText: 'השותפות תביא 3 לקוחות חדשים תוך חצי שנה',
          decisionTitle: 'השקת שיתוף פעולה מקצועי עם סוכנות הדיגיטל',
          entryDate: '2026-08-20',
          entrySnippet: '...היום סגרנו את הלקוח השלישי שהגיע דרך השותפות! ההסכם מוכיח את עצמו מעל ומעבר...',
          suggestedStatus: 'FULL',
          confidence: 0.94
        }
      ];
      setPendingMatches(pending);

    } catch (err) {
      console.error("Failed to load epistemic data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMatch = async (match) => {
    setConfirmingId(match.id);
    try {
      await confirmOutcomeMatch(uid, {
        decisionId: match.decisionId,
        predictionId: match.predictionId,
        actualOutcome: match.entrySnippet,
        observedAt: match.entryDate,
        matchedExpectation: match.suggestedStatus
      });
      setPendingMatches(prev => prev.filter(m => m.id !== match.id));
      setOutcomes(prev => [...prev, {
        id: `out_${Date.now()}`,
        decisionId: match.decisionId,
        predictionId: match.predictionId,
        actualOutcome: match.entrySnippet,
        matchedExpectation: match.suggestedStatus,
        observedAt: match.entryDate
      }]);
    } catch (err) {
      console.error("Error confirming match:", err);
      alert("שגיאה באישור התוצאה: " + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  if (!isOpen) return null;

  // Calculate health metrics
  const openDecisionsCount = decisions.filter(d => d.status === 'ACTIVE').length;
  const untestedPredsCount = predictions.filter(p => p.empiricalStatus === 'UNTESTED').length;
  const supportedPredsCount = predictions.filter(p => p.empiricalStatus === 'SUPPORTED').length;
  const totalTested = predictions.filter(p => p.empiricalStatus !== 'UNTESTED').length;
  const calibrationRate = totalTested > 0 ? Math.round((supportedPredsCount / totalTested) * 100) : 100;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      direction: 'rtl'
    }}>
      <div style={{
        maxWidth: '860px',
        width: '100%',
        maxHeight: '90vh',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '20px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                בריאות הידע ושיקול הדעת האישי (RIKMA Epistemic Health)
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                מעקב אחרי החלטות פתוחות, אימות תחזיות וסגירת לולאות מול המציאות.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Key Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>החלטות במעקב</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>{decisions.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>{openDecisionsCount} פעילות כרגע</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>תחזיות פתוחות</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>{untestedPredsCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>ממתינות לסגירת תוצאה</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>תוצאות שנצפו</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>{outcomes.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>לולאות סגורות</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>כיול תחזיות (Calibration)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>{calibrationRate}%</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>התאמת ציפייה למציאות</div>
            </div>
          </div>

          {/* Passive Outcome Matches Banner */}
          {pendingMatches.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '16px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#c7d2fe' }}>
                  זוהתה תוצאה ברשומה מאוחרת (Passive Outcome Match)
                </h3>
              </div>

              {pendingMatches.map(match => (
                <div key={match.id} style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>מתייחס להחלטה: </span>
                      <strong style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>{match.decisionTitle}</strong>
                    </div>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px' }}>
                      התאמה: {Math.round(match.confidence * 100)}%
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', borderRight: '3px solid #818cf8' }}>
                    "{match.entrySnippet}"
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button
                      onClick={() => handleConfirmMatch(match)}
                      disabled={confirmingId === match.id}
                      style={{
                        background: '#10b981',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Check size={14} />
                      {confirmingId === match.id ? 'שומר תוצאה...' : 'אשר וסגור לולאה'}
                    </button>
                    <button
                      onClick={() => setPendingMatches(prev => prev.filter(m => m.id !== match.id))}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        color: '#94a3b8',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      דלג
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Decisions & Outcomes Timeline */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: '#f8fafc' }}>
              החלטות אחרונות ומעקב תוצאות
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {decisions.map(dec => {
                const decPreds = predictions.filter(p => p.decisionId === dec.id);
                const decOuts = outcomes.filter(o => o.decisionId === dec.id);

                return (
                  <div key={dec.id} style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
                        {dec.title}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {dec.decisionDate}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <span style={{ color: '#94a3b8' }}>הבחירה: </span>
                      <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{dec.chosenOption}</span>
                    </div>

                    {/* Assumptions */}
                    {dec.assumptions && dec.assumptions.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        <span>הנחות יסוד: </span>
                        {dec.assumptions.map((asm, i) => (
                          <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', color: '#e2e8f0' }}>
                            {asm}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Predictions & Outcomes */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {decPreds.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: '#94a3b8' }}>🎯 ציפייה: {p.predictionText} ({Math.round(p.probability * 100)}%)</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: p.empiricalStatus === 'SUPPORTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: p.empiricalStatus === 'SUPPORTED' ? '#34d399' : '#fbbf24'
                          }}>
                            {p.empiricalStatus === 'SUPPORTED' ? 'אומת במציאות ✓' : 'ממתין לאימות'}
                          </span>
                        </div>
                      ))}

                      {decOuts.map(o => (
                        <div key={o.id} style={{ fontSize: '0.8rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: '8px' }}>
                          ✓ תוצאה בפועל: {o.actualOutcome} ({o.observedAt})
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
