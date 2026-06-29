import React, { useState, useEffect, useMemo } from 'react';
import { fetchOriginalInsights, fetchFirebaseEntries } from './firebase';
import { 
  Lightbulb, 
  Brain, 
  TrendingUp, 
  Shield, 
  Activity, 
  RefreshCw, 
  Sparkles,
  History,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Heart,
  Briefcase,
  BookOpen,
  Calendar,
  Search,
  MessageSquare
} from 'lucide-react';

export default function InsightsView({ uid }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Original Insights Data (from users/{uid}/insights/current)
  const [originalInsights, setOriginalInsights] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  
  // Raw Journal Entries containing insights
  const [entries, setEntries] = useState([]);
  
  // Active Sidebar Tab: 'major', 'manual', 'history', 'reflections', 'categorical', 'raw_insights'
  const [activeTab, setActiveTab] = useState('major');
  
  // Expanded Advice item timestamp
  const [expandedAdviceId, setExpandedAdviceId] = useState(null);

  // Toggle to show all history advices expanded in a scrollable format
  const [showAllExpanded, setShowAllExpanded] = useState(false);

  // Search filter for raw insights
  const [rawInsightsSearchQuery, setRawInsightsSearchQuery] = useState('');

  const fetchInsightsData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!uid) {
        throw new Error('חיבור לפיירבייס לא אותחל עדיין. אנא המתן...');
      }
      
      const [originalData, entriesData] = await Promise.all([
        fetchOriginalInsights(uid),
        fetchFirebaseEntries(uid)
      ]);
      
      setOriginalInsights(originalData);
      setEntries(entriesData || []);

      // Extract advice history
      let historyArray = [];
      if (originalData && originalData.advices && originalData.advices.history) {
        // Sort newest first
        historyArray = [...originalData.advices.history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
      setHistoryList(historyArray);

      if (historyArray.length > 0) {
        setExpandedAdviceId(historyArray[0].timestamp || 0);
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הנתונים מהשרת: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchInsightsData();
    }
  }, [uid]);

  // Filter raw insights by search query
  const filteredEntriesWithInsights = useMemo(() => {
    return entries
      .filter(entry => entry.insights && entry.insights.length > 0)
      .map(entry => {
        if (!rawInsightsSearchQuery.trim()) return entry;
        
        const query = rawInsightsSearchQuery.toLowerCase();
        const matchingInsights = entry.insights.filter(ins => 
          ins.toLowerCase().includes(query)
        );
        
        return {
          ...entry,
          filteredInsights: matchingInsights
        };
      })
      .filter(entry => {
        if (!rawInsightsSearchQuery.trim()) return true;
        return entry.filteredInsights && entry.filteredInsights.length > 0;
      });
  }, [entries, rawInsightsSearchQuery]);

  const formatTimestamp = (ts) => {
    if (!ts) return 'תאריך לא ידוע';
    const timestampNumber = Number(ts);
    const dateObj = new Date(timestampNumber);
    
    if (isNaN(dateObj.getTime())) return 'תאריך לא תקין';
    return dateObj.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to count total raw insights
  const totalRawInsightsCount = useMemo(() => {
    return entries.reduce((acc, entry) => acc + (entry.insights?.length || 0), 0);
  }, [entries]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--text-muted)' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>טוען תובנות מהשרת...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
        <div>{error}</div>
        <button onClick={fetchInsightsData} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>נסה שוב</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', direction: 'rtl' }}>
      
      {/* Sidebar Navigation */}
      <div style={{
        width: '260px',
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--panel-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '8px',
        flexShrink: 0
      }}>
        <div style={{ marginBottom: '16px', padding: '0 8px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Sparkles size={20} style={{ color: '#8b5cf6' }} />
            תובנות המערכת
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ריכוז כל תובנות המערכת המקורית ומדריכי ההפעלה האישיים.
          </p>
        </div>

        {[
          { id: 'major', label: 'תובנות מפתח', icon: Lightbulb, color: '#10b981' },
          { id: 'manual', label: 'מדריך הפעלה אישי', icon: BookOpen, color: '#8b5cf6' },
          { id: 'history', label: 'היסטוריית המלצות', icon: History, color: '#3b82f6' },
          { id: 'reflections', label: 'עבודה בצל ורפלקציה', icon: Brain, color: '#f59e0b' },
          { id: 'categorical', label: 'תובנות לפי תחומים', icon: Activity, color: '#ec4899' },
          { id: 'raw_insights', label: 'תובנות גולמיות מהיומן', icon: MessageSquare, color: '#06b6d4' }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'right',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--accent-light)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={18} style={{ color: isActive ? tab.color : 'var(--text-muted)' }} />
              {tab.label}
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            תובנות מפתח: <strong style={{ color: 'var(--text-primary)' }}>{originalInsights?.majorInsights?.length || 0}</strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            תובנות יומן גולמיות: <strong style={{ color: 'var(--text-primary)' }}>{totalRawInsightsCount}</strong>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            המלצות שנצברו: <strong style={{ color: 'var(--text-primary)' }}>{historyList.length}</strong>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-color)' }}>
        
        {/* Top Header */}
        <div style={{
          padding: '24px 40px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--panel-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeTab === 'major' && 'תובנות מפתח תקופתיות'}
              {activeTab === 'manual' && 'מדריך הפעלה אישי'}
              {activeTab === 'history' && 'יומן היסטוריית המלצות'}
              {activeTab === 'reflections' && 'עבודת צללים ורפלקציה עצמית'}
              {activeTab === 'categorical' && 'תובנות ממוקדות לפי תחומי חיים'}
              {activeTab === 'raw_insights' && 'תובנות גולמיות מכל כניסת יומן'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              {activeTab === 'major' && 'עקרונות, קונפליקטים ותמות מובילות שזוהו לאורך כתיבת היומן.'}
              {activeTab === 'manual' && 'קווים מנחים לפעולה, טריגרים והנחיות מניעה לפעילות מיטבית.'}
              {activeTab === 'history' && 'ארכיון כל ההמלצות והעצות שניתנו לך בנושאי משפחה, עבודה ומנטלי.'}
              {activeTab === 'reflections' && 'ניתוחים שבועיים, יומיים ועבודת מעמקים עם החלקים הנסתרים.'}
              {activeTab === 'categorical' && 'ניתוח מרוכז של דפוסים בעבודה, ביחסים וברמה האישית.'}
              {activeTab === 'raw_insights' && 'כל התובנות הנקודתיות שנוצרו אוטומטית מתוך התמלולים והטקסטים שכתבת.'}
            </p>
          </div>

          <button 
            onClick={fetchInsightsData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid var(--border-color)',
              background: 'var(--panel-bg)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            <RefreshCw size={14} />
            רענן נתונים
          </button>
        </div>

        {/* Scrollable Content Pane */}
        <div style={{ flexGrow: 1, padding: '40px', overflowY: 'auto' }}>
          
          {/* TAB 1: MAJOR INSIGHTS */}
          {activeTab === 'major' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
              {(!originalInsights?.majorInsights || originalInsights.majorInsights.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>לא נמצאו תובנות מפתח זמינות בשרת.</div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                  gap: '20px'
                }}>
                  {originalInsights.majorInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '24px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        borderRight: `4px solid ${idx % 2 === 0 ? '#8b5cf6' : '#10b981'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--accent-light)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>תובנה מנותחת</span>
                      </div>
                      <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OPERATING MANUAL */}
          {activeTab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {originalInsights?.operatingManual?.insight?.title || 'מדריך ההפעלה האישי של גיא'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  עודכן לאחרונה: {originalInsights?.operatingManual?.lastDate || 'לא ידוע'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {originalInsights?.operatingManual?.insight?.sections?.map((section, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'var(--panel-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '24px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '16px', borderBottom: '1px solid var(--accent-light)', paddingBottom: '10px' }}>
                      {section.title}
                    </h4>
                    <ul style={{ paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {section.bullets?.map((bullet, bIdx) => (
                        <li 
                          key={bIdx} 
                          style={{ 
                            fontSize: '0.9rem', 
                            color: 'var(--text-secondary)', 
                            lineHeight: 1.6,
                            listStyleType: 'disc'
                          }}
                          dangerouslySetInnerHTML={{
                            __html: bullet.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ADVICE HISTORY TIMELINE */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>יומן היסטוריית המלצות</h3>
                <button
                  onClick={() => setShowAllExpanded(!showAllExpanded)}
                  style={{
                    padding: '6px 14px',
                    border: '1px solid var(--border-color)',
                    background: showAllExpanded ? 'var(--accent-color)' : 'var(--panel-bg)',
                    color: showAllExpanded ? '#fff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {showAllExpanded ? 'תצוגה מקופצת (אקורדיון)' : 'הצג הכל מורחב (רשימה נגללת)'}
                </button>
              </div>

              {historyList.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>לא נמצאה היסטוריית עצות בשרת.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {historyList.map((advice, idx) => {
                    const isExpanded = showAllExpanded || expandedAdviceId === advice.timestamp;
                    return (
                      <div 
                        key={advice.timestamp || idx}
                        style={{
                          background: 'var(--panel-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-sm)',
                          overflow: 'hidden'
                        }}
                      >
                        <div 
                          onClick={() => !showAllExpanded && handleToggleAdviceExpand(advice.timestamp)}
                          style={{
                            padding: '18px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: showAllExpanded ? 'default' : 'pointer',
                            background: isExpanded && !showAllExpanded ? 'var(--accent-light)' : 'var(--panel-bg)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: idx === 0 ? '#8b5cf6' : 'var(--border-color)',
                              color: idx === 0 ? '#fff' : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.85rem',
                              fontWeight: 700
                            }}>
                              {historyList.length - idx}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>המלצות לחיים ולעבודה</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              {formatTimestamp(advice.timestamp)}
                            </span>
                          </div>
                          {!showAllExpanded && (
                            <div>
                              {idx === 0 && <span style={{ fontSize: '0.7rem', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '100px', fontWeight: 600, marginLeft: '8px' }}>האחרון</span>}
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                              <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#3b82f6', fontWeight: 700, marginBottom: '10px' }}>
                                <Briefcase size={16} />
                                קריירה ועבודה
                              </h5>
                              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{advice.work || 'אין מידע.'}</p>
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                              <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#10b981', fontWeight: 700, marginBottom: '10px' }}>
                                <Brain size={16} />
                                אישי ומנטלי
                              </h5>
                              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{advice.mental || 'אין מידע.'}</p>
                            </div>
                            <div style={{ background: 'rgba(236, 72, 153, 0.03)', border: '1px solid rgba(236, 72, 153, 0.1)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                              <h5 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#ec4899', fontWeight: 700, marginBottom: '10px' }}>
                                <Heart size={16} />
                                זוגיות ומשפחה
                              </h5>
                              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>{advice.family || 'אין מידע.'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REFLECTIONS */}
          {activeTab === 'reflections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
              {/* Weekly reflection */}
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} style={{ color: '#eab308' }} />
                  תובנה שבועית מרוכזת
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>ניתוח על שגרת השבוע האחרון</div>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-line', margin: 0 }}>
                  {originalInsights?.weeklyInsight || 'אין תובנה שבועית זמינה כעת.'}
                </p>
              </div>

              {/* Shadow Work reflection */}
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={20} style={{ color: '#f59e0b' }} />
                  עבודת צללים (Shadow Work)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                  <Clock size={12} />
                  עודכן ב: {originalInsights?.shadowWork?.lastDate || 'לא ידוע'}
                </span>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-line', margin: 0 }}>
                  {originalInsights?.shadowWork?.insight || 'אין מידע זמין עבור עבודת הצללים.'}
                </p>
              </div>

              {/* Daily GTD */}
              {originalInsights?.dailyGtd && (
                <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} style={{ color: '#10b981' }} />
                    ניתוח יומיומי (Daily GTD)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                    <Clock size={12} />
                    תאריך: {originalInsights?.dailyGtd?.lastDate || 'לא ידוע'}
                  </span>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-line', margin: 0 }}>
                    {originalInsights?.dailyGtd?.insight || 'אין מידע יומי זמין.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CATEGORICAL INSIGHTS */}
          {activeTab === 'categorical' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#3b82f6', fontWeight: 700, marginBottom: '12px' }}>
                    <Briefcase size={18} />
                    עבודה וקריירה
                  </h4>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                    {originalInsights?.categoricalInsights?.work || 'אין מידע זמין.'}
                  </p>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#10b981', fontWeight: 700, marginBottom: '12px' }}>
                    <User size={18} />
                    אישי ומנטלי
                  </h4>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                    {originalInsights?.categoricalInsights?.personal || 'אין מידע זמין.'}
                  </p>
                </div>

                <div style={{ background: 'rgba(236, 72, 153, 0.03)', border: '1px solid rgba(236, 72, 153, 0.1)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', color: '#ec4899', fontWeight: 700, marginBottom: '12px' }}>
                    <Heart size={18} />
                    משפחה וזוגיות
                  </h4>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                    {originalInsights?.categoricalInsights?.family || 'אין מידע זמין.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RAW JOURNAL INSIGHTS (SCROLLABLE LIST) */}
          {activeTab === 'raw_insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px' }}>
              
              {/* Search Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>תובנות גולמיות מהיומן</h3>
                
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                  <input 
                    type="text" 
                    placeholder="חפש בתובנות הגולמיות..."
                    value={rawInsightsSearchQuery}
                    onChange={(e) => setRawInsightsSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 16px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      background: 'var(--panel-bg)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {filteredEntriesWithInsights.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--text-muted)' }}>
                  <MessageSquare size={36} strokeWidth={1.5} />
                  <div>לא נמצאו תובנות גולמיות העונות על החיפוש.</div>
                </div>
              ) : (
                /* Continuous Scrollable List */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {filteredEntriesWithInsights.map((entry, idx) => {
                    const insightsList = entry.filteredInsights || entry.insights;
                    return (
                      <div 
                        key={entry.id || idx}
                        style={{
                          background: 'var(--panel-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '20px 24px',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--accent-light)', paddingBottom: '10px' }}>
                          <Calendar size={16} style={{ color: '#06b6d4' }} />
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            רשומת יומן מתאריך: {entry.frontmatter?.date || 'לא ידוע'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                            {insightsList.length} תובנות
                          </span>
                        </div>

                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '12px' }}>
                          {insightsList.map((ins, insIdx) => (
                            <li 
                              key={insIdx} 
                              style={{ 
                                fontSize: '0.88rem', 
                                color: 'var(--text-secondary)', 
                                lineHeight: 1.5,
                                listStyleType: 'decimal',
                                paddingRight: '4px'
                              }}
                            >
                              {ins}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
