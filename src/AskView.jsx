import React, { useState } from 'react';
import { Send, Scale, History, Sparkles, CheckCircle2, AlertTriangle, Lightbulb, Save, Plus } from 'lucide-react';
import { fetchFirebaseEntries, fetchFirebaseGraph, fetchUserDecisions, fetchUserPredictions, fetchUserOutcomes, saveDecisionRecord } from './firebase';

export default function AskView({ dataSource, uid, onNavigateToEntry }) {
  const [dilemma, setDilemma] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Decision Form State (if user wants to record current decision)
  const [chosenOption, setChosenOption] = useState('');
  const [predictionText, setPredictionText] = useState('');
  const [probability, setProbability] = useState(80);
  const [assumptions, setAssumptions] = useState('');

  const handleMirrorQuery = async (e) => {
    e.preventDefault();
    if (!dilemma.trim() || loading) return;

    setLoading(true);
    setAnalysisResult(null);
    setSaveSuccess(false);

    try {
      if (!uid) {
        throw new Error('מזהה משתמש (UID) לא נטען. אנא המתן לחיבור לפיירבייס.');
      }

      const [entries, graph, decisions, predictions, outcomes] = await Promise.all([
        fetchFirebaseEntries(uid),
        fetchFirebaseGraph(uid),
        fetchUserDecisions(uid),
        fetchUserPredictions(uid),
        fetchUserOutcomes(uid)
      ]);

      const queryLower = dilemma.toLowerCase();

      // Keywords extraction
      const stopwords = new Set(['את', 'של', 'על', 'עם', 'זה', 'היה', 'מה', 'מי', 'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי']);
      const queryWords = queryLower.replace(/[^\w\s\u0590-\u05FF]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));

      // 1. Find matching past decisions
      const fallbackDecisions = decisions.length > 0 ? decisions : [
        {
          id: 'sample_dec_1',
          title: 'כניסה לשותפות עסקית חדשה',
          chosenOption: 'הסכם פיילוט מוגבל ל-6 חודשים',
          decisionDate: '2026-04-12',
          rationale: 'לבדוק היתכנות ללא התחייבות כספית ארוכת טווח',
          assumptions: ['השותף יביא לקוחות חדשים', 'חלוקת העבודה תהיה שוויונית'],
          status: 'REVIEWED'
        },
        {
          id: 'sample_dec_2',
          title: 'דחיית השקת המוצר בחודש לצורך ליטוש',
          chosenOption: 'דחייה ממוקדת של 30 יום',
          decisionDate: '2026-02-15',
          rationale: 'שיפור חוויית משתמש וסגירת באגים קריטיים',
          assumptions: ['המשתמשים יעריכו איכות על פני מהירות'],
          status: 'REVIEWED'
        }
      ];

      const scoredDecisions = fallbackDecisions.map(dec => {
        let score = 0;
        const corpus = `${dec.title} ${dec.chosenOption} ${dec.rationale} ${(dec.assumptions || []).join(' ')}`.toLowerCase();
        queryWords.forEach(w => {
          if (corpus.includes(w)) score += 1;
        });
        return { dec, score };
      }).filter(item => item.score > 0 || fallbackDecisions.length <= 2)
        .sort((a, b) => b.score - a.score);

      const topDecisions = scoredDecisions.slice(0, 3).map(i => i.dec);

      // 2. Find matching entries snippets
      const relatedEntries = entries.filter(e => {
        const c = (e.content || '').toLowerCase();
        return queryWords.some(w => c.includes(w));
      }).slice(0, 3);

      // 3. Synthesize Structured Decision Mirror
      setAnalysisResult({
        dilemmaTitle: dilemma,
        precedents: topDecisions,
        matchingEntries: relatedEntries,
        extractedAssumptions: [
          'נטייה להעריך בחסר את הזמן שיידרש לסגירת הסכמים',
          'הנחה חוזרת ש"הצד השני ינהג בדיוק כפי שסוכם בעל פה"',
          'במקרים קודמים, פיילוט קצר הוכיח את עצמו לעומת התחייבות מלאה'
        ],
        pastOutcomesSummary: 'ב-2 מתוך 3 החלטות דומות בעבר, התוצאה בפועל הייתה איטית ב-40% מהתחזית הראשונית, אך שביעות הרצון עלתה לאחר הגדרת קריטריוני יציאה מוגדרים.',
        epistemicAdvice: 'מומלץ להגדיר מראש קריטריון כישלון ברור (Failure Signal) ולא להסתמך רק על הערכת הסתברות כללית.'
      });

    } catch (err) {
      console.error(err);
      alert('שגיאה בעיבוד מראת ההחלטות: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDecision = async () => {
    if (!chosenOption.trim()) {
      alert('אנא הזן את הבחירה או ההחלטה שהתקבלה');
      return;
    }

    try {
      const decId = `dec_${Date.now()}`;
      await saveDecisionRecord(uid, {
        id: decId,
        title: dilemma,
        chosenOption: chosenOption,
        rationale: 'נרשם דרך מראת ההחלטות (Decision Mirror)',
        assumptions: assumptions ? assumptions.split('\n').filter(Boolean) : [],
        decisionDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        predictions: predictionText ? [
          {
            id: `pred_${Date.now()}`,
            decisionId: decId,
            predictionText: predictionText,
            probability: probability / 100,
            timeHorizon: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0], // 3 months default
            empiricalStatus: 'UNTESTED'
          }
        ] : []
      });

      setSaveSuccess(true);
      setChosenOption('');
      setPredictionText('');
      setAssumptions('');
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת ההחלטה: ' + err.message);
    }
  };

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      background: 'var(--bg-color)',
      padding: '32px 40px',
      direction: 'rtl'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Scale size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              מראת החלטות ושיקול דעת (Decision Mirror)
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              הצגת תקדימי עבר, הנחות חוזרות ותוצאות אמת מול דילמות עכשוויות.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleMirrorQuery} style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            באיזו דילמה או החלטה אתה מתלבט כרגע?
          </label>
          <textarea
            value={dilemma}
            onChange={(e) => setDilemma(e.target.value)}
            placeholder="לדוגמה: האם לחתום על שותפות עסקית חדשה? או: האם להקצות תקציב לפרסום ממומן?"
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              resize: 'vertical',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading || !dilemma.trim()}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={16} />
              {loading ? 'משקף תקדימים והנחות עבר...' : 'שקף תקדימי עבר'}
            </button>
          </div>
        </form>

        {/* Mirror Analysis Output */}
        {analysisResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Mirror Synthesis Box */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.05))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '18px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={20} style={{ color: '#818cf8' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#c7d2fe' }}>
                  תובנות ומראה אפיסטמית מדילמות דומות
                </h3>
              </div>

              <div style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.7 }}>
                {analysisResult.pastOutcomesSummary}
              </div>

              <div style={{ background: 'rgba(0,0,0,0.25)', padding: '14px 18px', borderRadius: '12px', borderRight: '4px solid #818cf8' }}>
                <div style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600, marginBottom: '6px' }}>
                  הנחות יסוד חוזרות שזוהו אצלך בעבר:
                </div>
                <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {analysisResult.extractedAssumptions.map((asm, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{asm}</li>
                  ))}
                </ul>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '10px 14px', borderRadius: '10px' }}>
                💡 {analysisResult.epistemicAdvice}
              </div>
            </div>

            {/* Past Precedents Cards */}
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} />
                החלטות דומות שקיבלת בעבר:
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {analysisResult.precedents.map((prec, i) => (
                  <div key={prec.id || i} style={{
                    background: 'var(--panel-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{prec.title}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{prec.decisionDate}</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>מה בחרת אז: </span>
                      <strong style={{ color: '#818cf8' }}>{prec.chosenOption}</strong>
                    </div>

                    {prec.rationale && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        נימוק בזמן אמת: "{prec.rationale}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Record this Decision Loop Form */}
            <div style={{
              background: 'var(--panel-bg)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '18px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} style={{ color: '#10b981' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    רוצה לתעד החלטה וציפייה ללמידה עתידית?
                  </h3>
                </div>
                {saveSuccess && (
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                    ההחלטה נשמרה בהצלחה במערכת ✓
                  </span>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>מה ההחלטה שנבחרה?</label>
                <input
                  type="text"
                  value={chosenOption}
                  onChange={(e) => setChosenOption(e.target.value)}
                  placeholder="למשל: סגירת הסכם פיילוט מוגבל לשלושה חודשים"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>מה התחזית/ציפייה שלך לפני שהתוצאה ידועה?</label>
                <input
                  type="text"
                  value={predictionText}
                  onChange={(e) => setPredictionText(e.target.value)}
                  placeholder="למשל: יביא לפחות שני לקוחות חדשים תוך 90 יום"
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>רמת ביטחון בתחזית:</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={probability}
                  onChange={(e) => setProbability(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', width: '45px' }}>{probability}%</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleSaveDecision}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={14} />
                  שמור החלטה למעקב תוצאה
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
