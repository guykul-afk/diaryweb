import React, { useState } from 'react';

export default function EpistemicTraceabilityView({ insight, onClose }) {
  const [selectedAssertionId, setSelectedAssertionId] = useState(null);

  // Sample data fallback if no insight prop is passed
  const activeInsight = insight || {
    id: "insight_sample_1",
    type: "PATTERN",
    text: "בתקופות של עומס בעבודה, מופיע דפוס של ביקורת עצמית מוגברת המקשה על קבלת החלטות.",
    epistemicStatus: "INFERRED",
    confidence: 0.92,
    derivedFromAssertions: [
      {
        id: "ast_101",
        subjectName: "עבודה",
        predicate: "CONTRIBUTES_TO",
        rawPredicate: "מגבירה",
        objectName: "לחץ וביקורת עצמית",
        epistemicStatus: "SELF_REPORTED",
        evidence: {
          entryId: "entry_2026_03_12",
          entryDate: "12/03/2026",
          quote: "בתקופות עמוסות בעבודה אני שם לב שהביקורת העצמית שלי מזנקת מיד."
        }
      },
      {
        id: "ast_102",
        subjectName: "ביקורת עצמית",
        predicate: "CONTRIBUTES_TO",
        rawPredicate: "מעכבת",
        objectName: "קבלת החלטות בפרויקט",
        epistemicStatus: "INFERRED",
        evidence: {
          entryId: "entry_2026_04_05",
          entryDate: "05/04/2026",
          quote: "הקושי להחליט על המשך הפרויקט נובע מהחשש לא לעמוד בסטנדרט שהצבתי."
        }
      }
    ]
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SELF_REPORTED':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium">💬 אמרת במפורש (Self-Reported)</span>;
      case 'INFERRED':
        return <span className="bg-purple-950 text-purple-300 border border-purple-800 text-xs px-2.5 py-1 rounded-full font-medium">🧠 המערכת הסיקה (Inferred)</span>;
      case 'DERIVED':
        return <span className="bg-blue-950 text-blue-300 border border-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">📊 דפוס נגזר (Derived)</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-right text-slate-100 shadow-xl" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Phase 7 — Epistemic Traceability</span>
            {getStatusBadge(activeInsight.epistemicStatus)}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">"למה המערכת חושבת כך?" — שרשרת הראיות</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            ✕
          </button>
        )}
      </div>

      {/* The Insight */}
      <div className="bg-indigo-950/40 border border-indigo-800/50 p-4 rounded-xl mb-6">
        <span className="text-xs text-indigo-300 font-medium block mb-1">התובנה שנבדקת (Insight):</span>
        <p className="text-base text-indigo-100 font-semibold leading-relaxed">
          "{activeInsight.text}"
        </p>
      </div>

      {/* Traceability Flow */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span>🔍</span> טענות מבססות (Supporting Assertions):
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {activeInsight.derivedFromAssertions?.map((ast, idx) => (
            <div 
              key={ast.id || idx}
              className="p-4 bg-slate-800/90 border border-slate-700 rounded-xl space-y-3 hover:border-indigo-500/50 transition"
            >
              {/* Assertion Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <span className="text-indigo-300 font-bold">{ast.subjectName}</span>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded font-mono text-slate-300">{ast.predicate}</span>
                  <span className="text-xs text-slate-400 italic">("{ast.rawPredicate}")</span>
                  <span className="text-indigo-300 font-bold">← {ast.objectName}</span>
                </div>
                {getStatusBadge(ast.epistemicStatus)}
              </div>

              {/* Evidence Quote */}
              {ast.evidence && (
                <div className="bg-slate-900/90 border-r-4 border-indigo-500 p-3 rounded-lg text-sm text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>📜 ציטוט מהיומן:</span>
                    <span className="font-mono text-slate-400">רשומה: {ast.evidence.entryDate || ast.evidence.entryId}</span>
                  </div>
                  <p className="italic text-slate-200 font-serif">
                    "{ast.evidence.quote}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
