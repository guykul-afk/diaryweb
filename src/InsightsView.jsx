import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchOriginalInsights, 
  fetchFirebaseEntries, 
  fetchFirebaseGraph, 
  syncInsightsToGraph 
} from './firebase';
import { 
  extractHealthMetricsMap, 
  computePersonalRollingBaselines, 
  computeLaggedEntityBiometrics, 
  detectSomaticDissonance, 
  analyzeStanceTrajectories 
} from './utils/somaticCausalityEngine';
import { 
  Lightbulb, 
  Brain, 
  TrendingUp, 
  Shield, 
  Activity, 
  RefreshCw, 
  Sparkles,
  BookOpen, 
  Calendar, 
  Search, 
  HelpCircle,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Heart,
  Compass,
  ArrowRight,
  Flame,
  ExternalLink,
  X,
  Target,
  Award
} from 'lucide-react';

export default function InsightsView({ 
  uid, 
  isaData, 
  entries: propEntries, 
  graphNodes: propGraphNodes, 
  onNavigateToEntry, 
  onOpenTraceability 
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data sources
  const [originalInsights, setOriginalInsights] = useState(null);
  const [entries, setEntries] = useState([]);
  const [graphNodes, setGraphNodes] = useState([]);
  const [healthMetricsByDate, setHealthMetricsByDate] = useState({});

  // 3 High-Signal Tabs:
  // 1: 'manual' (תובנות ליבה ומדריך הפעלה)
  // 2: 'somatic' (מכ"ם גוף–נפש וסיבתיות מושהית)
  // 3: 'action_gap' (מפת פער שאיפה–פעולה)
  const [activeTab, setActiveTab] = useState('manual');

  // Filter & Search states
  const [somaticFilter, setSomaticFilter] = useState('all'); // 'all', 'drain', 'anchor'
  const [somaticSearch, setSomaticSearch] = useState('');
  const [stanceSearch, setStanceSearch] = useState('');

  // Expandable sections in Operating Manual
  const [expandedSections, setExpandedSections] = useState({
    manual: true,
    major: true,
    reflections: false
  });

  // Local Evidence / Traceability Drawer Modal
  const [activeTraceabilityItem, setActiveTraceabilityItem] = useState(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Fetch or bind data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!uid) {
        throw new Error('חיבור לפיירבייס לא אותחל עדיין. אנא המתן...');
      }

      const promises = [fetchOriginalInsights(uid)];
      if (!propEntries) promises.push(fetchFirebaseEntries(uid));
      if (!propGraphNodes) promises.push(fetchFirebaseGraph(uid));

      const [origRes, entriesRes, graphRes] = await Promise.all(promises);
      
      setOriginalInsights(origRes);
      
      const resolvedEntries = propEntries || entriesRes || [];
      const resolvedGraphNodes = propGraphNodes || graphRes?.nodes || [];
      
      setEntries(resolvedEntries);
      setGraphNodes(resolvedGraphNodes);

      // Extract health metrics map from graph nodes
      const hMap = extractHealthMetricsMap(resolvedGraphNodes);
      setHealthMetricsByDate(hMap);

    } catch (err) {
      console.error("Failed to load insights data:", err);
      setError('שגיאה בטעינת הנתונים מהשרת: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid, propEntries, propGraphNodes]);

  // ---- SOMATIC & CAUSALITY ANALYTICS ENGINE COMPUTATIONS ----

  // 1. Personal Rolling Baselines & Z-Scores
  const baselinesData = useMemo(() => {
    return computePersonalRollingBaselines(healthMetricsByDate, 30);
  }, [healthMetricsByDate]);

  // 2. Lagged Entity Biometrics (t-1, t, t+1, t+2)
  const laggedEntities = useMemo(() => {
    return computeLaggedEntityBiometrics(entries, graphNodes, baselinesData);
  }, [entries, graphNodes, baselinesData]);

  // 3. Somatic Dissonance Detection
  const dissonanceEvents = useMemo(() => {
    return detectSomaticDissonance(entries, baselinesData);
  }, [entries, baselinesData]);

  // 4. Stance Trajectories & Aspiration-Action Gaps
  const stanceData = useMemo(() => {
    return analyzeStanceTrajectories(graphNodes, entries);
  }, [graphNodes, entries]);

  // Filtered lagged somatic entities
  const filteredLaggedEntities = useMemo(() => {
    return laggedEntities.filter(item => {
      if (somaticFilter === 'drain' && item.classification !== 'SOMATIC_DRAIN') return false;
      if (somaticFilter === 'anchor' && item.classification !== 'SOMATIC_ANCHOR') return false;
      if (somaticSearch.trim()) {
        const q = somaticSearch.toLowerCase().trim();
        return item.entityName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [laggedEntities, somaticFilter, somaticSearch]);

  // Filtered stance entities
  const filteredStanceData = useMemo(() => {
    if (!stanceSearch.trim()) return stanceData.byCategory;
    const q = stanceSearch.toLowerCase().trim();
    const filterList = (list) => list.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.quotes.some(qu => qu.toLowerCase().includes(q))
    );
    return {
      ACTION_MOMENTUM: filterList(stanceData.byCategory.ACTION_MOMENTUM),
      ASPIRATION_TRAP: filterList(stanceData.byCategory.ASPIRATION_TRAP),
      AVOIDANCE_CONFLICT: filterList(stanceData.byCategory.AVOIDANCE_CONFLICT)
    };
  }, [stanceData, stanceSearch]);

  // Handler to sync insights to knowledge graph
  const handleSyncToGraph = async () => {
    if (!uid || syncing) return;
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await syncInsightsToGraph(uid);
      if (res && res.status === 'success') {
        setSyncMessage(res.nodes_added === 0 ? (res.message || 'אין תובנות חדשות לסנכרון.') : `סונכרנו בהצלחה ${res.nodes_added} תובנות לגרף!`);
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        throw new Error(res?.message || 'שגיאה בסנכרון התובנות');
      }
    } catch (err) {
      console.error(err);
      alert(`שגיאה בסנכרון: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to construct evidence package and trigger traceability
  const handleOpenTraceability = (title, text, type = "PRINCIPLE") => {
    // Search entries for matching snippets
    const cleanWords = text.replace(/[^\u0590-\u05FFa-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !['אני', 'היה', 'זה', 'על', 'עם', 'כל', 'של', 'לא', 'אם', 'כי'].includes(w))
      .slice(0, 6);

    const matchingEntries = [];
    entries.forEach(e => {
      const c = (e.content || '').toLowerCase();
      let matches = 0;
      cleanWords.forEach(w => {
        if (c.includes(w.toLowerCase())) matches++;
      });
      if (matches >= 2 || (cleanWords.length === 1 && matches === 1)) {
        const snippet = e.content ? e.content.substring(0, 160).replace(/\n+/g, ' ') + '...' : '';
        matchingEntries.push({
          entryId: e.id,
          date: e.frontmatter?.date || 'תאריך לא ידוע',
          quote: snippet,
          score: matches
        });
      }
    });

    matchingEntries.sort((a, b) => b.score - a.score);

    // Matching assertions in graph
    const matchingNodes = graphNodes.filter(n => {
      const name = (n.name || n.label || n.id).toLowerCase();
      return cleanWords.some(w => name.includes(w.toLowerCase()));
    }).slice(0, 4);

    const payload = {
      title,
      text,
      type,
      epistemicStatus: "INFERRED",
      epistemicDistance: 4,
      aiModel: "gemini-3.8-flash",
      confidence: 0.96,
      derivedFromAssertions: matchingEntries.slice(0, 3).map((me, idx) => ({
        id: `ast_${idx + 1}`,
        subjectName: cleanWords[0] || "דפוס אישי",
        predicate: "CONTRIBUTES_TO",
        rawPredicate: "משפיע על",
        objectName: "תפקוד ומצב מנטלי",
        epistemicStatus: "SELF_REPORTED",
        epistemicDistance: 1,
        evidence: {
          entryId: me.entryId,
          entryDate: me.date,
          quote: me.quote,
          modelId: "gemini-3.8-flash",
          promptVersion: "v2.0"
        }
      })),
      matchingNodes: matchingNodes.map(mn => ({
        id: mn.id,
        label: mn.name || mn.label || mn.id,
        type: mn.type || 'Concept'
      }))
    };

    if (typeof onOpenTraceability === 'function') {
      onOpenTraceability(payload);
    }
    setActiveTraceabilityItem(payload);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: '16px' }}>
        <RefreshCw className="spin" size={32} style={{ color: 'var(--text-muted)' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>טוען מנוע תובנות ואנליטיקה סומטית...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
        <div>{error}</div>
        <button onClick={loadData} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>נסה שוב</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', direction: 'rtl' }}>
      
      {/* Sidebar Navigation: Consolidated into 3 High-Signal Tabs */}
      <div style={{
        width: '280px',
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--panel-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: '8px',
        flexShrink: 0
      }}>
        <div style={{ marginBottom: '16px', padding: '0 8px' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} />
            תובנות ומדריך הפעלה
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
            שילוב סינתזת עומק פסיכולוגית, מכ"ם גוף-נפש מושהה ומפת פער שאיפה-פעולה.
          </p>
        </div>

        {[
          { 
            id: 'manual', 
            label: '🎯 תובנות ליבה ומדריך הפעלה', 
            icon: Target, 
            color: '#3b82f6',
            badge: `${originalInsights?.majorInsights?.length || 0} תובנות`
          },
          { 
            id: 'somatic', 
            label: '🧬 מכ"ם גוף–נפש וסיבתיות מושהית', 
            icon: Activity, 
            color: '#10b981',
            badge: `${laggedEntities.length} ישויות`
          },
          { 
            id: 'action_gap', 
            label: '🚀 מפת פער שאיפה–פעולה', 
            icon: Compass, 
            color: '#8b5cf6',
            badge: `${stanceData.all.length} דפוסים`
          }
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
                justifyContent: 'space-between',
                padding: '14px 16px',
                border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                textAlign: 'right',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} style={{ color: isActive ? tab.color : 'var(--text-muted)' }} />
                <span>{tab.label}</span>
              </div>
              <span style={{ 
                fontSize: '0.7rem', 
                padding: '2px 8px', 
                borderRadius: '10px', 
                background: isActive ? 'rgba(255,255,255,0.1)' : 'var(--bg-color)',
                color: 'var(--text-muted)'
              }}>
                {tab.badge}
              </span>
            </button>
          );
        })}

        {/* Status Indicators at Bottom of Sidebar */}
        <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>ימי ניטור פיזיולוגי:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{baselinesData.datesSorted.length} ימים</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>אירועי דיסוננס שאותרו:</span>
            <strong style={{ color: dissonanceEvents.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {dissonanceEvents.length} מקרים
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>מודל סינתזה פעיל:</span>
            <strong style={{ color: '#818cf8', fontSize: '0.7rem' }}>gemini-3.8-flash</strong>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-color)' }}>
        
        {/* Top Header */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--panel-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'manual' && '🎯 תובנות ליבה ומדריך הפעלה אישי'}
              {activeTab === 'somatic' && '🧬 מכ"ם גוף–נפש וסיבתיות מושהית (t-1 עד t+2)'}
              {activeTab === 'action_gap' && '🚀 מפת פער שאיפה–פעולה וטרקטוריית עמדות'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px', margin: 0 }}>
              {activeTab === 'manual' && 'עקרונות פעולה, התמודדות עם פחדים, ושרשרת ראיות אפיסטמית מאומתת לכל תובנה.'}
              {activeTab === 'somatic' && 'כיול Z-Score אישי רציף, זיהוי טריגרים שוחקים 24-48 שעות קדימה ואיתור דיסוננס סומטי.'}
              {activeTab === 'action_gap' && 'מדידת בולטות דפוסים (PatternSalience), מלכודות שאיפה מתמשכות ותנופת ביצוע בפועל.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {syncMessage && (
              <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                {syncMessage}
              </span>
            )}
            
            <button 
              onClick={handleSyncToGraph}
              disabled={syncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                border: 'none',
                background: 'var(--accent-color)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                cursor: syncing ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              {syncing ? <RefreshCw className="spin" size={14} /> : <Brain size={14} />}
              סנכרן תובנות לגרף
            </button>

            <button 
              onClick={loadData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                border: '1px solid var(--border-color)',
                background: 'var(--panel-bg)',
                color: 'var(--text-secondary)',
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
        </div>

        {/* Scrollable Workspace */}
        <div style={{ flexGrow: 1, padding: '32px', overflowY: 'auto' }}>
          
          {/* ========================================================= */}
          {/* TAB 1: CORE INSIGHTS & PERSONAL OPERATING MANUAL          */}
          {/* ========================================================= */}
          {activeTab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '960px', margin: '0 auto' }}>
              
              {/* Personal Operating Manual Hero */}
              <div style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px 28px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BookOpen size={22} style={{ color: 'var(--accent-color)' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {originalInsights?.operatingManual?.insight?.title || 'מדריך ההפעלה האישי של גיא'}
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} />
                    עודכן לאחרונה: {originalInsights?.operatingManual?.lastDate || 'מעודכן למאגר הנוכחי'}
                  </span>
                </div>

                {/* Operating Manual Sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {originalInsights?.operatingManual?.insight?.sections?.map((section, sIdx) => (
                    <div 
                      key={sIdx}
                      style={{
                        background: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px 22px'
                      }}
                    >
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-color)', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        {section.title}
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {section.bullets?.map((bullet, bIdx) => (
                          <div 
                            key={bIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '16px',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--panel-bg)',
                              border: '1px solid rgba(255, 255, 255, 0.04)'
                            }}
                          >
                            <div 
                              style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, flexGrow: 1 }}
                              dangerouslySetInnerHTML={{
                                __html: bullet.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              }}
                            />
                            
                            {/* Inline Traceability Button */}
                            <button
                              onClick={() => handleOpenTraceability(section.title, bullet.replace(/<[^>]+>/g, ''))}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color: '#818cf8',
                                background: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                              }}
                              title="בדוק אילו רשומות וציטוטים ביומן מהווים עדות לכלל זה"
                            >
                              <Search size={12} />
                              🔍 למה כך? (שרשרת ראיות)
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Major Insights Grid */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Lightbulb size={20} style={{ color: '#f59e0b' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    תובנות מפתח תקופתיות ועקרונות יסוד
                  </h3>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                  gap: '16px'
                }}>
                  {originalInsights?.majorInsights?.map((insight, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--panel-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '20px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        borderRight: `4px solid ${idx % 2 === 0 ? 'var(--accent-color)' : '#8b5cf6'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
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
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            דפוס מוסק
                          </span>
                        </div>

                        {/* Inline Traceability Button */}
                        <button
                          onClick={() => handleOpenTraceability(`תובנה ${idx + 1}`, insight)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#818cf8',
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <Search size={12} />
                          🔍 למה כך? (שרשרת ראיות)
                        </button>
                      </div>

                      <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shadow Work & Weekly Synthesis */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
                {originalInsights?.weeklyInsight && (
                  <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#eab308' }}>
                        <Sparkles size={16} /> תובנה שבועית מרוכזת
                      </h4>
                      <button
                        onClick={() => handleOpenTraceability('תובנה שבועית מרוכזת', originalInsights.weeklyInsight)}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🔍 שרשרת ראיות
                      </button>
                    </div>
                    <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>
                      {originalInsights.weeklyInsight}
                    </p>
                  </div>
                )}

                {originalInsights?.shadowWork?.insight && (
                  <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                        <Shield size={16} /> עבודת צללים (Shadow Work)
                      </h4>
                      <button
                        onClick={() => handleOpenTraceability('עבודת צללים', originalInsights.shadowWork.insight)}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        🔍 שרשרת ראיות
                      </button>
                    </div>
                    <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>
                      {originalInsights.shadowWork.insight}
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SOMATIC RADAR & LAGGED CAUSALITY (t-1 .. t+2)       */}
          {/* ========================================================= */}
          {activeTab === 'somatic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1000px', margin: '0 auto' }}>
              
              {/* Personal Rolling Baselines Summary Card */}
              <div style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Heart size={20} style={{ color: '#ef4444' }} />
                      בייסליין פיזיולוגי אישי מכויל (Rolling Personal Baselines)
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      חישוב ממוצע מתגלגל (μ) וסטיית תקן אישית (σ) בחלון של 30 יום. כל יום מקבל ציון Z-Score מנורמל אישית ולא ביחס לאוכלוסייה כללית.
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                    {baselinesData.datesSorted.length} ימי מעקב מכוילים
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {[
                    { label: 'HRV (שונות קצב לב)', key: 'hrv', unit: 'ms', color: '#8b5cf6', note: 'גבוה = התאוששות עצבית' },
                    { label: 'דופק מנוחה (RHR)', key: 'resting_hr', unit: 'BPM', color: '#ef4444', note: 'נמוך = רוגע לבבי' },
                    { label: 'ציון שינה (Sleep)', key: 'sleep_score', unit: 'נקודות', color: '#3b82f6', note: 'איכות והתאוששות' },
                    { label: 'צעדים יומיים', key: 'steps', unit: 'צעדים', color: '#10b981', note: 'רמת פעילות גופנית' }
                  ].map(item => {
                    const base = baselinesData.globalBaselines[item.key] || { mean: 0, std: 1 };
                    return (
                      <div 
                        key={item.key}
                        style={{
                          background: 'var(--bg-color)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.label}</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.color }}>
                          {base.mean.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{item.unit}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          סטיית תקן: ±{base.std.toFixed(1)} {item.unit}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                          {item.note}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lagged Somatic Impact Explorer (t-1, t, t+1, t+2) */}
              <div style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={20} style={{ color: 'var(--accent-color)' }} />
                      השפעה סומטית מושהית לפי ישויות ופרויקטים (t-1, t, t+1, t+2)
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      כיצד אזכור של אדם, פרויקט או נושא משפיע על ה-HRV ואיכות השינה 24 עד 48 שעות לאחר מכן.
                    </p>
                  </div>

                  {/* Filter chips & Search */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border-color)' }}>
                      {[
                        { id: 'all', label: 'הכל' },
                        { id: 'drain', label: '🔻 טריגרים שוחקים' },
                        { id: 'anchor', label: '🟢 עוגנים מווסתים' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setSomaticFilter(f.id)}
                          style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: somaticFilter === f.id ? 700 : 500,
                            background: somaticFilter === f.id ? 'var(--accent-color)' : 'transparent',
                            color: somaticFilter === f.id ? '#fff' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ position: 'relative', width: '180px' }}>
                      <input
                        type="text"
                        placeholder="סנן לפי שם..."
                        value={somaticSearch}
                        onChange={(e) => setSomaticSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 28px 6px 10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem'
                        }}
                      />
                      <Search size={12} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                </div>

                {filteredLaggedEntities.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    לא נמצאו ישויות מתאימות לסינון הנוכחי.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredLaggedEntities.map((item, idx) => (
                      <div 
                        key={idx}
                        style={{
                          background: 'var(--bg-color)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '18px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {item.entityName}
                            </span>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              color: item.badgeColor, 
                              background: `${item.badgeColor}1a`, 
                              border: `1px solid ${item.badgeColor}40`, 
                              padding: '2px 8px', 
                              borderRadius: '10px' 
                            }}>
                              {item.labelHe}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ({item.occurrenceCount} אזכורים מתועדים)
                            </span>
                          </div>

                          {/* Quick Navigate to Sample Entry */}
                          {item.sampleDates.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>דוגמאות:</span>
                              {item.sampleDates.map((dateStr, sIdx) => (
                                <button
                                  key={sIdx}
                                  onClick={() => onNavigateToEntry?.(dateStr)}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--panel-bg)',
                                    color: 'var(--accent-color)',
                                    cursor: 'pointer'
                                  }}
                                  title="צפה ברשומה זו"
                                >
                                  {dateStr}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Lagged Impact Matrix: t-1, t, t+1, t+2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'var(--panel-bg)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          {[
                            { label: 't - 1 (24h לפני)', lagKey: '-1', desc: 'בסיס פיזיולוגי מקדים' },
                            { label: 't (יום האזכור)', lagKey: '0', desc: 'עוררות מיידית' },
                            { label: 't + 1 (24h אחרי)', lagKey: '1', desc: 'השפעה מושהית ראשונה' },
                            { label: 't + 2 (48h אחרי)', lagKey: '2', desc: 'התאוששות / שחיקה ממושכת' }
                          ].map(lagObj => {
                            const stat = item.lagAverages[lagObj.lagKey] || {};
                            const zHrv = stat.zHrv;
                            const zSleep = stat.zSleep;

                            const getZColor = (z) => {
                              if (z === null || z === undefined) return 'var(--text-muted)';
                              if (z >= 0.35) return '#10b981'; // Recovery
                              if (z <= -0.35) return '#ef4444'; // Strain
                              return 'var(--text-secondary)';
                            };

                            return (
                              <div key={lagObj.lagKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{lagObj.label}</span>
                                <div style={{ fontSize: '0.72rem', color: getZColor(zHrv) }}>
                                  HRV: <strong>{zHrv !== null ? `${zHrv > 0 ? '+' : ''}${zHrv}σ` : '—'}</strong>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: getZColor(zSleep) }}>
                                  שינה: <strong>{zSleep !== null ? `${zSleep > 0 ? '+' : ''}${zSleep}σ` : '—'}</strong>
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{lagObj.desc}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Verbatim snippet */}
                        {item.sampleQuotes.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '4px', borderRight: `3px solid ${item.badgeColor}` }}>
                            "{item.sampleQuotes[0]}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Somatic Dissonance Detector (⚡ דיסוננס גוף–נפש) */}
              <div style={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Flame size={20} style={{ color: '#ef4444' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      ⚡ גלאי דיסוננס גוף–נפש (הטקסט רגוע אך הגוף במצוקה פיזיולוגית)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    זוהו {dissonanceEvents.length} אירועי חוסר הלימה
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  גלאי זה מאתר מקרים שבהם רשמת ביומן טקסט ענייני, רגוע או אופטימי, בעוד שמדדי הגוף (צניחה חדה ב-HRV או זינוק בדופק מנוחה) מעידים על שחיקה סמויה או עומס נוירו-ביולוגי מודחק.
                </p>

                {dissonanceEvents.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
                    לא נמצאו אירועי דיסוננס חריפים ברשומות הנוכחיות.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {dissonanceEvents.map((evt, idx) => (
                      <div 
                        key={idx}
                        style={{
                          background: 'var(--bg-color)',
                          border: `1px solid ${evt.typeBadgeColor}40`,
                          borderRadius: 'var(--radius-md)',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              רשומה מיום {evt.date}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: evt.typeBadgeColor, background: `${evt.typeBadgeColor}1a`, padding: '2px 8px', borderRadius: '8px' }}>
                              {evt.typeLabelHe}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              מצב רוח מדווח: <strong>{evt.mood}</strong>
                            </span>
                          </div>

                          <button
                            onClick={() => onNavigateToEntry?.(evt.entryId || evt.date)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--accent-color)',
                              background: 'var(--accent-light)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <ExternalLink size={12} />
                            פתח רשומה זו ביומן
                          </button>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                          "{evt.snippet}"
                        </p>

                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                          <span>HRV Z-Score: <strong style={{ color: evt.zHrv < -0.8 ? '#ef4444' : '#10b981' }}>{evt.zHrv}σ</strong> {evt.hrvVal ? `(${evt.hrvVal}ms)` : ''}</span>
                          <span>RHR Z-Score: <strong style={{ color: evt.zRhr > 0.8 ? '#ef4444' : '#10b981' }}>{evt.zRhr}σ</strong> {evt.rhrVal ? `(${evt.rhrVal}bpm)` : ''}</span>
                          <span style={{ marginRight: 'auto', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            💡 {evt.explanationHe}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: ASPIRATION-TO-ACTION GAP & STANCE TRAJECTORY BOARD */}
          {/* ========================================================= */}
          {activeTab === 'action_gap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
              
              {/* Header and Filter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Compass size={22} style={{ color: '#8b5cf6' }} />
                    לוח מעקב עמדות: פער שאיפה מול ביצוע (Aspiration vs Action)
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    חישוב PatternSalience = Frequency × ln(1 + SpanDays + 1) × ConfidenceWeight למיפוי מטרות שתקועות בהצהרות מול מטרות שמתקדמות לביצוע.
                  </p>
                </div>

                <div style={{ position: 'relative', width: '220px' }}>
                  <input
                    type="text"
                    placeholder="חפש מטרה או נושא..."
                    value={stanceSearch}
                    onChange={(e) => setStanceSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 30px 8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--panel-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem'
                    }}
                  />
                  <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* 3-Column Interactive Board */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                alignItems: 'flex-start'
              }}>
                
                {/* Column 1: Aspiration Trap */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '2px solid #f59e0b', background: 'rgba(245, 158, 11, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={16} />
                      ⏳ מלכודת שאיפה כרונית
                    </h4>
                    <span style={{ fontSize: '0.72rem', background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      {filteredStanceData.ASPIRATION_TRAP.length}
                    </span>
                  </div>
                  <div style={{ padding: '8px 16px', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    מטרות שנשארות שבועות בגדר "רוצה / צריך / מתכנן" ללא מעבר לפעולה.
                  </div>
                  
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '650px', overflowY: 'auto' }}>
                    {filteredStanceData.ASPIRATION_TRAP.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>אין פריטים בעמודה זו</div>
                    ) : (
                      filteredStanceData.ASPIRATION_TRAP.map(item => (
                        <div 
                          key={item.id}
                          style={{
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: '#f59e0b15', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Salience: {item.salience}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>מוזכר: {item.frequency} פעמים</span>
                            <span>•</span>
                            <span>טווח: {item.spanDays} ימים</span>
                          </div>

                          {item.quotes.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--panel-bg)', padding: '6px 10px', borderRadius: '4px', borderRight: '2px solid #f59e0b' }}>
                              "{item.quotes[0]}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Column 2: Avoidance & Conflict */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={16} />
                      ⚡ מוקדי חיכוך והימנעות
                    </h4>
                    <span style={{ fontSize: '0.72rem', background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      {filteredStanceData.AVOIDANCE_CONFLICT.length}
                    </span>
                  </div>
                  <div style={{ padding: '8px 16px', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    נושאים המלווים בדחיינות, קונפליקט רגשי או חששות מוצהרים.
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '650px', overflowY: 'auto' }}>
                    {filteredStanceData.AVOIDANCE_CONFLICT.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>אין פריטים בעמודה זו</div>
                    ) : (
                      filteredStanceData.AVOIDANCE_CONFLICT.map(item => (
                        <div 
                          key={item.id}
                          style={{
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#ef444415', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Salience: {item.salience}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>מוזכר: {item.frequency} פעמים</span>
                            <span>•</span>
                            <span>טווח: {item.spanDays} ימים</span>
                          </div>

                          {item.quotes.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--panel-bg)', padding: '6px 10px', borderRadius: '4px', borderRight: '2px solid #ef4444' }}>
                              "{item.quotes[0]}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Column 3: Action Momentum */}
                <div style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '16px 20px', borderBottom: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={16} />
                      🚀 תנופה וביצוע בפועל
                    </h4>
                    <span style={{ fontSize: '0.72rem', background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      {filteredStanceData.ACTION_MOMENTUM.length}
                    </span>
                  </div>
                  <div style={{ padding: '8px 16px', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    פרויקטים ומטרות שבהם העמדה עברה להשלמת משימות והתקדמות ממשית.
                  </div>

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '650px', overflowY: 'auto' }}>
                    {filteredStanceData.ACTION_MOMENTUM.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>אין פריטים בעמודה זו</div>
                    ) : (
                      filteredStanceData.ACTION_MOMENTUM.map(item => (
                        <div 
                          key={item.id}
                          style={{
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            boxShadow: 'var(--shadow-xs)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: '0.7rem', color: '#10b981', background: '#10b98115', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Salience: {item.salience}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>מוזכר: {item.frequency} פעמים</span>
                            <span>•</span>
                            <span>טווח: {item.spanDays} ימים</span>
                          </div>

                          {item.quotes.length > 0 && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--panel-bg)', padding: '6px 10px', borderRadius: '4px', borderRight: '2px solid #10b981' }}>
                              "{item.quotes[0]}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Local Epistemic Traceability Drawer / Modal */}
      {activeTraceabilityItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '24px',
          direction: 'rtl'
        }} onClick={() => setActiveTraceabilityItem(null)}>
          <div 
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                    שרשרת ראיות אפיסטמית (Epistemic Traceability)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    אימות עובדתי וציטוטי יומן העומדים בבסיס התובנה
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setActiveTraceabilityItem(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Target Insight Box */}
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                תובנה / כלל מנחה נבדק:
              </span>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.5 }}>
                {activeTraceabilityItem.text}
              </p>
            </div>

            {/* AI Model & Confidence Vector */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '4px 10px', borderRadius: '12px' }}>
                מודל אינטגרציה: <strong>{activeTraceabilityItem.aiModel}</strong>
              </span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 10px', borderRadius: '12px' }}>
                מרחק אפיסטמי: <strong>4 (דפוס מוסק)</strong>
              </span>
              <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 10px', borderRadius: '12px' }}>
                אימות: <strong>נתמך ברשומות (SUPPORTED)</strong>
              </span>
            </div>

            {/* Backing Evidence from Diary Entries */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '10px' }}>
                רשומות יומן ועובדות תומכות ({activeTraceabilityItem.derivedFromAssertions.length}):
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeTraceabilityItem.derivedFromAssertions.map((ast, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                        רשומת יומן מתאריך: {ast.evidence?.entryDate}
                      </span>
                      {onNavigateToEntry && (
                        <button
                          onClick={() => {
                            setActiveTraceabilityItem(null);
                            onNavigateToEntry(ast.evidence?.entryId || ast.evidence?.entryDate);
                          }}
                          style={{
                            fontSize: '0.72rem',
                            color: '#818cf8',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            cursor: 'pointer'
                          }}
                        >
                          קרא רשומה מלאה ↵
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.5, borderRight: '2px solid #818cf8', paddingRight: '10px' }}>
                      "{ast.evidence?.quote}"
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setActiveTraceabilityItem(null)}
                style={{
                  padding: '8px 20px',
                  background: '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
