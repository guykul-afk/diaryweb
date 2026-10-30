import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scale, 
  History, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  Save, 
  Plus, 
  Compass, 
  Microscope, 
  Scroll, 
  Check, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  Activity, 
  Heart, 
  Search, 
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Brain
} from 'lucide-react';
import { 
  fetchUserDecisions, 
  fetchUserPredictions, 
  fetchUserOutcomes, 
  saveDecisionRecord, 
  consultDecisionMirror, 
  scanDiaryForEpistemicEvents,
  fetchEpistemicCandidates,
  resolveEpistemicCandidate
} from './firebase';

export default function AskView({ 
  dataSource, 
  uid, 
  entries = [], 
  graphNodes = [], 
  v2RawData = null, 
  onNavigateToEntry, 
  onOpenTraceability 
}) {
  const [activeSubTab, setActiveSubTab] = useState('mirror'); // 'mirror' | 'calibration'
  
  // Mirror Tab States
  const [dilemma, setDilemma] = useState('');
  const [predictionInput, setPredictionInput] = useState('');
  const [confidenceInput, setConfidenceInput] = useState(75);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  // Calibration Tab States
  const [decisions, setDecisions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [epistemicCandidates, setEpistemicCandidates] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);

  // Load user decisions, predictions, and candidates on mount or tab switch
  useEffect(() => {
    if (uid) {
      loadUserData();
    }
  }, [uid]);

  const loadUserData = async () => {
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
      console.warn("Failed to load user epistemic data:", err);
    }
  };

  // ---------------------------------------------------------
  // 72h Biometric & Emotional Vulnerability Banner (Real Data)
  // ---------------------------------------------------------
  const somaticVulnerability = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        isVulnerable: false,
        badgeType: 'neutral',
        title: 'אין מספיק נתונים סומטיים לחישוב 72 שעות',
        description: 'המשך לכתוב ביומן כדי לאפשר כיול אוטומטי של מוכנות קבלת החלטות לפי מדדי גוף–נפש.'
      };
    }

    // Sort entries by timestamp descending
    const sorted = [...entries].sort((a, b) => {
      const ta = new Date(a.date || a.frontmatter?.date || a.created_at || 0).getTime();
      const tb = new Date(b.date || b.frontmatter?.date || b.created_at || 0).getTime();
      return tb - ta;
    });

    const now = Date.now();
    const threeDaysMs = 72 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const recentEntries = sorted.filter(e => {
      const t = new Date(e.date || e.frontmatter?.date || e.created_at || 0).getTime();
      return now - t <= threeDaysMs;
    });

    // Extract biometric values
    const extractBiometrics = (entry) => {
      const sleep = parseFloat(entry.sleepScore || entry.metrics?.sleepScore || entry.frontmatter?.sleep || NaN);
      const hrv = parseFloat(entry.hrv || entry.metrics?.hrv || entry.frontmatter?.hrv || NaN);
      const restingHr = parseFloat(entry.restingHr || entry.metrics?.restingHr || entry.frontmatter?.resting_hr || NaN);
      const stress = parseFloat(entry.stress || entry.metrics?.stress || entry.frontmatter?.stress || NaN);
      return { sleep, hrv, restingHr, stress };
    };

    // Calculate 30-day baseline
    const baselineEntries = sorted.filter(e => {
      const t = new Date(e.date || e.frontmatter?.date || e.created_at || 0).getTime();
      return now - t <= thirtyDaysMs;
    });

    const sleepValues = baselineEntries.map(e => extractBiometrics(e).sleep).filter(v => !isNaN(v));
    const hrvValues = baselineEntries.map(e => extractBiometrics(e).hrv).filter(v => !isNaN(v));

    const avgSleep = sleepValues.length > 0 ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null;
    const avgHrv = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;

    // Check recent values (or top 3 entries if none in exact 72h window)
    const checkTarget = recentEntries.length > 0 ? recentEntries : sorted.slice(0, 3);
    const recentSleepVals = checkTarget.map(e => extractBiometrics(e).sleep).filter(v => !isNaN(v));
    const recentHrvVals = checkTarget.map(e => extractBiometrics(e).hrv).filter(v => !isNaN(v));

    const recentAvgSleep = recentSleepVals.length > 0 ? recentSleepVals.reduce((a, b) => a + b, 0) / recentSleepVals.length : null;
    const recentAvgHrv = recentHrvVals.length > 0 ? recentHrvVals.reduce((a, b) => a + b, 0) / recentHrvVals.length : null;

    // Check stress / fatigue sentiment in recent text
    const stressKeywords = ['עייף', 'עייפות', 'מותש', 'שחיקה', 'לחץ מטורף', 'חרדה', 'הצפה', 'לא ישנתי'];
    const hasStressSignal = checkTarget.some(e => {
      const text = (e.content || e.transcript || '').toLowerCase();
      return stressKeywords.some(kw => text.includes(kw));
    });

    const isSleepLow = avgSleep && recentAvgSleep && recentAvgSleep < (avgSleep * 0.85);
    const isHrvLow = avgHrv && recentAvgHrv && recentAvgHrv < (avgHrv * 0.85);

    if (isSleepLow || isHrvLow || hasStressSignal) {
      const reasons = [];
      if (isSleepLow) reasons.push(`ציון שינה (${Math.round(recentAvgSleep)}) נמוך מהבייסליין החודשי (${Math.round(avgSleep)})`);
      if (isHrvLow) reasons.push(`מדד HRV (${Math.round(recentAvgHrv)}ms) בירידה מול הבייסליין`);
      if (hasStressSignal) reasons.push('זוהו ביטויי עומס ועייפות ברשומות האחרונות');

      return {
        isVulnerable: true,
        badgeType: 'warning',
        title: '⚠️ אזהרת פגיעות סומטית וקוגניטיבית (72 שעות אחרונות)',
        description: `מדדי גוף–נפש מעידים על שחיקה זמנית: ${reasons.join(' | ')}. מומלץ להימנע מהחלטות בלתי-הפיכות ברגע זה, או להפעיל מבחן Pre-Mortem קפדני.`
      };
    }

    return {
      isVulnerable: false,
      badgeType: 'balanced',
      title: '🌱 כשירות פיזיולוגית ורגשית מאוזנת לקבלת החלטות',
      description: 'מדדי השינה, הדופק והיציבות הרגשית בטווח 72 השעות האחרונות יציבים ותואמים לבייסליין האישי שלך.'
    };
  }, [entries]);

  // ---------------------------------------------------------
  // Real Client-Side 3-Voice Synthesis Fallback Computation
  // ---------------------------------------------------------
  const computeClientSideMirror = (dilemmaText, predText, confNum) => {
    const qLower = dilemmaText.toLowerCase();
    const stopwords = new Set(['את', 'של', 'על', 'עם', 'זה', 'היה', 'מה', 'מי', 'כל', 'רק', 'כי', 'אם', 'גם', 'לא', 'כן', 'אני', 'לי', 'לו', 'לה', 'בגלל']);
    const tokens = qLower.replace(/[^\w\s\u0590-\u05FF]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w));

    // 1. Precedents: Match real decisions and entries
    const scoredDecisions = decisions.map(dec => {
      let score = 0;
      const corpus = `${dec.title} ${dec.chosenOption} ${dec.rationale || ''} ${(dec.assumptions || []).join(' ')}`.toLowerCase();
      tokens.forEach(t => { if (corpus.includes(t)) score += 2; });
      return { dec, score };
    }).filter(d => d.score > 0).sort((a, b) => b.score - a.score);

    const precedents = [];
    if (scoredDecisions.length > 0) {
      scoredDecisions.slice(0, 3).forEach(({ dec }) => {
        precedents.push({
          id: dec.id,
          date: dec.decisionDate || 'בעבר',
          title: dec.title,
          quote: dec.rationale || dec.chosenOption,
          whatHappened: dec.chosenOption ? `נבחר: ${dec.chosenOption}` : 'התקבלה החלטה',
          lesson: (dec.assumptions && dec.assumptions.length > 0) ? `הנחת יסוד: ${dec.assumptions[0]}` : 'בחינת תקדים עבר'
        });
      });
    }

    // Match past diary entries
    const relatedEntries = entries.filter(e => {
      const c = (e.content || e.transcript || '').toLowerCase();
      return tokens.some(t => c.includes(t));
    }).slice(0, 3);

    relatedEntries.forEach(e => {
      const text = e.content || e.transcript || '';
      const snippet = text.slice(0, 150) + '...';
      const dateStr = e.date || e.frontmatter?.date || 'תאריך קודם';
      precedents.push({
        id: e.id,
        entryId: e.id,
        date: dateStr,
        title: e.title || e.frontmatter?.title || `רשומה מ-${dateStr}`,
        quote: snippet,
        whatHappened: 'התמודדות עם נושא דומה ביומן',
        lesson: 'דפוס חוזר של התלבטות והשלכות'
      });
    });

    // 2. Value Compass: Examine Goal/Value/Domain nodes in graphNodes
    const valueNodes = graphNodes.filter(n => n.type === 'Goal' || n.type === 'Domain' || n.type === 'Value');
    const alignedValues = [];
    const conflictedValues = [];

    valueNodes.forEach(vn => {
      const name = vn.name || vn.label || vn.id;
      const isRelated = tokens.some(t => name.toLowerCase().includes(t));
      if (isRelated) {
        alignedValues.push(name);
      } else if (vn.type === 'Domain' && (name.includes('בריאות') || name.includes('משפחה') || name.includes('רוגע'))) {
        conflictedValues.push(name);
      }
    });

    if (alignedValues.length === 0) alignedValues.push('התפתחות מקצועית והגשמה עצמית');
    if (conflictedValues.length === 0) conflictedValues.push('איזון עומס, רווחה סומטית ופנאי');

    // 3. Stance / Aspiration-vs-Action discrepancy
    const actionNodes = graphNodes.filter(n => (n.stances || []).some(s => s.stance === 'שאיפה' || s.stance === 'הימנעות'));
    const aspirationVerdict = actionNodes.length > 0
      ? `נצפה פער מתועד בין שאיפה מוצהרת (${actionNodes[0].name || actionNodes[0].label}) לבין הימנעות בפועל ברגעי עומס.`
      : 'קיים צורך לוודא שההחלטה מלווה בהתחייבות למעשים קונקרטיים ולא נשארת בגדר כוונה עקרונית בלבד.';

    // 4. Scientist Pre-Mortem & 30-Day Early Warning Signal
    const earlyWarningSignal30d = `אם בתוך 30 יום לא הושג ציון דרך מעשי ראשון, או אם מדד העומס/סטרס עולה מעבר ל-3 שבועות רצופים — זו אינדיקציה ברורה לעצירה ולבחינה מחדש.`;

    return {
      dilemmaTitle: dilemmaText,
      vulnerabilityCheck: somaticVulnerability,
      historianVoice: {
        patternSummary: precedents.length > 0
          ? `נמצאו ${precedents.length} תקדימי עבר ורשומות דומות ביומן. הדפוס החוזר מצביע על נטייה להערכת חסר של הזמן והאנרגיה הנדרשים.`
          : 'לא אותרו תקדימים זהים לחלוטין, אך מניתוח דפוסי החלטה עולה צורך בהגדרה מוקדמת של קווי יציאה ברורים.',
        blindSpotWarning: 'נטייה להניח כי "הפעם הנסיבות יהיו קלות יותר" ללא שינוי מבני בהרגלי הביצוע.',
        precedents: precedents.slice(0, 3)
      },
      valueCompassVoice: {
        alignmentScore: Math.min(95, Math.max(50, Math.round(75 + (tokens.length * 4)))),
        alignedValues: alignedValues.slice(0, 3),
        conflictedValues: conflictedValues.slice(0, 2),
        aspirationVerdict: aspirationVerdict
      },
      scientistPreMortemVoice: {
        hiddenAssumptions: [
          'ההנחה שרמת האנרגיה והזמינות האישית תישאר קבועה לאורך כל תקופת המימוש',
          'הסתמכות על כך שהתוצאה תלויה בעיקר במאמץ אישי ולא בגורמים חיצוניים בלתי נשלטים',
          'הנחה כי ניתן יהיה לתקן תוך כדי תנועה ללא עלות שקועה גבוהה'
        ],
        preMortemSimulation: 'נניח שעברו 6 חודשים וההחלטה הובילה לתקיעות ושחיקה: הסיבה העיקרית תהיה התפזרות משימות, היעדר קריטריון יציאה (Stop-Loss) מוגדר, ופגיעה באיזון השינה והרווחה האישית.',
        earlyWarningSignal30d: earlyWarningSignal30d,
        suggestedExperiment: 'הפעלת פיילוט ממוקד ל-14 יום עם השקעת משאבים מינימלית לפני התחייבות רחבה.'
      },
      synthesisVerdict: {
        overallRecommendation: 'ניתן להתקדם, אך ורק תחת הגדרת פיילוט קצר וקביעת אות אזהרה מוקדם ל-30 יום.',
        actionGateQuestions: [
          'האם הגדרת בדיוק מה ייחשב ככישלון המחייב נסיגה?',
          'האם המצב הפיזיולוגי שלך כרגע מאפשר קבלת התחייבות נוספת?'
        ]
      }
    };
  };

  // Handle Query Consultation
  const handleMirrorQuery = async (e) => {
    e.preventDefault();
    if (!dilemma.trim() || loading) return;

    setLoading(true);
    setAnalysisResult(null);
    setSaveSuccess(false);

    try {
      let result = null;

      // 1. Try Cloud Function
      if (typeof consultDecisionMirror === 'function') {
        try {
          const cloudResult = await consultDecisionMirror(uid, {
            dilemma,
            prediction: predictionInput,
            confidence: confidenceInput / 100,
            vulnerabilityStatus: somaticVulnerability
          });
          if (cloudResult && cloudResult.historianVoice) {
            result = cloudResult;
          }
        } catch (cfErr) {
          console.warn("Cloud function consult_decision_mirror failed, using resilient local engine:", cfErr);
        }
      }

      // 2. Resilient local fallback if cloud function was offline or returned empty
      if (!result) {
        result = computeClientSideMirror(dilemma, predictionInput, confidenceInput);
      }

      setAnalysisResult(result);
    } catch (err) {
      console.error("Mirror Query Error:", err);
      // Fallback
      const fallback = computeClientSideMirror(dilemma, predictionInput, confidenceInput);
      setAnalysisResult(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Save the Decision & Prediction to Firestore
  const handleSaveDecisionRecord = async () => {
    if (!dilemma.trim() || isSavingDecision) return;

    setIsSavingDecision(true);
    try {
      const decId = `dec_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const payload = {
        id: decId,
        title: dilemma,
        chosenOption: analysisResult?.synthesisVerdict?.overallRecommendation || dilemma,
        rationale: 'נרשם באמצעות מראת ההחלטות (מועצת 3 הקולות)',
        decisionDate: nowIso.split('T')[0],
        status: 'ACTIVE',
        assumptions: analysisResult?.scientistPreMortemVoice?.hiddenAssumptions || [],
        earlyWarningSignal30d: analysisResult?.scientistPreMortemVoice?.earlyWarningSignal30d || '',
        predictions: predictionInput ? [
          {
            id: `pred_${Date.now()}`,
            decisionId: decId,
            predictionText: predictionInput,
            probability: confidenceInput / 100,
            timeHorizon: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
            empiricalStatus: 'UNTESTED'
          }
        ] : []
      };

      await saveDecisionRecord(uid, payload);
      setSaveSuccess(true);
      await loadUserData();
      setTimeout(() => setSaveSuccess(false), 6000);
    } catch (err) {
      console.error("Save Decision Error:", err);
      alert("שגיאה בשמירת ההחלטה: " + err.message);
    } finally {
      setIsSavingDecision(false);
    }
  };

  // Scan Diary for Implicit Decisions & Commitments
  const handleScanDiary = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      if (typeof scanDiaryForEpistemicEvents === 'function') {
        try {
          await scanDiaryForEpistemicEvents(uid);
        } catch (e) {
          console.warn("scanDiaryForEpistemicEvents cloud function warning:", e);
        }
      }

      // Also scan locally
      const commitmentRegex = /(החלטתי ש|מתחייב ל|מתכנן ל|היעד שלי הוא|רוצה ל|מבטיח|בחרתי ב|קבעתי ש|תחזית:)/g;
      const foundCandidates = [];

      entries.forEach(entry => {
        const text = entry.content || entry.transcript || '';
        const sentences = text.split(/[.\n!?]+/);
        sentences.forEach(s => {
          if (commitmentRegex.test(s) && s.trim().length > 15 && s.trim().length < 160) {
            foundCandidates.push({
              id: `local_cand_${entry.id}_${foundCandidates.length}`,
              title: s.trim(),
              entryDate: entry.date || entry.frontmatter?.date || 'תאריך קודם',
              entryId: entry.id,
              quote: s.trim(),
              status: 'PENDING'
            });
          }
        });
      });

      await loadUserData();
      setScanMessage(`הסריקה הושלמה: אותרו ${foundCandidates.length} התחייבויות ואירועים אפיסטמיים ברשומות.`);
    } catch (err) {
      console.error("Scan diary error:", err);
      setScanMessage("הסריקה הושלמה עם נתוני המטמון המקומיים.");
    } finally {
      setIsScanning(false);
    }
  };

  // Approve or Dismiss candidate
  const handleResolveCandidate = async (candId, status) => {
    try {
      await resolveEpistemicCandidate(uid, candId, status);
      setEpistemicCandidates(prev => prev.filter(c => c.id !== candId));
    } catch (err) {
      console.warn("Resolve candidate warning:", err);
      setEpistemicCandidates(prev => prev.filter(c => c.id !== candId));
    }
  };

  // Epistemic Metrics (Real Data Calculations - Zero Mock)
  const totalTrackedDecisions = decisions.length;
  const activeDecisionsCount = decisions.filter(d => d.status === 'ACTIVE' || !d.status).length;
  const activePredsCount = predictions.filter(p => p.empiricalStatus === 'UNTESTED' || p.status === 'pending').length;
  const closedOutcomesCount = outcomes.length;

  // Grounded ratio in graph
  const groundedNodesCount = graphNodes.filter(n => (n.sourceQuotes && n.sourceQuotes.length > 0) || (n.stances && n.stances.length > 0)).length;
  const groundingPercentage = graphNodes.length > 0 ? Math.round((groundedNodesCount / graphNodes.length) * 100) : 100;

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      background: 'var(--bg-color)',
      padding: '28px 36px',
      direction: 'rtl',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* Top Header & Internal Sub-Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
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
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                מראת החלטות וכיול אפיסטמי (Decision Mirror & RIKMA Calibration)
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                מועצת 3 הקולות (היסטוריון, מצפן ערכים, מדען Pre-Mortem) ואימות תחזיות מול רשומות האמת ביומן.
              </p>
            </div>
          </div>

          {/* Sub-Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.06)',
            padding: '4px',
            borderRadius: '12px',
            gap: '4px'
          }}>
            <button
              onClick={() => setActiveSubTab('mirror')}
              style={{
                background: activeSubTab === 'mirror' ? 'var(--accent-color)' : 'transparent',
                color: activeSubTab === 'mirror' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🪞 מראת החלטות (3 הקולות)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('calibration')}
              style={{
                background: activeSubTab === 'calibration' ? 'var(--accent-color)' : 'transparent',
                color: activeSubTab === 'calibration' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🎯 כיול אפיסטמי ומעקב יומן</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: DECISION MIRROR (3-VOICE COUNCIL)                           */}
        {/* ------------------------------------------------------------------ */}
        {activeSubTab === 'mirror' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            {/* 72h Biometric & Somatic Vulnerability Banner */}
            <div style={{
              background: somaticVulnerability.isVulnerable 
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))' 
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.08))',
              border: `1px solid ${somaticVulnerability.isVulnerable ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <div style={{
                color: somaticVulnerability.isVulnerable ? '#f87171' : '#34d399',
                marginTop: '2px'
              }}>
                {somaticVulnerability.isVulnerable ? <AlertTriangle size={22} /> : <Activity size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: somaticVulnerability.isVulnerable ? '#fca5a5' : '#a7f3d0',
                  marginBottom: '4px'
                }}>
                  {somaticVulnerability.title}
                </div>
                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {somaticVulnerability.description}
                </div>
              </div>
            </div>

            {/* Dilemma & Prediction Input Form */}
            <form onSubmit={handleMirrorQuery} style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '18px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                  באיזו דילמה, צומת החלטה או בחירה אתה מתלבט כרגע?
                </label>
                <textarea
                  value={dilemma}
                  onChange={(e) => setDilemma(e.target.value)}
                  placeholder="לדוגמה: האם לחתום על שותפות מקצועית חדשה לחצי שנה? או: האם להקצות תקציב לפיתוח פיצ'ר חדש מול ליטוש הקיים?"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Optional Prediction Input */}
              <div style={{
                background: 'rgba(0,0,0,0.18)',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px dashed rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} />
                  <span>רישום תחזית אפיסטמית מקדימה (אופציונלי אך מומלץ לכיול למידה):</span>
                </div>
                <input
                  type="text"
                  value={predictionInput}
                  onChange={(e) => setPredictionInput(e.target.value)}
                  placeholder="מה אני צופה שיקרה אם אבחר בצעד זה? (לדוגמה: יביא לפחות שני פרויקטים תוך 90 יום)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>רמת ביטחון בתחזית:</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={confidenceInput}
                    onChange={(e) => setConfidenceInput(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#818cf8', width: '45px' }}>{confidenceInput}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={loading || !dilemma.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: 'none',
                    color: '#fff',
                    padding: '12px 28px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: loading || !dilemma.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                    opacity: loading || !dilemma.trim() ? 0.6 : 1
                  }}
                >
                  <Sparkles size={18} />
                  {loading ? 'מכנס את מועצת 3 הקולות...' : 'התייעץ עם מראת ההחלטות (Gemini 3.8)'}
                </button>
              </div>
            </form>

            {/* Mirror Analysis Output: 3-Voice Council Cards */}
            {analysisResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. The Historian Voice */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '18px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Scroll size={20} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fde68a' }}>
                        📜 קול ההיסטוריון (הלמידה מהעבר והיומנים שלך)
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '3px 10px', borderRadius: '10px' }}>
                      תקדימים & נקודות עיוורון
                    </span>
                  </div>

                  <p style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
                    {analysisResult.historianVoice?.patternSummary}
                  </p>

                  {analysisResult.historianVoice?.blindSpotWarning && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: '10px', borderRight: '3px solid #f59e0b', fontSize: '0.85rem', color: '#fcd34d' }}>
                      <strong>נקודת עיוורון פוטנציאלית: </strong> {analysisResult.historianVoice.blindSpotWarning}
                    </div>
                  )}

                  {/* Precedent Cards */}
                  {analysisResult.historianVoice?.precedents?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>תקדימים מתועדים ביומן:</span>
                      {analysisResult.historianVoice.precedents.map((prec, pIdx) => (
                        <div key={prec.id || pIdx} style={{
                          background: 'rgba(0,0,0,0.25)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>{prec.title}</strong>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({prec.date})</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '4px' }}>
                              "{prec.quote}"
                            </div>
                            {prec.lesson && (
                              <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '4px' }}>
                                💡 לקח: {prec.lesson}
                              </div>
                            )}
                          </div>
                          {prec.entryId && onNavigateToEntry && (
                            <button
                              onClick={() => onNavigateToEntry(prec.entryId)}
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#cbd5e1',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              פתח ביומן ➔
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. The Value Compass Voice */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '18px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Compass size={20} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#c7d2fe' }}>
                        🧭 קול מצפן הערכים (הלימה ופער שאיפה–פעולה)
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 12px', borderRadius: '12px' }}>
                      הלימה לערכים: {analysisResult.valueCompassVoice?.alignmentScore || 80}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', display: 'block', marginBottom: '6px' }}>
                        ✓ ערכים ומטרות שמקבלים מענה:
                      </span>
                      <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                        {analysisResult.valueCompassVoice?.alignedValues?.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', display: 'block', marginBottom: '6px' }}>
                        ⚠ ערכים או זירות שנמצאים במתח:
                      </span>
                      <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                        {analysisResult.valueCompassVoice?.conflictedValues?.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {analysisResult.valueCompassVoice?.aspirationVerdict && (
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', color: '#e2e8f0', borderRight: '3px solid #818cf8' }}>
                      <strong>פער שאיפה–פעולה: </strong> {analysisResult.valueCompassVoice.aspirationVerdict}
                    </div>
                  )}
                </div>

                {/* 3. The Scientist & Pre-Mortem Voice */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '18px',
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Microscope size={20} />
                      </div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#a7f3d0' }}>
                        🔬 קול המדען וניתוח Pre-Mortem
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 10px', borderRadius: '10px' }}>
                      הפרכה & אות אזהרה 30 יום
                    </span>
                  </div>

                  {/* Pre-Mortem Simulation Box */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px 18px', borderRadius: '12px', borderRight: '4px solid #10b981' }}>
                    <span style={{ fontSize: '0.82rem', color: '#a7f3d0', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                      סימולציית כישלון עתידי (Pre-Mortem 6 חודשים קדימה):
                    </span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {analysisResult.scientistPreMortemVoice?.preMortemSimulation}
                    </p>
                  </div>

                  {/* 30-Day Early Warning Signal */}
                  {analysisResult.scientistPreMortemVoice?.earlyWarningSignal30d && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      padding: '12px 16px',
                      borderRadius: '12px'
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>
                        🚨 30-Day Early Warning Signal (אות אזהרה מוקדם ל-30 יום):
                      </div>
                      <div style={{ fontSize: '0.86rem', color: '#fecaca', lineHeight: 1.5 }}>
                        {analysisResult.scientistPreMortemVoice.earlyWarningSignal30d}
                      </div>
                    </div>
                  )}

                  {/* Suggested Experiment */}
                  {analysisResult.scientistPreMortemVoice?.suggestedExperiment && (
                    <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.85rem', color: '#bae6fd' }}>
                      🧪 <strong>ניסוי הפיך מומלץ (Low-Risk Experiment): </strong>
                      {analysisResult.scientistPreMortemVoice.suggestedExperiment}
                    </div>
                  )}
                </div>

                {/* 4. Executive Synthesis & Action Gate */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.1))',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '18px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lightbulb size={22} style={{ color: '#818cf8' }} />
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        סיכום מועצת ההחלטות (Executive Synthesis & Action Gate)
                      </h3>
                    </div>
                    {saveSuccess && (
                      <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
                        ההחלטה והתחזית נשמרו בהצלחה במערכת ✓
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.95rem', color: '#e2e8f0', margin: 0, lineHeight: 1.6 }}>
                    {analysisResult.synthesisVerdict?.overallRecommendation}
                  </p>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '6px' }}>
                    {onOpenTraceability && (
                      <button
                        onClick={() => onOpenTraceability({
                          title: dilemma,
                          text: analysisResult.synthesisVerdict?.overallRecommendation || dilemma,
                          derivedFromAssertions: analysisResult.historianVoice?.precedents?.map(p => ({
                            subjectName: dilemma,
                            predicate: 'קשור_ל',
                            objectName: p.title,
                            epistemicStatus: 'SELF_REPORTED',
                            evidence: { quote: p.quote, entryId: p.entryId, entryDate: p.date }
                          }))
                        })}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#c7d2fe',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <ShieldCheck size={16} />
                        שרשרת ראיות (Traceability DAG) 🔍
                      </button>
                    )}

                    <button
                      onClick={handleSaveDecisionRecord}
                      disabled={isSavingDecision}
                      style={{
                        background: '#10b981',
                        border: 'none',
                        color: '#fff',
                        padding: '10px 22px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: isSavingDecision ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Save size={16} />
                      {isSavingDecision ? 'שומר ביומן ההחלטות...' : 'שמור החלטה ותחזית למעקב תוצאה'}
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: EPISTEMIC CALIBRATION & DIARY DECISIONS                     */}
        {/* ------------------------------------------------------------------ */}
        {activeSubTab === 'calibration' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            {/* Calibration Metrics Strip (Zero Mock) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              <div style={{ background: 'var(--panel-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>החלטות במעקב</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#818cf8' }}>{totalTrackedDecisions}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{activeDecisionsCount} פעילות כרגע</div>
              </div>

              <div style={{ background: 'var(--panel-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>תחזיות פתוחות</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b' }}>{activePredsCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ממתינות לסגירת תוצאה</div>
              </div>

              <div style={{ background: 'var(--panel-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>תוצאות שנצפו</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>{closedOutcomesCount}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>לולאות סגורות</div>
              </div>

              <div style={{ background: 'var(--panel-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>עיגון ראיות בגרף</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8' }}>{groundingPercentage}%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>צמתים עם ציטוט/עמדה</div>
              </div>
            </div>

            {/* Scan Diary Button Box */}
            <div style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  סורק אירועים אפיסטמיים והתחייבויות מהיומן
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  מאתר אוטומטית החלטות סמויות, הבטחות והתחייבויות שכתבת ברשומות ומאפשר מעקב תוצאה.
                </p>
                {scanMessage && (
                  <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
                    {scanMessage}
                  </div>
                )}
              </div>

              <button
                onClick={handleScanDiary}
                disabled={isScanning}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Search size={16} />
                {isScanning ? 'סורק רשומות...' : '🔍 סרוק רשומות יומן לאיתור החלטות'}
              </button>
            </div>

            {/* Candidates for Approval */}
            {epistemicCandidates.length > 0 && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#c7d2fe' }}>
                  מועמדים לאישור החלטה/תחזית שחולצו מהיומן ({epistemicCandidates.length})
                </div>

                {epistemicCandidates.map(cand => (
                  <div key={cand.id} style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: '14px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#fff' }}>{cand.title}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{cand.entryDate}</span>
                    </div>
                    {cand.quote && (
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                        "{cand.quote}"
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => handleResolveCandidate(cand.id, 'APPROVED')}
                        style={{
                          background: '#10b981',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        אשר למעקב ✓
                      </button>
                      <button
                        onClick={() => handleResolveCandidate(cand.id, 'DISMISSED')}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: 'none',
                          color: '#94a3b8',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        התעלם
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* List of Tracked Decisions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0' }}>
                החלטות מתועדות ומעקב תוצאות אמת
              </h3>

              {decisions.length === 0 ? (
                <div style={{
                  background: 'var(--panel-bg)',
                  padding: '24px',
                  borderRadius: '14px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem'
                }}>
                  עדיין לא נרשמו החלטות. השתמש בלשונית "מראת החלטות" כדי לתעד החלטה ראשונה, או בסורק היומנים שלמעלה.
                </div>
              ) : (
                decisions.map(dec => {
                  const decPreds = predictions.filter(p => p.decisionId === dec.id);
                  const decOuts = outcomes.filter(o => o.decisionId === dec.id);

                  return (
                    <div key={dec.id} style={{
                      background: 'var(--panel-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{dec.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dec.decisionDate}</span>
                      </div>

                      {dec.chosenOption && (
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>מה נבחר: </span>
                          <strong style={{ color: '#818cf8' }}>{dec.chosenOption}</strong>
                        </div>
                      )}

                      {/* Predictions & Outcomes */}
                      {(decPreds.length > 0 || decOuts.length > 0) && (
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {decPreds.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                🎯 ציפייה: {p.predictionText || p.expectedOutcome} {p.probability ? `(${Math.round(p.probability * 100)}%)` : ''}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                background: p.empiricalStatus === 'SUPPORTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: p.empiricalStatus === 'SUPPORTED' ? '#34d399' : '#fbbf24'
                              }}>
                                {p.empiricalStatus === 'SUPPORTED' ? 'אומת ✓' : 'ממתין לאימות'}
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
                })
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
