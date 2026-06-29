import React, { useState, useEffect } from 'react';
import { fetchPersonalityAnalysis, triggerPersonalityAnalysis } from './firebase';
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

  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchPersonalityAnalysis(uid);
      if (results && results.length > 0) {
        setAnalysisData(results[0]); // Take the most recent analysis
      } else {
        // Fallback mock data if none exists yet in Firestore
        setAnalysisData(getMockData());
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת ניתוח האישיות: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await triggerPersonalityAnalysis(uid);
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
  const activeAgentReport = reports[activeAgentTab] || 'אין מידע זמין מסוכן זה.';

  return (
    <div className="personality-analysis-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box', direction: 'rtl', gap: '24px' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain style={{ color: '#8b5cf6' }} />
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
                <div style={{ width: `${Math.min((new_entries_since_last_analysis / 30) * 100, 100)}%`, height: '100%', backgroundColor: '#8b5cf6' }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{new_entries_since_last_analysis} / 30</span>
            </div>
          </div>
          <button 
            onClick={handleTriggerAnalysis} 
            disabled={isAnalyzing}
            style={{ 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              border: 'none', 
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
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={14} className="spin" />
                מנתח...
              </>
            ) : (
              <>
                <Brain size={14} />
                הרץ ניתוח חדש
              </>
            )}
          </button>
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
              <Sparkles size={18} style={{ color: '#eab308' }} />
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
                      color: isActive ? '#8b5cf6' : 'var(--text-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      borderBottom: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--accent-light)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                {activeAgent.desc}
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-line', maxHeight: '300px', overflowY: 'auto', paddingLeft: '8px' }}>
                {activeAgentReport}
              </div>
            </div>

          </section>
        </div>

        {/* Right Column: Quantitative Dashboards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* OCEAN Card */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>פרופיל אישיות (מודל OCEAN)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {oceanLabels.map(label => (
                <div key={label.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>{label.name}</span>
                    <span style={{ color: '#8b5cf6' }}>{label.value}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${label.value}%`, height: '100%', backgroundColor: '#8b5cf6', borderRadius: '4px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Natural Language Insights (NLP) */}
          <section className="analysis-card" style={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>מדדי שפה רגשיים (NLP Insights)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Density */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>צפיפות רגשית בטקסט</span>
                  <span style={{ fontWeight: 600 }}>{linguistic.emotional_density}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.emotional_density}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                </div>
              </div>

              {/* Self Focus */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>מיקוד עצמי (שימוש בגוף ראשון)</span>
                  <span style={{ fontWeight: 600 }}>{linguistic.self_focus}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.self_focus}%`, height: '100%', backgroundColor: '#10b981' }} />
                </div>
              </div>

              {/* Stress Level */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>מדד מתח ומצוקה משוער</span>
                  <span style={{ fontWeight: 600 }}>{linguistic.stress_level}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${linguistic.stress_level}%`, height: '100%', backgroundColor: '#ef4444' }} />
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
