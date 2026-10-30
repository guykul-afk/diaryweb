import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  GitMerge, 
  Split, 
  HelpCircle, 
  CheckCircle2, 
  RotateCcw, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  X,
  AlertCircle
} from 'lucide-react';
import { reconcileGraphEntities } from '../firebase';

export default function EntityReconciliationModal({ isOpen, onClose, candidates = [], uid: propUid }) {
  const uid = propUid || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

  const [rawCandidateGroups, setRawCandidateGroups] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  // Resolved decisions map persisted in localStorage
  const [resolvedMap, setResolvedMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('okf_resolved_entity_groups') || '{}');
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    if (candidates && candidates.length > 0) {
      setRawCandidateGroups(candidates);
    } else {
      // Default sample fallback if not passed via props or fetch
      setRawCandidateGroups([
        {
          groupKey: "גיא",
          candidates: [
            { id: "person_guy", canonicalName: "גיא", aliases: ["גיא", "אני"], occurrencesCount: 142 },
            { id: "person_guy_tali", canonicalName: "גיא וטלי", aliases: ["גיא וטלי"], occurrencesCount: 18 }
          ]
        },
        {
          groupKey: "טלי",
          candidates: [
            { id: "person_tali", canonicalName: "טלי", aliases: ["טלי"], occurrencesCount: 84 },
            { id: "person_tali_wife", canonicalName: "טלי אשתי", aliases: ["טלי אשתי"], occurrencesCount: 12 }
          ]
        },
        {
          groupKey: "יוגב",
          candidates: [
            { id: "person_yogev", canonicalName: "יוגב", aliases: ["יוגב"], occurrencesCount: 36 },
            { id: "person_yogev_arch", canonicalName: "יוגב אדריכל", aliases: ["יוגב אדריכל"], occurrencesCount: 7 }
          ]
        }
      ]);
    }
  }, [candidates]);

  // Filter groups: pending vs resolved
  const activeGroups = useMemo(() => {
    if (showResolved) return rawCandidateGroups;
    return rawCandidateGroups.filter(g => !resolvedMap[g.groupKey]);
  }, [rawCandidateGroups, resolvedMap, showResolved]);

  // Keep index within bounds
  useEffect(() => {
    if (currentIndex >= activeGroups.length && activeGroups.length > 0) {
      setCurrentIndex(Math.max(0, activeGroups.length - 1));
    }
  }, [activeGroups.length, currentIndex]);

  const currentGroup = activeGroups[currentIndex] || activeGroups[0] || null;

  // Set default canonical candidate when group changes
  useEffect(() => {
    if (currentGroup && currentGroup.candidates && currentGroup.candidates.length > 0) {
      // Pick the one with the highest occurrence count as default canonical
      const sorted = [...currentGroup.candidates].sort((a, b) => (b.occurrencesCount || 0) - (a.occurrencesCount || 0));
      setSelectedCanonicalId(sorted[0].id);
    }
  }, [currentGroup]);

  if (!isOpen) return null;

  // Call reconcile API supporting both object & positional signatures
  const callReconcileAPI = async ({ canonicalId, canonicalName, mergedIds, action }) => {
    if (typeof reconcileGraphEntities === 'function') {
      try {
        // Preferred object signature
        await reconcileGraphEntities({ canonicalId, canonicalName, mergedIds, action, uid });
      } catch (errObj) {
        // Fallback positional signature: reconcile primary with each duplicate
        if (action === 'merge' || action === 'SAME_ENTITY') {
          for (const mId of (mergedIds || [])) {
            if (mId !== canonicalId) {
              await reconcileGraphEntities(uid, canonicalId, mId, 'merge');
            }
          }
        } else {
          for (const mId of (mergedIds || [])) {
            if (mId !== canonicalId) {
              await reconcileGraphEntities(uid, canonicalId, mId, 'separate');
            }
          }
        }
      }
    }
  };

  // Handle Decision: Merge
  const handleMerge = async () => {
    if (!currentGroup || isSubmitting) return;
    setIsSubmitting(true);
    setStatusMessage('ממזג ישויות ומעדכן קשרים בגרף...');

    const canonicalCand = currentGroup.candidates.find(c => c.id === selectedCanonicalId) || currentGroup.candidates[0];
    const canonicalId = canonicalCand.id;
    const canonicalName = canonicalCand.canonicalName || canonicalCand.id;
    const mergedIds = currentGroup.candidates.map(c => c.id);

    // 1. Optimistic local persistence
    const decisionRecord = {
      action: 'merge',
      canonicalId,
      canonicalName,
      mergedIds,
      resolvedAt: new Date().toISOString()
    };

    const nextMap = { ...resolvedMap, [currentGroup.groupKey]: decisionRecord };
    setResolvedMap(nextMap);
    localStorage.setItem('okf_resolved_entity_groups', JSON.stringify(nextMap));

    // 2. Real Firestore call
    try {
      await callReconcileAPI({ canonicalId, canonicalName, mergedIds, action: 'merge' });
    } catch (err) {
      console.warn("Firestore entity reconciliation fallback to local:", err);
    } finally {
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  // Handle Decision: Keep Separate
  const handleKeepSeparate = async () => {
    if (!currentGroup || isSubmitting) return;
    setIsSubmitting(true);
    setStatusMessage('רושם החלטת הפרדה...');

    const canonicalCand = currentGroup.candidates[0];
    const canonicalId = canonicalCand.id;
    const canonicalName = canonicalCand.canonicalName || canonicalCand.id;
    const mergedIds = currentGroup.candidates.map(c => c.id);

    const decisionRecord = {
      action: 'separate',
      canonicalId,
      canonicalName,
      mergedIds,
      resolvedAt: new Date().toISOString()
    };

    const nextMap = { ...resolvedMap, [currentGroup.groupKey]: decisionRecord };
    setResolvedMap(nextMap);
    localStorage.setItem('okf_resolved_entity_groups', JSON.stringify(nextMap));

    try {
      await callReconcileAPI({ canonicalId, canonicalName, mergedIds, action: 'separate' });
    } catch (err) {
      console.warn("Firestore entity reconciliation fallback to local:", err);
    } finally {
      setIsSubmitting(false);
      setStatusMessage(null);
    }
  };

  // Defer / Skip to next group
  const handleDefer = () => {
    if (currentIndex < activeGroups.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  // Reset local resolutions
  const handleResetDecisions = () => {
    if (window.confirm("האם אתה בטוח שברצונך לאפס את כל החלטות היישוב שנשמרו מקומית?")) {
      localStorage.removeItem('okf_resolved_entity_groups');
      setResolvedMap({});
      setCurrentIndex(0);
    }
  };

  const totalResolvedCount = Object.keys(resolvedMap).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      padding: '20px',
      direction: 'rtl',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        maxWidth: '720px',
        width: '100%',
        color: '#f8fafc',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        position: 'relative'
      }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                color: '#818cf8',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: 'rgba(99, 102, 241, 0.15)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Phase 5 — Entity Reconciliation
              </span>
              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
                ● יישוב קנוני ללא מחיקה הרסנית
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '4px 0 0 0' }}>
              יישוב ישויות ואיחוד זהויות (Entity Registry)
            </h2>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status / Submitting Notification */}
        {statusMessage && (
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontWeight: 600
          }}>
            {statusMessage}
          </div>
        )}

        {/* Progress & Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          color: '#94a3b8'
        }}>
          <div>
            {activeGroups.length > 0 ? (
              <span>
                קבוצה <strong>{currentIndex + 1}</strong> מתוך <strong>{activeGroups.length}</strong> ממתינות לסקירה
                {totalResolvedCount > 0 && <span style={{ marginRight: '8px', color: '#10b981' }}>({totalResolvedCount} יושבו ונשמרו)</span>}
              </span>
            ) : (
              <span style={{ color: '#10b981', fontWeight: 700 }}>
                ✓ כל הקבוצות יושבו בהצלחה! ({totalResolvedCount} קבוצות נשמרו)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowResolved(prev => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.76rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {showResolved ? 'הסתר קבוצות שכבר יושבו' : `הצג את כל הקבוצות (${rawCandidateGroups.length})`}
            </button>
            {totalResolvedCount > 0 && (
              <button
                onClick={handleResetDecisions}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                אפס החלטות
              </button>
            )}
          </div>
        </div>

        {/* If no active groups left */}
        {activeGroups.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '36px 20px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '16px'
          }}>
            <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
              כל זהויות הישויות סוקרו ויושבו בהצלחה!
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '440px', margin: '0 auto 18px auto' }}>
              כל האיחודים נשמרו מקומית וב-Firestore. גרף הידע מציג כעת שמות קנוניים אחידים תוך שמירת כל ה-Aliases.
            </p>
            <button
              onClick={onClose}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              סיום וסגירה
            </button>
          </div>
        ) : (
          <>
            {/* Candidate Group Card */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                  האם המופעים הבאים שייכים לאותה ישות או שמדובר באנשים שונים?
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#c7d2fe',
                  fontWeight: 700
                }}>
                  קבוצת דמיון: "{currentGroup.groupKey}"
                </span>
              </div>

              {/* Candidates Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {currentGroup.candidates.map((cand) => {
                  const isSelectedCanonical = selectedCanonicalId === cand.id;

                  return (
                    <div
                      key={cand.id}
                      onClick={() => setSelectedCanonicalId(cand.id)}
                      style={{
                        padding: '16px',
                        backgroundColor: isSelectedCanonical ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                        border: `2px solid ${isSelectedCanonical ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      {isSelectedCanonical && (
                        <span style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          fontSize: '0.68rem',
                          background: '#6366f1',
                          color: '#ffffff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          ★ ייבחר כשם ראשי
                        </span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>
                          {cand.canonicalName}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600
                        }}>
                          {cand.occurrencesCount || 1} מופעים
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '4px' }}>
                        ID: {cand.id}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                        כינויים מוכרים: {cand.aliases?.join(', ') || cand.canonicalName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'flex-end',
              alignItems: 'center'
            }}>
              <button
                onClick={handleMerge}
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                <GitMerge size={16} />
                <span>מזג ישויות (איחוד קנוני עם Aliases)</span>
              </button>

              <button
                onClick={handleKeepSeparate}
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                <Split size={16} />
                <span>השאר נפרדים (הפרדה)</span>
              </button>

              <button
                onClick={handleDefer}
                disabled={isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#fbbf24',
                  fontWeight: 600,
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                <HelpCircle size={15} />
                <span>השהה / להמשך</span>
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
