import React, { useState, useMemo } from 'react';
import { ShieldCheck, GitCommit, ArrowRight, CheckCircle2, AlertCircle, BookOpen, ExternalLink, Sparkles, Scale, Layers, ChevronRight } from 'lucide-react';

export default function EpistemicTraceabilityView({ 
  insight, 
  entries = [], 
  graphNodes = [], 
  v2RawData = null, 
  onClose, 
  onNavigateToEntry 
}) {
  const [selectedAssertionId, setSelectedAssertionId] = useState(null);

  // Normalize insight text and properties
  const activeInsight = useMemo(() => {
    if (!insight) return null;
    if (typeof insight === 'string') {
      return {
        id: 'insight_text',
        text: insight,
        title: insight,
        type: 'Insight',
        epistemicStatus: 'INFERRED',
        epistemicDistance: 3
      };
    }
    return {
      id: insight.id || 'insight_active',
      title: insight.title || insight.label || insight.name || insight.text || 'תובנה ללא כותרת',
      text: insight.text || insight.content || insight.title || insight.label || '',
      type: insight.type || insight.category || 'Insight',
      epistemicStatus: insight.epistemicStatus || insight.provenanceType || 'INFERRED',
      epistemicDistance: insight.epistemicDistance !== undefined ? insight.epistemicDistance : 3,
      confidenceVector: insight.confidenceVector || {
        extractionConfidence: insight.confidence !== undefined ? insight.confidence : (insight.epistemicConfidence || 0.9),
        epistemicStrength: insight.weight >= 3 ? 'HIGH' : insight.weight >= 2 ? 'MEDIUM' : 'MODERATE',
        empiricalStatus: insight.status || insight.empiricalStatus || 'UNTESTED',
        epistemicDistance: insight.epistemicDistance || 3
      },
      decisionChain: insight.decisionChain || null,
      derivedFromAssertions: insight.derivedFromAssertions || null,
      sourceQuotes: insight.sourceQuotes || insight.evidenceQuotes || [],
      sourceEntryIds: insight.sourceEntryIds || insight.relatedEntryIds || []
    };
  }, [insight]);

  // Extract keywords to match assertions and entries
  const queryTokens = useMemo(() => {
    if (!activeInsight) return [];
    const textCorpus = `${activeInsight.title} ${activeInsight.text}`.toLowerCase();
    const stopwords = new Set(['את', 'של', 'על', 'עם', 'זה', 'היה', 'מה', 'מי', 'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי', 'לו', 'לה', 'בגלל', 'מתוך', 'אצל', 'יותר', 'פחות']);
    return textCorpus
      .replace(/[^\w\s\u0590-\u05FF]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopwords.has(w));
  }, [activeInsight]);

  // Match assertions dynamically from v2RawData or graphNodes
  const matchedAssertions = useMemo(() => {
    if (!activeInsight) return [];

    // 1. If insight already has explicit derivedFromAssertions, use them
    if (activeInsight.derivedFromAssertions && activeInsight.derivedFromAssertions.length > 0) {
      return activeInsight.derivedFromAssertions;
    }

    const assertions = [];
    const seenAssertionKeys = new Set();

    // 2. Check v2RawData.assertions if available
    if (v2RawData?.assertions && Array.isArray(v2RawData.assertions)) {
      v2RawData.assertions.forEach(ast => {
        const sub = (ast.subject || ast.subjectName || '').toLowerCase();
        const pred = (ast.predicate || ast.relation || '').toLowerCase();
        const obj = (ast.object || ast.objectName || '').toLowerCase();
        const matches = queryTokens.some(tok => sub.includes(tok) || obj.includes(tok) || pred.includes(tok));
        
        if (matches) {
          const key = `${ast.subject}-${ast.predicate}-${ast.object}`;
          if (!seenAssertionKeys.has(key)) {
            seenAssertionKeys.add(key);
            assertions.push({
              id: ast.id || `v2_ast_${assertions.length}`,
              subjectName: ast.subject || ast.subjectName,
              predicate: ast.predicate || ast.relation,
              rawPredicate: ast.rawPredicate || ast.predicate,
              objectName: ast.object || ast.objectName,
              epistemicStatus: ast.epistemicStatus || 'SELF_REPORTED',
              epistemicDistance: ast.epistemicDistance || 1,
              evidence: ast.evidence || (ast.sourceQuote ? {
                quote: ast.sourceQuote,
                entryId: ast.sourceEntryId,
                entryDate: ast.entryDate
              } : null)
            });
          }
        }
      });
    }

    // 3. Check graphNodes and their relatedEdges
    if (assertions.length === 0 && graphNodes.length > 0) {
      graphNodes.forEach(node => {
        const nodeName = (node.name || node.label || node.id || '').toLowerCase();
        const nodeContent = (node.content || '').toLowerCase();
        const isNodeMatch = queryTokens.some(tok => nodeName.includes(tok) || nodeContent.includes(tok));

        if (node.relatedEdges && Array.isArray(node.relatedEdges)) {
          node.relatedEdges.forEach(edge => {
            const src = (edge.source || '').toLowerCase();
            const tgt = (edge.target || '').toLowerCase();
            const rel = (edge.relation || '').toLowerCase();

            const isEdgeMatch = isNodeMatch || queryTokens.some(tok => src.includes(tok) || tgt.includes(tok) || rel.includes(tok));

            if (isEdgeMatch) {
              const key = `${edge.source}-${edge.relation}-${edge.target}`;
              if (!seenAssertionKeys.has(key)) {
                seenAssertionKeys.add(key);
                assertions.push({
                  id: `edge_${assertions.length}`,
                  subjectName: edge.source,
                  predicate: edge.relation || 'קשור_ל',
                  rawPredicate: edge.relation || 'קשור_ל',
                  objectName: edge.target,
                  epistemicStatus: edge.isManual ? 'SELF_REPORTED' : (edge.provenanceType || 'EXTRACTED'),
                  epistemicDistance: 1,
                  evidence: edge.sourceQuotes && edge.sourceQuotes.length > 0 ? {
                    quote: edge.sourceQuotes[0],
                    entryId: edge.sourceEntryId || node.date,
                    entryDate: edge.date || node.date
                  } : null
                });
              }
            }
          });
        }
      });
    }

    // 4. If still empty but insight has direct quotes
    if (assertions.length === 0 && activeInsight.sourceQuotes && activeInsight.sourceQuotes.length > 0) {
      activeInsight.sourceQuotes.forEach((quote, qIdx) => {
        assertions.push({
          id: `direct_quote_${qIdx}`,
          subjectName: activeInsight.title,
          predicate: 'מתועד_ב',
          rawPredicate: 'מבוסס ישירות על',
          objectName: 'עדות יומן',
          epistemicStatus: 'SELF_REPORTED',
          epistemicDistance: 0,
          evidence: {
            quote: quote,
            entryId: activeInsight.sourceEntryIds?.[qIdx] || null,
            entryDate: null
          }
        });
      });
    }

    return assertions.slice(0, 6);
  }, [activeInsight, queryTokens, v2RawData, graphNodes]);

  // Match diary entries
  const matchedEntries = useMemo(() => {
    if (!activeInsight || entries.length === 0) return [];

    const matched = [];
    const seenEntryIds = new Set();

    // From matched assertions evidence
    matchedAssertions.forEach(ast => {
      if (ast.evidence?.entryId) {
        const found = entries.find(e => e.id === ast.evidence.entryId || e.frontmatter?.id === ast.evidence.entryId);
        if (found && !seenEntryIds.has(found.id)) {
          seenEntryIds.add(found.id);
          matched.push({ entry: found, quote: ast.evidence.quote });
        }
      }
    });

    // Content match across entries if needed
    if (matched.length < 3 && queryTokens.length > 0) {
      entries.forEach(e => {
        if (seenEntryIds.has(e.id)) return;
        const text = (e.content || e.transcript || '').toLowerCase();
        let hitScore = 0;
        queryTokens.forEach(tok => {
          if (text.includes(tok)) hitScore += 1;
        });

        if (hitScore >= 2 || (queryTokens.length === 1 && hitScore >= 1)) {
          seenEntryIds.add(e.id);
          // Find best snippet
          const origText = e.content || e.transcript || '';
          let snippet = origText.slice(0, 200);
          matched.push({ entry: e, quote: snippet });
        }
      });
    }

    return matched.slice(0, 4);
  }, [activeInsight, matchedAssertions, entries, queryTokens]);

  const getDistanceLabel = (dist) => {
    switch (dist) {
      case 0: return '0: Raw Source (עדות גולמית ביומן)';
      case 1: return '1: Direct Assertion (טענה ישירה/עובדה)';
      case 2: return '2: Interpretation (פרשנות מסדר ראשון)';
      case 3: return '3: Hypothesis (השערה מתגבשת)';
      case 4: return '4: Pattern (דפוס חוזר לאורך זמן)';
      case 5: return '5: Principle (עיקרון מנחה אישי)';
      default: return `${dist}: Inferred (היסק AI)`;
    }
  };

  const getEmpiricalBadge = (status) => {
    switch (status) {
      case 'SUPPORTED':
        return <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>✓ אומת במציאות (Supported)</span>;
      case 'FALSIFIED':
        return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>✗ הופרך (Falsified)</span>;
      default:
        return <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>⏱ טרם נבדק (Untested)</span>;
    }
  };

  if (!activeInsight) {
    return (
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '20px',
        padding: '32px',
        color: '#f8fafc',
        direction: 'rtl',
        textAlign: 'center'
      }}>
        <ShieldCheck size={48} style={{ color: '#818cf8', margin: '0 auto 16px auto' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0' }}>לא נבחרה תובנה לבדיקה אפיסטמית</h3>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 20px auto' }}>
          באפשרותך ללחוץ על "למה כך? 🔍" לצד כל תובנה, החלטה או קשר בגרף כדי לראות את שרשרת ההוכחה המדויקת מהיומן.
        </p>
        {onClose && (
          <button 
            onClick={onClose}
            style={{ background: '#334155', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer' }}
          >
            סגור חלון
          </button>
        )}
      </div>
    );
  }

  const conf = activeInsight.confidenceVector || {};

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '20px',
      padding: '28px',
      color: '#f8fafc',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
      direction: 'rtl'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#818cf8', fontWeight: 700, letterSpacing: '0.5px' }}>
              RIKMA Self — Epistemic Provenance DAG
            </span>
            {getEmpiricalBadge(conf.empiricalStatus)}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            "למה המערכת חושבת כך?" — שרשרת ההוכחה והוודאות
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tier 1: The Synthesized Insight */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(56, 189, 248, 0.08))',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        padding: '18px 20px',
        borderRadius: '16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} />
            רמה 1: התובנה המסונתזת (Synthesized Insight)
          </span>
          <span style={{ fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.2)', padding: '3px 10px', borderRadius: '12px' }}>
            מרחק מהמקור: {getDistanceLabel(activeInsight.epistemicDistance)}
          </span>
        </div>

        {activeInsight.title && activeInsight.title !== activeInsight.text && (
          <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', color: '#fff', fontWeight: 700 }}>
            {activeInsight.title}
          </h3>
        )}

        <p style={{ fontSize: '0.95rem', color: '#e2e8f0', margin: 0, lineHeight: 1.6 }}>
          "{activeInsight.text}"
        </p>
      </div>

      {/* Confidence Indicators */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        background: 'rgba(30, 41, 59, 0.6)',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '22px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>1. דיוק חילוץ (Extraction Confidence)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8' }}>
            {Math.round((conf.extractionConfidence || 0.9) * 100)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>2. חוזק אפיסטמי (Epistemic Strength)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#818cf8' }}>
            {conf.epistemicStrength || 'HIGH'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>3. סטטוס הפרכה (Empirical Status)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399' }}>
            {conf.empiricalStatus || 'UNTESTED'}
          </div>
        </div>
      </div>

      {/* Tier 2: Grounding Assertions & Knowledge Graph Links */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Layers size={16} style={{ color: '#818cf8' }} />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            רמה 2: טענות וקשרים בגרף הידע (Knowledge Graph Assertions)
          </h3>
        </div>

        {matchedAssertions.length === 0 ? (
          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.82rem', color: '#94a3b8' }}>
            לא נמצאו טענות ישירות המקושרות לתובנה זו בגרף. התובנה מבוססת על היסק כללי מהרשומות.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matchedAssertions.map((ast, idx) => (
              <div 
                key={ast.id || idx}
                style={{
                  padding: '12px 16px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <strong style={{ color: '#a5b4fc' }}>{ast.subjectName}</strong>
                    <span style={{ fontSize: '0.72rem', background: '#334155', padding: '2px 8px', borderRadius: '6px', color: '#e2e8f0', fontWeight: 600 }}>
                      {ast.predicate}
                    </span>
                    <strong style={{ color: '#a5b4fc' }}>← {ast.objectName}</strong>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: ast.epistemicStatus === 'SELF_REPORTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: ast.epistemicStatus === 'SELF_REPORTED' ? '#34d399' : '#818cf8',
                    border: `1px solid ${ast.epistemicStatus === 'SELF_REPORTED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`
                  }}>
                    {ast.epistemicStatus === 'SELF_REPORTED' ? 'עדות ישירה (Self-Reported)' : 'היסק AI (Inferred)'}
                  </span>
                </div>

                {ast.evidence?.quote && (
                  <div style={{
                    background: '#0f172a',
                    borderRight: '3px solid #6366f1',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    color: '#cbd5e1',
                    fontStyle: 'italic'
                  }}>
                    "{ast.evidence.quote}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tier 3: Grounding Evidence in Journal Entries */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <BookOpen size={16} style={{ color: '#34d399' }} />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            רמה 3: ציטוטי מקור ורשומות מאמתות ביומן (Diary Evidence)
          </h3>
        </div>

        {matchedEntries.length === 0 ? (
          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '0.82rem', color: '#94a3b8' }}>
            לא נמצאו ציטוטים ספציפיים מותאמים. התובנה מבוססת על שקלול רחב של רשומות היומן.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {matchedEntries.map(({ entry, quote }, idx) => {
              const dateStr = entry.date || entry.frontmatter?.date || (entry.rawTimestamp ? new Date(entry.rawTimestamp).toLocaleDateString('he-IL') : 'תאריך לא ידוע');
              const entryTitle = entry.title || entry.frontmatter?.title || `רשומה מתאריך ${dateStr}`;

              return (
                <div 
                  key={entry.id || idx}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>{entryTitle}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({dateStr})</span>
                    </div>

                    {onNavigateToEntry && (
                      <button
                        onClick={() => onNavigateToEntry(entry.id)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#7dd3fc',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        פתח ביומן ➔
                      </button>
                    )}
                  </div>

                  {quote && (
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: '6px', borderRight: '2px solid #34d399' }}>
                      "{quote}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
