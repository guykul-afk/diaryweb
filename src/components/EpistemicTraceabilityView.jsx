import React, { useState } from 'react';
import { ShieldCheck, GitCommit, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function EpistemicTraceabilityView({ insight, onClose }) {
  const [selectedAssertionId, setSelectedAssertionId] = useState(null);

  // Sample data fallback if no insight prop is passed
  const activeInsight = insight || {
    id: "insight_sample_1",
    type: "PATTERN",
    text: "בתקופות של עומס בעבודה, מופיע דפוס של ביקורת עצמית מוגברת המקשה על קבלת החלטות.",
    epistemicStatus: "INFERRED",
    epistemicDistance: 4, // Pattern
    confidenceVector: {
      extractionConfidence: 0.98,
      epistemicStrength: "HIGH",
      empiricalStatus: "SUPPORTED",
      epistemicDistance: 4
    },
    decisionChain: {
      decisionTitle: "הקצאת זמני מנוחה קשיחים בימי רביעי",
      predictionText: "הפחתת עומס שבועי תוביל ל-30% פחות תחושת תקיעות בקבלת החלטות",
      outcome: "אימות חיובי: ירידה עקבית ברמות הדופק ועלייה ברשומות חיוביות בימי חמישי."
    },
    derivedFromAssertions: [
      {
        id: "ast_101",
        subjectName: "עבודה",
        predicate: "CONTRIBUTES_TO",
        rawPredicate: "מגבירה",
        objectName: "לחץ וביקורת עצמית",
        epistemicStatus: "SELF_REPORTED",
        epistemicDistance: 1,
        evidence: {
          entryId: "entry_2026_03_12",
          entryDate: "12/03/2026",
          quote: "בתקופות עמוסות בעבודה אני שם לב שהביקורת העצמית שלי מזנקת מיד.",
          modelId: "gemini-2.5-flash",
          promptVersion: "v2.3"
        }
      },
      {
        id: "ast_102",
        subjectName: "ביקורת עצמית",
        predicate: "CONTRIBUTES_TO",
        rawPredicate: "מעכבת",
        objectName: "קבלת החלטות בפרויקט",
        epistemicStatus: "INFERRED",
        epistemicDistance: 2,
        evidence: {
          entryId: "entry_2026_04_05",
          entryDate: "05/04/2026",
          quote: "הקושי להחליט על המשך הפרויקט נובע מהחשש לא לעמוד בסטנדרט שהצבתי.",
          modelId: "gemini-2.5-flash",
          promptVersion: "v2.3"
        }
      }
    ]
  };

  const getDistanceLabel = (dist) => {
    switch (dist) {
      case 0: return '0: Raw Source (עדות גולמית)';
      case 1: return '1: Direct Assertion (טענה ישירה)';
      case 2: return '2: Interpretation (פרשנות)';
      case 3: return '3: Hypothesis (השערה)';
      case 4: return '4: Pattern (דפוס חוזר)';
      case 5: return '5: Principle (עיקרון מנחה)';
      default: return `${dist}: Inferred`;
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

  const conf = activeInsight.confidenceVector || {
    extractionConfidence: 0.95,
    epistemicStrength: "MEDIUM",
    empiricalStatus: "UNTESTED",
    epistemicDistance: 2
  };

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '20px',
      padding: '24px',
      color: '#f8fafc',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      direction: 'rtl'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#818cf8', fontWeight: 700 }}>
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
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tri-Part Confidence Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        background: 'rgba(30, 41, 59, 0.7)',
        padding: '12px 16px',
        borderRadius: '12px',
        marginBottom: '20px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>1. Extraction Confidence (דיוק חילוץ)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8' }}>{Math.round(conf.extractionConfidence * 100)}%</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>2. Epistemic Strength (חוזק הטענה)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#818cf8' }}>{conf.epistemicStrength}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>3. Empirical Status (אימות במציאות)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399' }}>{conf.empiricalStatus}</div>
        </div>
      </div>

      {/* The Insight */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        padding: '16px',
        borderRadius: '14px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>התובנה הנבדקת (Insight / Pattern):</span>
          <span style={{ fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '8px' }}>
            מרחק מהמקור: {getDistanceLabel(activeInsight.epistemicDistance || 4)}
          </span>
        </div>
        <p style={{ fontSize: '1rem', color: '#f1f5f9', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
          "{activeInsight.text}"
        </p>
      </div>

      {/* Decision Loop Connection if available */}
      {activeInsight.decisionChain && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>
            🎯 סגירת לולאה מול החלטה ותוצאה (Decision & Reality Loop):
          </div>
          <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
            <strong>החלטה שנובעת: </strong> {activeInsight.decisionChain.decisionTitle}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            <strong>ציפייה מראש: </strong> {activeInsight.decisionChain.predictionText}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#34d399' }}>
            <strong>תוצאה שנצפתה: </strong> {activeInsight.decisionChain.outcome}
          </div>
        </div>
      )}

      {/* Traceability Assertions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>
          🔍 טענות מבססות וציטוטי מקור מהיומן:
        </h3>

        {activeInsight.derivedFromAssertions?.map((ast, idx) => (
          <div 
            key={ast.id || idx}
            style={{
              padding: '14px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <strong style={{ color: '#818cf8' }}>{ast.subjectName}</strong>
                <span style={{ fontSize: '0.75rem', background: '#334155', padding: '2px 6px', borderRadius: '4px', color: '#cbd5e1' }}>{ast.predicate}</span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>("{ast.rawPredicate}")</span>
                <strong style={{ color: '#818cf8' }}>← {ast.objectName}</strong>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {getDistanceLabel(ast.epistemicDistance || 1)}
              </span>
            </div>

            {ast.evidence && (
              <div style={{
                background: '#0f172a',
                borderRight: '3px solid #6366f1',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#cbd5e1'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '4px' }}>
                  <span>📜 רשומה: {ast.evidence.entryDate || ast.evidence.entryId}</span>
                  {ast.evidence.modelId && <span>מודל: {ast.evidence.modelId}</span>}
                </div>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#f1f5f9' }}>
                  "{ast.evidence.quote}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
