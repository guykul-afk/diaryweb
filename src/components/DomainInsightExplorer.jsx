import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Target, 
  Zap, 
  Brain, 
  Heart, 
  Users, 
  Globe, 
  Calendar, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Filter, 
  Sparkles, 
  Layers, 
  Share2,
  ChevronRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const CATEGORY_META = {
  Domain: {
    label: 'תחומי חיים',
    english: 'Domains',
    icon: Globe,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    description: 'זירות הפעולה הרחבות (עבודה, בריאות, משפחה, התפתחות אישית).'
  },
  Goal: {
    label: 'מטרות ויעדים',
    english: 'Goals',
    icon: Target,
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    description: 'היעדים, השאיפות והתוצאות שאתה חותר אליהם במודע.'
  },
  Pattern: {
    label: 'דפוסים והרגלים',
    english: 'Patterns',
    icon: Zap,
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    description: 'דפוסי חשיבה והתנהגות שחוזרים על עצמם (פרפקציוניזם, דחיינות וכו\').'
  },
  Emotion: {
    label: 'רגשות ומצבי רוח',
    english: 'Emotions',
    icon: Heart,
    color: '#ec4899',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    badgeBg: '#fce7f3',
    badgeText: '#be185d',
    description: 'תחושות פנימיות, עומסים רגשיים ורווחה נפשית שתועדו ביומן.'
  },
  Strategy: {
    label: 'אסטרטגיות וכלים',
    english: 'Strategies',
    icon: Brain,
    color: '#06b6d4',
    bg: '#ecfeff',
    border: '#a5f3fc',
    badgeBg: '#cffafe',
    badgeText: '#0e7490',
    description: 'טקטיקות, שיטות מעשיות והרגלים שאימצת להתמודדות ולהתקדמות.'
  },
  Person: {
    label: 'אנשים ועוגנים',
    english: 'People',
    icon: Users,
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    description: 'דמויות מפתח, בני משפחה ומערכות יחסים משמעותיות בחייך.'
  },
  Insight: {
    label: 'תובנות והארות',
    english: 'Insights',
    icon: Sparkles,
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
    badgeBg: '#e0e7ff',
    badgeText: '#4338ca',
    description: 'הבנות פסיכולוגיות עמוקות ושיעורים שהתגבשו מתוך ההתבוננות.'
  },
  Event: {
    label: 'אירועים מכוננים',
    english: 'Events',
    icon: Calendar,
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fed7aa',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    description: 'נקודות ציון בזמן, שיחות מכריעות, משברים או רגעי פריצה.'
  }
};

const RELATION_HEBREW = {
  'משפיע_על': { label: 'משפיע על', color: '#6366f1' },
  'מחזק': { label: 'מחזק את', color: '#10b981' },
  'מחליש': { label: 'מחליש את', color: '#ef4444' },
  'שואף_ל': { label: 'שואף ל', color: '#059669' },
  'חלק_מ': { label: 'חלק מ', color: '#8b5cf6' },
  'סותר': { label: 'עומד בסתירה ל', color: '#dc2626' },
  'חווה': { label: 'חווה את', color: '#ec4899' },
  'מפעיל': { label: 'מפעיל / מניע את', color: '#f59e0b' },
  'שייך_ל': { label: 'שייך ל', color: '#64748b' },
  'דומה_ל': { label: 'דומה ל', color: '#0284c7' },
  'מתועד_ב': { label: 'מתועד ב', color: '#64748b' },
  'קשור_ל': { label: 'קשור ל', color: '#94a3b8' }
};

export default function DomainInsightExplorer({ diaryData, onSelectConcept }) {
  const { filteredNodes = [], filteredLinks = [] } = diaryData || {};

  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState(null);

  // Map nodes and calculate connectivity
  const { nodesById, categoryBuckets, nodeDegrees } = useMemo(() => {
    const byId = {};
    const buckets = {
      Domain: [],
      Goal: [],
      Pattern: [],
      Emotion: [],
      Strategy: [],
      Person: [],
      Insight: [],
      Event: []
    };
    const degrees = {};

    filteredNodes.forEach(node => {
      byId[node.id] = node;
      const type = node.type && buckets[node.type] ? node.type : 'Insight';
      buckets[type].push(node);
      degrees[node.id] = 0;
    });

    filteredLinks.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (degrees[s] !== undefined) degrees[s]++;
      if (degrees[t] !== undefined) degrees[t]++;
    });

    // Sort nodes in each bucket by degree
    Object.keys(buckets).forEach(cat => {
      buckets[cat].sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0));
    });

    return { nodesById: byId, categoryBuckets: buckets, nodeDegrees: degrees };
  }, [filteredNodes, filteredLinks]);

  // Causal network for selected concept
  const conceptNetwork = useMemo(() => {
    if (!selectedConcept) return null;
    const cid = selectedConcept.id;

    const incoming = [];
    const outgoing = [];

    filteredLinks.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      const rel = link.relation || link.label || 'קשור_ל';

      if (t === cid && nodesById[s]) {
        incoming.push({ node: nodesById[s], relation: rel });
      } else if (s === cid && nodesById[t]) {
        outgoing.push({ node: nodesById[t], relation: rel });
      }
    });

    return { node: selectedConcept, incoming, outgoing };
  }, [selectedConcept, filteredLinks, nodesById]);

  // Global search candidates
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return filteredNodes
      .filter(n => (n.label || n.name || n.id).toLowerCase().includes(q))
      .slice(0, 10);
  }, [filteredNodes, searchQuery]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      direction: 'rtl',
      overflowY: 'auto'
    }}>
      {/* Top Header & Search Bar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 28px',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#e0e7ff',
                color: '#4338ca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Compass size={20} />
              </div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                מרכז תחומי החיים והאונטולוגיה (Macro Hub)
              </h1>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              מבט-על נקי על 8 תחומי הידע של היומן, עם קשרים סיבתיים מדויקים וללא כדורי שיער.
            </p>
          </div>

          {/* Quick Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="חפש מושג, רגש, דפוס..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 36px 8px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                background: '#f8fafc',
                boxSizing: 'border-box'
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                left: 0,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                marginTop: '6px',
                zIndex: 30,
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                {searchResults.map(res => {
                  const meta = CATEGORY_META[res.type] || CATEGORY_META.Insight;
                  return (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedConcept(res);
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{res.label || res.name || res.id}</span>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: meta.badgeBg,
                        color: meta.badgeText,
                        fontWeight: 600
                      }}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Selected Concept Causal Chain Card (Micro Flow) */}
        {conceptNetwork && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            padding: '22px 26px',
            marginBottom: '28px',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedConcept(null)}
              style={{
                position: 'absolute',
                top: '18px',
                left: '20px',
                border: 'none',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              סגור מיקוד ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sparkles size={18} style={{ color: '#6366f1' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                שרשרת סיבתית ותובנה ממוקדת:
              </h2>
              <span style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#1e293b',
                background: '#f1f5f9',
                padding: '3px 12px',
                borderRadius: '8px'
              }}>
                {conceptNetwork.node.label || conceptNetwork.node.id}
              </span>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: (CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).badgeBg,
                color: (CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).badgeText,
                fontWeight: 600
              }}>
                {(CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).label}
              </span>
            </div>

            {/* 3-Column Causal Flow */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1.2fr auto 1fr',
              gap: '14px',
              alignItems: 'center',
              marginTop: '16px'
            }}>
              {/* Incoming: Factors & Causes */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '120px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  ⬅️ מושגים שמשפיעים או מפעילים אותו ({conceptNetwork.incoming.length})
                </div>
                {conceptNetwork.incoming.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>אין גורמים מתועדים</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {conceptNetwork.incoming.slice(0, 6).map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedConcept(item.node)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{item.node.label || item.node.id}</span>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: (RELATION_HEBREW[item.relation] || {}).color || '#64748b'
                        }}>
                          {(RELATION_HEBREW[item.relation] || {}).label || item.relation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{ color: '#cbd5e1' }}><ArrowLeft size={20} /></div>

              {/* Center Core Concept */}
              <div style={{
                background: (CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).bg,
                border: `2px solid ${(CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).color}`,
                borderRadius: '14px',
                padding: '18px 20px',
                textAlign: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: (CATEGORY_META[conceptNetwork.node.type] || CATEGORY_META.Insight).badgeText }}>
                  המוקד המרכזי
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '6px 0' }}>
                  {conceptNetwork.node.label || conceptNetwork.node.id}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {nodeDegrees[conceptNetwork.node.id] || 0} קשרים ישירים בגרף
                </div>
                {conceptNetwork.node.description && (
                  <p style={{ fontSize: '0.8rem', color: '#334155', marginTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                    {conceptNetwork.node.description}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div style={{ color: '#cbd5e1' }}><ArrowLeft size={20} /></div>

              {/* Outgoing: Results & Goals */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '120px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  מושגים שהוא מניע, מחזק או שואף אליהם ⬅️ ({conceptNetwork.outgoing.length})
                </div>
                {conceptNetwork.outgoing.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>אין תוצאות מתועדות</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {conceptNetwork.outgoing.slice(0, 6).map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedConcept(item.node)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{item.node.label || item.node.id}</span>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: (RELATION_HEBREW[item.relation] || {}).color || '#64748b'
                        }}>
                          {(RELATION_HEBREW[item.relation] || {}).label || item.relation}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 8 Macro Domain Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {Object.entries(CATEGORY_META).map(([typeKey, meta]) => {
            const Icon = meta.icon;
            const nodes = categoryBuckets[typeKey] || [];
            const isExpanded = activeCategory === typeKey;

            return (
              <div
                key={typeKey}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: `1px solid ${isExpanded ? meta.color : '#e2e8f0'}`,
                  boxShadow: isExpanded ? `0 8px 24px ${meta.color}25` : '0 2px 10px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Header Banner */}
                <div style={{
                  padding: '16px 20px',
                  background: meta.bg,
                  borderBottom: `1px solid ${meta.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: '#ffffff',
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                        {meta.label}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {meta.english}
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: '#ffffff',
                    color: meta.color,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                  }}>
                    {nodes.length} מושגים
                  </span>
                </div>

                {/* Description */}
                <div style={{ padding: '12px 20px 8px 20px', fontSize: '0.8rem', color: '#64748b' }}>
                  {meta.description}
                </div>

                {/* Top Concepts List */}
                <div style={{ padding: '10px 20px 16px 20px', flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                    מושגים מרכזיים בתחום זה:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {nodes.slice(0, isExpanded ? 24 : 7).map(node => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedConcept(node)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = meta.badgeBg;
                          e.currentTarget.style.borderColor = meta.color;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{node.label || node.id}</span>
                        {nodeDegrees[node.id] > 1 && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            ({nodeDegrees[node.id]})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {nodes.length > 7 && (
                    <button
                      onClick={() => setActiveCategory(isExpanded ? null : typeKey)}
                      style={{
                        marginTop: '12px',
                        fontSize: '0.78rem',
                        color: meta.color,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0
                      }}
                    >
                      {isExpanded ? 'הצג פחות ▲' : `הצג את כל ${nodes.length} המושגים ▼`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
