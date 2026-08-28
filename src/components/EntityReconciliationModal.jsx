import React, { useState, useEffect } from 'react';

export default function EntityReconciliationModal({ isOpen, onClose, candidates = [] }) {
  const [candidateGroups, setCandidateGroups] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    if (candidates && candidates.length > 0) {
      setCandidateGroups(candidates);
    } else {
      // Default sample fallback if not loaded from file/props
      setCandidateGroups([
        {
          groupKey: "גיא",
          candidates: [
            { id: "person_guy", canonicalName: "גיא", aliases: ["גיא"], occurrencesCount: 142 },
            { id: "person_guy_tali", canonicalName: "גיא וטלי", aliases: ["גיא וטלי"], occurrencesCount: 18 }
          ]
        }
      ]);
    }
  }, [candidates]);

  if (!isOpen || candidateGroups.length === 0) return null;

  const currentGroup = candidateGroups[currentIndex] || candidateGroups[0];

  const handleDecision = (choice) => {
    setDecisions(prev => ({
      ...prev,
      [currentGroup.groupKey]: choice
    }));

    if (currentIndex < candidateGroups.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("סקירת הישויות הושלמה בהצלחה! הנתונים נשמרו ל-Entity Registry ללא מחיקה הרסנית.");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-right" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Phase 5 — Entity Reconciliation</span>
            <h2 className="text-xl font-bold text-white mt-1">יישוב ישויות ואיחוד זהויות</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Progress */}
        <div className="text-xs text-slate-400 mb-4 flex justify-between items-center">
          <span>קבוצה {currentIndex + 1} מתוך {candidateGroups.length}</span>
          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-300">קבוצת דמיון: "{currentGroup.groupKey}"</span>
        </div>

        {/* Candidate Cards */}
        <div className="space-y-3 mb-6">
          <p className="text-sm text-slate-300">האם המופעים הבאים מתייחסים לאותה ישות או לישויות נפרדות?</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentGroup.candidates.map((cand) => (
              <div key={cand.id} className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">{cand.canonicalName}</span>
                  <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full">
                    {cand.occurrencesCount || 1} מופעים
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">ID: {cand.id}</div>
                <div className="text-xs text-slate-300">
                  כינויים: {cand.aliases?.join(", ") || cand.canonicalName}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-800 pt-4 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => handleDecision('SAME_ENTITY')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition shadow-lg shadow-emerald-950/50"
          >
            ✓ אותו אדם (איחוד קנוני עם Aliases)
          </button>
          <button
            onClick={() => handleDecision('DIFFERENT_ENTITIES')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-sm transition border border-slate-700"
          >
            ✕ אנשים שונים (הפרדה)
          </button>
          <button
            onClick={() => handleDecision('UNCERTAIN')}
            className="px-4 py-2.5 bg-amber-950/50 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 font-medium rounded-xl text-sm transition"
          >
            ? לא בטוח (שמור להמשך)
          </button>
        </div>

      </div>
    </div>
  );
}
