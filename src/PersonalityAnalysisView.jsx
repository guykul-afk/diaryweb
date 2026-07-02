import React, { useState, useEffect } from 'react';
import { fetchPersonalityAnalysis, triggerPersonalityAnalysis, fetchFirebaseEntries } from './firebase';
import { 
  Brain, 
  TrendingUp, 
  Activity, 
  Compass, 
  User, 
  HelpCircle,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';

export default function PersonalityAnalysisView({ uid }) {
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [activeAgentTab, setActiveAgentTab] = useState('clinical');
  const [newEntriesCount, setNewEntriesCount] = useState(0);

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchPersonalityAnalysis(uid);
      let lastAnalysisTime = 0;
      if (results && results.length > 0) {
        const latest = results[0];
        setAnalysisData(latest);
        if (latest.timestamp) {
          lastAnalysisTime = latest.timestamp.toDate ? latest.timestamp.toDate().getTime() : new Date(latest.timestamp).getTime();
        }
      } else {
        setAnalysisData(getMockData());
      }

      // Dynamically fetch entries and calculate new entries count
      const entries = await fetchFirebaseEntries(uid);
      const newEntries = entries.filter(entry => {
        if (!entry.rawTimestamp) return false;
        const entryTime = entry.rawTimestamp.toDate ? entry.rawTimestamp.toDate().getTime() : new Date(entry.rawTimestamp).getTime();
        return entryTime > lastAnalysisTime;
      });
      setNewEntriesCount(newEntries.length);
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת ניתוח האישיות: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAnalysis = async (isFull = false) => {
    setIsAnalyzing(true);
    try {
      await triggerPersonalityAnalysis(uid, isFull);
      await loadAnalysis();
    } catch (err) {
      console.error(err);
      alert('שגיאה בהפעלת הניתוח מהשרת: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };


  useEffect(() => {
    if (uid) {
      loadAnalysis();
    }
  }, [uid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--text-muted)' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>טוען ניתוח אישיות רב-סוכני...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        <div>{error}</div>
        <button onClick={loadAnalysis} style={{ marginTop: '12px', padding: '8px 16px', cursor: 'pointer' }}>נסה שוב</button>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        לא נמצא ניתוח אישיות עבור משתמש זה.
      </div>
    );
  }

  const { executive_summary, reports, metrics, timestamp, new_entries_since_last_analysis } = analysisData;
  const ocean = metrics.ocean || { o: 50, c: 50, e: 50, a: 50, n: 50 };
  const linguistic = metrics.linguistic || { emotional_density: 50, self_focus: 50, stress_level: 50 };

  const oceanLabels = [
    { key: 'o', name: 'פתיחות לחוויות (Openness)', value: ocean.o, desc: 'סקרנות, דמיון ויצירתיות מול שמרנות' },
    { key: 'c', name: 'מכוונות ומצפוניות (Conscientiousness)', value: ocean.c, desc: 'משמעת עצמית, סדר ואחריות מול ספונטניות' },
    { key: 'e', name: 'מוחצנות (Extraversion)', value: ocean.e, desc: 'חיפוש ריגושים וחברתיות מול מופנמות ושקט' },
    { key: 'a', name: 'נעימות (Agreeableness)', value: ocean.a, desc: 'אמפתיה, שיתוף פעולה ואמון מול תחרותיות' },
    { key: 'n', name: 'נוירוטיות (Neuroticism)', value: ocean.n, desc: 'רגישות רגשית ופגיעות מול יציבות וחוסן' }
  ];

  const agentMetaData = {
    clinical: { title: 'פסיכיאטר קליני', icon: Activity, desc: 'ניתוח סימפטומים, מצבי רוח ודפוסי פסיכופתולוגיה לפי ה-DSM-5' },
    psychodynamic: { title: 'סוכן פסיכודינמי', icon: Compass, desc: 'ניתוח מנגנוני הגנה (הדחקה, השלכה), ארכיטיפים יונגיאניים ויחסי אובייקט' },
    cbt: { title: 'סוכן קוגניטיבי (CBT)', icon: Brain, desc: 'זיהוי עיוותי חשיבה (שחור-לבן, קטסטרופיזציה), אמונות ליבה ומשולש CBT' },
    behavioral: { title: 'ניתוח התנהגות (BCBA)', icon: TrendingUp, desc: 'ניתוח פונקציונלי של תגובות, זיהוי טריגרים וחיזוקים משמרים' },
    humanistic: { title: 'הומניסטי-אקזיסטנציאלי', icon: User, desc: 'בחינת שאלות קיומיות, משמעות בחיים, בדידות ורמת מימוש עצמי' }
  };

  const activeAgent = agentMetaData[activeAgentTab];
  const activeAgentReport = activeAgentTab === 'boardroom' ? '' : (reports[activeAgentTab] || 'אין מידע זמין מסוכן זה.');

  const renderBoardroomDialogue = (reportsData) => {
    const clinicalReport = reportsData.clinical || '';
    const dynamicReport = reportsData.psychodynamic || '';
    const cbtReport = reportsData.cbt || '';
    const behavioralReport = reportsData.behavioral || '';
    const humanisticReport = reportsData.humanistic || '';

    const dialogue = [
      {
        agent: 'clinical',
        name: 'ד"ר מילר (קליני)',
        avatarColor: '#00355f',
        message: `שלום עמיתיי. בואו נפתח את ישיבת הניתוח השבועית לגבי גיא. מבחינה קלינית, סקרתי את מצב הרוח והסימפטומים העיקריים. הנה עיקרי הדברים:
        
        "${clinicalReport.split('.')[0] || 'מצב הרוח מראה תנודתיות תגובתית לעומס.'}."`
      },
      {
        agent: 'cbt',
        name: 'פרופ\' כהן (CBT)',
        avatarColor: '#005f9e',
        message: `תודה, ד"ר מילר. זה מתקשר ישירות לעיוותי החשיבה שזיהיתי ברשומות. גיא נוטה להכללת יתר ולקריאת מחשבות שמגבירות את החרדה הזו. מניתוח קוגניטיבי עולה כי:
        
        "${cbtReport.split('.')[0] || 'עולה נטייה לפרפקציוניזם המזין את עצמו.'}."
        
        המשולש הקוגניטיבי מראה שהערכת היכולת שלו תלויה לחלוטין באישור חיצוני.`
      },
      {
        agent: 'psychodynamic',
        name: 'ד"ר יונג (פסיכודינמי)',
        avatarColor: '#2b78b0',
        message: `אני מסכים עם הניתוח, אך עלינו להסתכל עמוק יותר. הפרפקציוניזם הזה הוא מנגנון הגנה קלאסי של רציונליזציה והעתקה. הוא מעתיק את כעסיו כלפי דמויות סמכות פנימה בצורת סופר-אגו נוקשה. כפי שכתבתי בדוח הפסיכודינמי:
        
        "${dynamicReport.split('.')[0] || 'מנגנוני ההגנה הפעילים הם רציונליזציה והשלכה.'}."
        
        הצל (Shadow) שלו עולה לעיתים קרובות סביב הקונפליקט של כניעה לעומת מרדנות.`
      },
      {
        agent: 'behavioral',
        name: 'פרופ\' סקינר (BCBA)',
        avatarColor: '#5e98c8',
        message: `עמיתיי, עם כל הכבוד לתהליכים הפנימיים, בואו נסתכל על ההתנהגות בפועל ועל מה שמשמר אותה. הטריגר המרכזי הוא קבלת ביקורת או חוסר ודאות במשימות.
        
        מבחינה התנהגותית:
        "${behavioralReport.split('.')[0] || 'טריגרים מרכזיים להתנהגויות הימנעות זוהו בעבודה.'}."
        
        החיזוק השלילי כאן הוא הסרת החרדה המיידית - הוא עובד קשה כדי להימנע מתחושת הכישלון.`
      },
      {
        agent: 'humanistic',
        name: 'ד"ר רוג\'רס (הומניסטי)',
        avatarColor: '#708a9f',
        message: `תודה לכולם. אני רוצה להזכיר שמעבר לסימפטומים ולהתנהגויות, גיא מנסה למצוא משמעות קיומית ואותנטיות. הוא שואף למימוש עצמי אך חווה קונפליקט מול הצורך בריצוי חברתי. בדוח שלי הדגשתי כי:
        
        "${humanisticReport.split('.')[0] || 'קיימת שאיפה חזקה לאותנטיות המתנגשת עם צרכי ריצוי.'}."
        
        עלינו לעזור לו לחבק את חופש הבחירה שלו ולהתמודד עם חרדת האחריות הנלווית אליו.`
      }
    ];

    return dialogue.map((turn, index) => {
      const Meta = agentMetaData[turn.agent] || { icon: Brain };
      const Icon = Meta.icon;
      return (
        <div 
          key={index} 
          style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'flex-start',
            backgroundColor: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: '4px'
          }}
        >
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '50%', 
            backgroundColor: turn.avatarColor, 
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Icon size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', flexGrow: 1 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{turn.name}</span>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>
              {turn.message}
            </p>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="personality-analysis-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box', direction: 'rtl', gap: '24px' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain style={{ color: 'var(--accent-color)' }} />
            ניתוח אישיות רב-סוכני (MAS)
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            ניתוח אחרון: {timestamp ? new Date(timestamp).toLocaleDateString('he-IL') : 'לא בוצע ניתוח'}
          </p>
        </div>

        {/* Sync / Progress Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--accent-light)', padding: '10px 16px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>רשומות מאז הניתוח האחרון</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <div style={{ width: '120px', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((newEntriesCount / 30) * 100, 100)}%`, height: '100%', backgroundColor: 'var(--accent-color)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, direction: 'ltr', display: 'inline-block' }}>{newEntriesCount} / 30</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Delta Update Button */}
            <button 
              onClick={() => handleTriggerAnalysis(false)} 
              disabled={isAnalyzing}
              style={{ 
                backgroundColor: 'transparent', 
                color: 'var(--accent-color)', 
                border: '1px solid var(--accent-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '8px 14px', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isAnalyzing ? 0.7 : 1
              }}
              title="עדכון הניתוח הקיים באמצעות הרשומות החדשות בלבד"
            >
              <RefreshCw size={14} className={isAnalyzing ? "spin" : ""} />
              עדכון תקופתי (Delta)
            </button>

            {/* Full Analysis Button */}
            <button 
              onClick={() => handleTriggerAnalysis(true)} 
              disabled={isAnalyzing}
              style={{ 
                backgroundColor: 'var(--accent-color)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 'var(--radius-md)', 
                padding: '8px 16px', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isAnalyzing ? 0.7 : 1,
                boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
              }}
              title="ביצוע ניתוח מקיף מחדש של כל הרשומות לאורך כל ההיסטוריה"
            >
              <Sparkles size={14} />
              ביצוע ניתוח פסיכולוגי מלא
            </button>
          </div>
          <button onClick={loadAnalysis} className="sidebar-btn" style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="רענן נתונים">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', flexGrow: 1 }}>
        
        {/* Left Column: Summary & Agent Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Executive Summary */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
             <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Sparkles size={18} style={{ color: 'var(--accent-color)' }} />
               סיכום אינטגרטיבי (Orchestrator)
             </h2>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
              {executive_summary}
            </div>
          </section>

          {/* Detailed Agent Analysis Tabs */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>ניתוחים ייעודיים לפי אסכולות פסיכולוגיות</h2>
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {Object.entries(agentMetaData).map(([key, meta]) => {
                const Icon = meta.icon;
                const isActive = activeAgentTab === key;
                return (
                  <button 
                    key={key}
                    onClick={() => setActiveAgentTab(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      border: 'none',
                      background: isActive ? 'var(--accent-light)' : 'transparent',
                      color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Icon size={14} />
                    {meta.title}
                  </button>
                );
              })}
            </div>

            {/* Active Agent Report View */}
            {activeAgentTab === 'boardroom' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', paddingLeft: '8px' }}>
                {renderBoardroomDialogue(reports)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--accent-light)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  {activeAgent.desc}
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-line', maxHeight: '300px', overflowY: 'auto', paddingLeft: '8px' }}>
                  {activeAgentReport}
                </div>
              </div>
            )}

          </section>
        </div>

        {/* Right Column: Quantitative Dashboards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* OCEAN Card */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>פרופיל אישיות (מודל OCEAN)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {oceanLabels.map(label => (
                <div key={label.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{label.name}</span>
                    <span style={{ color: 'var(--accent-color)' }}>{label.value}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: '#F3F3F3', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${label.value}%`, height: '100%', backgroundColor: 'var(--accent-color)', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Natural Language Insights (NLP) */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-md)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>מדדי שפה רגשיים (NLP Insights)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Density */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>צפיפות רגשית בטקסט</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{linguistic.emotional_density}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F3F3F3', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.emotional_density}%`, height: '100%', backgroundColor: 'var(--accent-color)', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Self Focus */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>מיקוד עצמי (שימוש בגוף ראשון)</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{linguistic.self_focus}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F3F3F3', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.self_focus}%`, height: '100%', backgroundColor: 'var(--accent-color)', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Stress Level */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>מדד מתח ומצוקה משוער</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{linguistic.stress_level}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F3F3F3', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.stress_level}%`, height: '100%', backgroundColor: '#ef4444', borderRadius: '3px' }} />
                </div>
              </div>

            </div>
          </section>

        </div>

      </div>

    </div>
  );
}

// Mock Data for demonstration when database collection is empty
function getMockData() {
  return {
    timestamp: new Date().toISOString(),
    new_entries_since_last_analysis: 12,
    metrics: {
      ocean: {
        o: 78,
        c: 62,
        e: 45,
        a: 81,
        n: 58
      },
      linguistic: {
        emotional_density: 68,
        self_focus: 74,
        stress_level: 40
      }
    },
    executive_summary: `מתוך בחינת הרשומות עולה תמונה של אדם בעל מודעות עצמית גבוהה ופתיחות אינטלקטואלית ניכרת. הכותב נוטה לנתח את רגשותיו לעומק (מה שמתיישב עם רמת נוירוטיות מתונה ופתיחות גבוהה). 
נצפים דפוסים חוזרים של התמודדות עם מתח באמצעות אינטלקטואליזציה ורציונליזציה, במיוחד סביב יחסים בין-אישיים. מפת הקשרים (OKF) מראה כי מושגים של 'עבודה' ו'הגשמה' קשורים במידה רבה לתחושות של עומס, אך גם מהווים עוגן חיובי של שליטה.
סגנון ההתקשרות נוטה להיות בטוח בבסיסו עם אלמנטים חרדתיים קלים שמופיעים במצבי לחץ חריפים.`,
    reports: {
      clinical: `לא זוהו סממנים קליניים חריפים של הפרעות אישיות או אפיזודות פסיכוטיות. ישנם רמזים לתנודות מצב רוח תגובתיות (Reactive Mood Swings) הקשורות לעומס בעבודה, אך הן אינן עומדות בקריטריונים של DSM-5 להפרעת מצב רוח מג'ורית. נצפתה שינה לא סדירה בתקופות של לחץ מוגבר.`,
      psychodynamic: `שימוש בולט במנגנון הגנה של 'רציונליזציה' ו'העתקה'. הכותב נוטה להעתיק כעסים המופנים כלפי דמויות סמכות (כגון מנהלים) לשיח פנימי של ביקורת עצמית. 
ארכיטיפ ה'צל' (Shadow) עולה לעיתים קרובות סביב תכנים של כניעה לעומת מרדנות. יחסי אובייקט מוקדמים משתקפים כצורך חזק באישור והימנעות מעימותים ישירים כדי לשמר קשרים יציבים.`,
      cbt: `עיוותי חשיבה בולטים: 'הכללת יתר' ("תמיד הכל נופל עלי") ו'קריאת מחשבות' ("הוא בטוח חושב שאני לא מספיק טוב").
משולש ה-CBT מראה כי אירועים בעבודה מתפרשים אוטומטית כ"מבחן ליכולת האישית", מה שמוביל לרגש של חרדה והתנהגות של עבודה מוגברת ופרפקציוניזם המזינה את עצמה.`,
      behavioral: `טריגרים מרכזיים להתנהגויות הימנעות: קבלת ביקורת או חוסר ודאות לגבי משימות.
התנהגות היעד: פרפקציוניזם ועבודה עד שעות מאוחרות.
חיזוק משמר: הסרת החרדה בטווח הקצר (חיזוק שלילי) וקבלת שבחים מהסביבה בטווח הארוך (חיזוק חיובי).`,
      humanistic: `הכותב עסוק רבות בשאלות של משמעות קיומית ומימוש עצמי. קיימת שאיפה חזקה לאותנטיות, אך היא מתנגשת לעיתים קרובות עם הצורך בריצוי חברתי. רמת המימוש העצמי משתקפת כבינונית-גבוהה, כשהכותב מזהה את חופש הבחירה שלו אך מתקשה לשאת באחריות ובחרדה הנלווית אליו.`
    }
  };
}
