import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw, Check, X, Sparkles, Scale, BookOpen, Layers } from 'lucide-react';
import { 
  fetchUserDecisions, 
  fetchUserPredictions, 
  fetchUserOutcomes, 
  confirmOutcomeMatch,
  fetchEpistemicCandidates,
  resolveEpistemicCandidate
} from '../firebase';

export default function EpistemicHealthModal({ 
  isOpen, 
  onClose, 
  uid, 
  entries = [], 
  graphNodes = [], 
  v2RawData = null 
}) {
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [epistemicCandidates, setEpistemicCandidates] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    if (isOpen && uid) {
      loadEpistemicData();
    }
  }, [isOpen, uid]);

  const loadEpistemicData = async () => {
    setLoading(true);
    try {
      const [decs, preds, outs, cands] = await Promise.all([
        fetchUserDecisions(uid),
        fetchUserPredictions(uid),
        fetchUserOutcomes(uid),
        fetchEpistemicCandidates(uid)
      ]);

      setDecisions(decs || []);
      setPredictions(preds || []);
      setOutcomes(outs || []);
      setEpistemicCandidates(cands || []);
    } catch (err) {
      console.error("Failed to load epistemic data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamically detect passive matches between open predictions and entries
  const passiveMatches = useMemo(() => {
    const matches = [];

    // Add candidates from Firestore
    epistemicCandidates
      .filter(c => c.status === 'PENDING' || !c.status)
      .forEach(c => {
        matches.push({
          id: c.id,
          isCandidateDoc: true,
          decisionId: c.decisionId,
          predictionId: c.predictionId,
          decisionTitle: c.decisionTitle || c.title || 'אירוע אפיסטמי מהיומן',
          predictionText: c.predictionText || c.text || '',
          entryDate: c.entryDate || c.observedAt || '',
          entrySnippet: c.quote || c.entrySnippet || c.text || '',
          suggestedStatus: c.suggestedStatus || 'FULL',
          confidence: c.confidence || 0.85
        });
      });

    // Also scan open predictions against recent entries client-side
    const openPreds = predictions.filter(p => p.empiricalStatus === 'UNTESTED' || p.status === 'pending');
    if (openPreds.length > 0 && entries.length > 0) {
      openPreds.forEach(pred => {
        const pText = (pred.predictionText || pred.expectedOutcome || '').toLowerCase();
        if (pText.length < 5) return;

        const stopwords = new Set(['את', 'של', 'על', 'עם', 'זה', 'היה', 'מה', 'מי', 'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי']);
        const tokens = pText.replace(/[^\w\s\u0590-\u05FF]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));
        if (tokens.length === 0) return;

        entries.forEach(entry => {
          const eContent = (entry.content || entry.transcript || '').toLowerCase();
          const matchCount = tokens.filter(tok => eContent.includes(tok)).length;
          const ratio = matchCount / tokens.length;

          if (ratio >= 0.5 && matchCount >= 2) {
            // Find relevant sentence
            const sentences = (entry.content || entry.transcript || '').split(/[.\n!?]+/);
            const matchingSentence = sentences.find(s => tokens.some(t => s.toLowerCase().includes(t))) || sentences[0];

            const alreadyExists = matches.some(m => m.predictionId === pred.id && m.entryDate === entry.date);
            if (!alreadyExists) {
              matches.push({
                id: `passive_${pred.id}_${entry.id}`,
                isCandidateDoc: false,
                decisionId: pred.decisionId,
                predictionId: pred.id,
                decisionTitle: pred.title || 'תחזית במעקב',
                predictionText: pred.predictionText || pred.expectedOutcome,
                entryDate: entry.date || entry.frontmatter?.date || '',
                entrySnippet: matchingSentence.trim().slice(0, 180),
                suggestedStatus: 'FULL',
                confidence: Math.min(0.95, 0.6 + ratio * 0.35)
              });
            }
          }
        });
      });
    }

    return matches.slice(0, 5);
  }, [epistemicCandidates, predictions, entries]);

  const handleConfirmMatch = async (match) => {
    setConfirmingId(match.id);
    try {
      if (match.isCandidateDoc) {
        await resolveEpistemicCandidate(uid, match.id, 'APPROVED', {
          matchedExpectation: match.suggestedStatus
        });
      }

      await confirmOutcomeMatch(uid, {
        decisionId: match.decisionId,
        predictionId: match.predictionId,
        actualOutcome: match.entrySnippet,
        observedAt: match.entryDate || new Date().toISOString().split('T')[0],
        matchedExpectation: match.suggestedStatus
      });

      setOutcomes(prev => [...prev, {
        id: `out_${Date.now()}`,
        decisionId: match.decisionId,
        predictionId: match.predictionId,
        actualOutcome: match.entrySnippet,
        matchedExpectation: match.suggestedStatus,
        observedAt: match.entryDate || new Date().toISOString().split('T')[0]
      }]);

      setEpistemicCandidates(prev => prev.filter(c => c.id !== match.id));
    } catch (err) {
      console.error("Error confirming match:", err);
      alert("שגיאה באישור התוצאה: " + err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDismissMatch = async (match) => {
    if (match.isCandidateDoc) {
      try {
        await resolveEpistemicCandidate(uid, match.id, 'DISMISSED');
      } catch (err) {
        console.warn("Dismiss candidate warning:", err);
      }
    }
    setEpistemicCandidates(prev => prev.filter(c => c.id !== match.id));
  };

  if (!isOpen) return null;

  // Real Epistemic Health Calculations (Zero Mock)
  const openDecisionsCount = decisions.filter(d => d.status === 'ACTIVE' || !d.status).length;
  const untestedPredsCount = predictions.filter(p => p.empiricalStatus === 'UNTESTED' || p.status === 'pending').length;
  const supportedPredsCount = predictions.filter(p => p.empiricalStatus === 'SUPPORTED').length;
  const totalTested = predictions.filter(p => p.empiricalStatus && p.empiricalStatus !== 'UNTESTED' && p.status !== 'pending').length;
  const calibrationRate = totalTested > 0 ? Math.round((supportedPredsCount / totalTested) * 100) : null;

  // Grounding Ratio: proportion of graph nodes verified by quotes / stances
  const groundedNodesCount = graphNodes.filter(n => 
    (n.sourceQuotes && n.sourceQuotes.length > 0) || 
    (n.stances && n.stances.length > 0) || 
    n.isManual
  ).length;
  const groundingPercentage = graphNodes.length > 0 
    ? Math.round((groundedNodesCount / graphNodes.length) * 100) 
    : 100;

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
        maxWidth: '880px',
        width: '100%',
        maxHeight: '90vh',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '20px',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
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
              width: '42px',
              height: '42px',
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
                מעקב רציף אחר החלטות, כיול תחזיות מול מציאות ועיגון טענות בעובדות יומן.
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
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Key Metrics Cards (Zero Mock) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>החלטות מתועדות</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>{decisions.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>{openDecisionsCount} פעילות כרגע</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>תחזיות ממתינות</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>{untestedPredsCount}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>ממתינות לסגירת לולאה</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>תוצאות שנצפו</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>{outcomes.length}</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>לולאות סגורות ומאומתות</div>
            </div>

            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>עיגון ראיות בגרף</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>{groundingPercentage}%</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>צמתים עם ציטוט/עמדה</div>
            </div>
          </div>

          {/* Passive Outcome Matches Banner */}
          {passiveMatches.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '16px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#c7d2fe' }}>
                  זוהו תוצאות או מועמדים לאימות מהיומן ({passiveMatches.length})
                </h3>
              </div>

              {passiveMatches.map(match => (
                <div key={match.id} style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>החלטה/תחזית: </span>
                      <strong style={{ fontSize: '0.85rem', color: '#f1f5f9' }}>{match.decisionTitle}</strong>
                    </div>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '12px' }}>
                      התאמה: {Math.round(match.confidence * 100)}%
                    </span>
                  </div>

                  {match.predictionText && (
                    <div style={{ fontSize: '0.8rem', color: '#a5b4fc' }}>
                      🎯 ציפייה מראש: {match.predictionText}
                    </div>
                  )}

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', borderRight: '3px solid #818cf8' }}>
                    "{match.entrySnippet}"
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
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
                      onClick={() => handleDismissMatch(match)}
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
              החלטות מתועדות ומעקב תוצאות אמת
            </h3>

            {decisions.length === 0 ? (
              <div style={{
                background: '#1e293b',
                padding: '24px',
                borderRadius: '14px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.88rem'
              }}>
                <Scale size={32} style={{ color: '#818cf8', margin: '0 auto 10px auto' }} />
                <div>עדיין לא נרשמו החלטות רשמיות במערכת.</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  פתח את מראת ההחלטות (Decision Mirror) כדי לתעד החלטה, או השתמש בסורק היומנים לאיתור התחייבויות מהעבר.
                </div>
              </div>
            ) : (
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

                      {dec.chosenOption && (
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                          <span style={{ color: '#94a3b8' }}>הבחירה שנבחרה: </span>
                          <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{dec.chosenOption}</span>
                        </div>
                      )}

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
                      {(decPreds.length > 0 || decOuts.length > 0) && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {decPreds.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ color: '#94a3b8' }}>
                                🎯 ציפייה: {p.predictionText || p.expectedOutcome} {p.probability ? `(${Math.round(p.probability * 100)}%)` : ''}
                              </span>
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
                              ✓ תוצאה שנצפתה: {o.actualOutcome} ({o.observedAt})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
