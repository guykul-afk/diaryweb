import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { fetchTheoreticalConcepts } from './firebase';
import { 
  Network, 
  BarChart3, 
  Search, 
  Filter, 
  BookOpen, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Sparkles,
  TrendingUp,
  Brain,
  Hash
} from 'lucide-react';

function getHebrewDayOfWeek(dateStr) {
  if (!dateStr || dateStr === 'תאריך לא ידוע') return '';
  const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
  const d = new Date(dateStr);
  return isNaN(d.getDay()) ? '' : days[d.getDay()];
}

export default function KnowledgeBaseGraphView({ onNavigateToEntry, initialTab = 'graph' }) {
  const { entries, conceptMetadataMap } = useDiaryData();
  const [kbData, setKbData] = useState({ nodes: [], links: [] });
  const [activeTab, setActiveTab] = useState(initialTab); // 'graph' | 'frequency'
  const iframeRef = useRef(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filters & State for Frequency View
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [sortBy, setSortBy] = useState('frequency'); // 'frequency' | 'name' | 'thinker'
  const [expandedConceptId, setExpandedConceptId] = useState(null);

  useEffect(() => {
    // Fetch theoretical concepts from Firestore
    fetchTheoreticalConcepts()
      .then(data => {
        setKbData(data);
      })
      .catch(err => {
        console.error("Failed to fetch theoretical concepts:", err);
      });
  }, []);

  // Sync iframe message handlers
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      
      if (event.data.type === 'OPEN_LOCAL_FILE') {
        const absolutePath = `/Users/guy/webdiary/${event.data.path}`;
        window.open(`file://${absolutePath}`, '_blank');
      }
      
      if (event.data.type === 'GET_LINKED_ENTRIES') {
        const label = event.data.label || '';
        const meta = conceptMetadataMap[label.toLowerCase()];
        
        if (event.source) {
          event.source.postMessage({
            type: 'LINKED_ENTRIES_RESPONSE',
            label: label,
            entries: meta ? meta.entries : []
          }, '*');
        }
      }
      
      if (event.data.type === 'OPEN_ENTRY') {
        if (onNavigateToEntry && event.data.entryId) {
          onNavigateToEntry(event.data.entryId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [conceptMetadataMap, onNavigateToEntry]);

  // Update iframe with graph data when loading
  useEffect(() => {
    if (!iframeRef.current || !kbData.nodes.length || activeTab !== 'graph') return;
    
    const sendData = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_GRAPH_DATA',
          nodes: kbData.nodes,
          links: kbData.links
        }, '*');
      }
    };

    const iframe = iframeRef.current;
    const handleLoad = () => {
      setTimeout(sendData, 300);
    };

    iframe.addEventListener('load', handleLoad);
    sendData();

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [kbData, activeTab]);

  // Compute frequencies and matching entries per concept
  const conceptStats = useMemo(() => {
    if (!kbData.nodes || !kbData.nodes.length) return [];

    // Map entries by tkb_reference and text mentions
    return kbData.nodes.map(node => {
      const nodeIdLower = node.id.toLowerCase();
      const nodeTitleLower = (node.name || node.title || node.id).toLowerCase();
      const cleanId = node.id.replace(/\.md$/i, '').trim();
      const cleanTitle = (node.name || node.title || cleanId).replace(/\.md$/i, '').trim();

      // Collect all matching entries
      const matchedEntriesMap = new Map();

      entries.forEach(entry => {
        const ref = (entry.frontmatter?.tkb_reference || '').toLowerCase().trim();
        const text = (entry.content || '').toLowerCase();

        const isDirectRef = ref && (
          ref === nodeIdLower || 
          ref === cleanId.toLowerCase() ||
          ref === nodeTitleLower ||
          ref === cleanTitle.toLowerCase() ||
          nodeIdLower.includes(ref) ||
          ref.includes(nodeIdLower)
        );

        const isTextMention = text.includes(nodeTitleLower) || text.includes(cleanTitle.toLowerCase());

        if (isDirectRef || isTextMention) {
          matchedEntriesMap.set(entry.id, {
            id: entry.id,
            date: entry.frontmatter?.date || 'תאריך לא ידוע',
            mood: entry.frontmatter?.mood || 'ניטרלי',
            topics: entry.frontmatter?.topics || [],
            content: entry.content || '',
            isDirectRef
          });
        }
      });

      const matchedEntries = Array.from(matchedEntriesMap.values()).sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? 1 : -1;
      });

      return {
        ...node,
        cleanTitle,
        thinker: node.thinker || node.sourceFile || 'מושג תיאורטי',
        matchedEntries,
        matchCount: matchedEntries.length,
        directRefCount: matchedEntries.filter(e => e.isDirectRef).length
      };
    });
  }, [kbData.nodes, entries]);

  // Global KPIs
  const kpis = useMemo(() => {
    const totalConcepts = conceptStats.length;
    const activeConcepts = conceptStats.filter(c => c.matchCount > 0);
    const totalMentions = conceptStats.reduce((acc, c) => acc + c.matchCount, 0);
    const sortedByCount = [...conceptStats].sort((a, b) => b.matchCount - a.matchCount);
    const topConcept = sortedByCount[0] || null;
    const maxMatchCount = topConcept ? topConcept.matchCount : 1;

    return {
      totalConcepts,
      activeConceptsCount: activeConcepts.length,
      totalMentions,
      topConcept,
      maxMatchCount
    };
  }, [conceptStats]);

  // Filtered & Sorted concepts list for display
  const filteredConcepts = useMemo(() => {
    let list = [...conceptStats];

    if (showActiveOnly) {
      list = list.filter(c => c.matchCount > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.cleanTitle.toLowerCase().includes(q) || 
        c.id.toLowerCase().includes(q) || 
        (c.thinker && c.thinker.toLowerCase().includes(q)) ||
        (c.content && c.content.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'frequency') {
      list.sort((a, b) => b.matchCount - a.matchCount || a.cleanTitle.localeCompare(b.cleanTitle, 'he'));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle, 'he'));
    } else if (sortBy === 'thinker') {
      list.sort((a, b) => (a.thinker || '').localeCompare(b.thinker || '', 'he'));
    }

    return list;
  }, [conceptStats, showActiveOnly, searchQuery, sortBy]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#0f172a', 
      color: '#f8fafc',
      fontFamily: 'inherit',
      overflow: 'hidden'
    }}>
      {/* Top Header & Sub-Tabs Toolbar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        padding: '12px 24px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 126, 64, 0.15)',
            border: '1px solid rgba(255, 126, 64, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            color: 'var(--accent-color, #ff7e40)'
          }}>
            <Brain size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              בסיס ידע אקדמי ותיאורטי
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              מפת מושגים, הוגים ותדר הופעתם ברשומות היומן
            </span>
          </div>
        </div>

        {/* Sub-Tab Navigation Buttons */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('graph')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: activeTab === 'graph' ? 'var(--accent-color, #ff7e40)' : 'transparent',
              color: activeTab === 'graph' ? '#ffffff' : '#94a3b8',
              boxShadow: activeTab === 'graph' ? '0 2px 10px rgba(255, 126, 64, 0.3)' : 'none'
            }}
          >
            <Network size={16} />
            <span>מפת קשרים 3D</span>
          </button>

          <button
            onClick={() => setActiveTab('frequency')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: activeTab === 'frequency' ? 'var(--accent-color, #ff7e40)' : 'transparent',
              color: activeTab === 'frequency' ? '#ffffff' : '#94a3b8',
              boxShadow: activeTab === 'frequency' ? '0 2px 10px rgba(255, 126, 64, 0.3)' : 'none'
            }}
          >
            <BarChart3 size={16} />
            <span>שכיחות מושגים ברשומות</span>
            {kpis.activeConceptsCount > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor: activeTab === 'frequency' ? 'rgba(255,255,255,0.25)' : 'rgba(255, 126, 64, 0.2)',
                color: activeTab === 'frequency' ? '#fff' : 'var(--accent-color, #ff7e40)',
                fontWeight: 700
              }}>
                {kpis.activeConceptsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>

        {/* 1. TAB: 3D GRAPH IFRAME */}
        <div style={{
          width: '100%',
          height: '100%',
          display: activeTab === 'graph' ? 'block' : 'none'
        }}>
          <iframe 
            ref={iframeRef}
            src="/knowledge_graph.html?v=16" 
            title="Knowledge Graph"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>

        {/* 2. TAB: CONCEPT FREQUENCY DASHBOARD */}
        {activeTab === 'frequency' && (
          <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            padding: '24px 32px',
            boxSizing: 'border-box'
          }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* KPI Cards Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px'
              }}>
                {/* Total Concepts */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center'
                  }}>
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>סך הכל מושגים ב-TKB</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                      {kpis.totalConcepts}
                    </div>
                  </div>
                </div>

                {/* Active Concepts in Diary */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center'
                  }}>
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>מושגים המשוייכים ליומן</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {kpis.activeConceptsCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94a3b8' }}>({Math.round((kpis.activeConceptsCount / (kpis.totalConcepts || 1)) * 100)}%)</span>
                    </div>
                  </div>
                </div>

                {/* Total Mentions */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 126, 64, 0.15)',
                    color: '#ff7e40',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center'
                  }}>
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>סך הכל אזכורים ברשומות</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ff7e40', marginTop: '2px' }}>
                      {kpis.totalMentions}
                    </div>
                  </div>
                </div>

                {/* Top Concept */}
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center'
                  }}>
                    <Hash size={22} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>המושג השכיח ביותר</div>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 700, 
                      color: '#f8fafc', 
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }} title={kpis.topConcept?.cleanTitle}>
                      {kpis.topConcept ? kpis.topConcept.cleanTitle : 'אין'}
                    </div>
                    {kpis.topConcept && (
                      <div style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>
                        {kpis.topConcept.matchCount} רשומות
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls Bar: Search, Filters & Sorting */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                {/* Search Bar */}
                <div style={{
                  position: 'relative',
                  flex: '1 1 280px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Search size={16} style={{ position: 'absolute', right: '12px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="חפש לפי שם מושג, הוגה או מפתח..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 38px 8px 12px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Filter Checkbox */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-color, #ff7e40)' }}
                  />
                  <span>הצג מושגים המופיעים ביומן בלבד ({kpis.activeConceptsCount})</span>
                </label>

                {/* Sort Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>מיון:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="frequency">שכיחות (מהגבוה לנמוך)</option>
                    <option value="name">שם המושג (א-ב)</option>
                    <option value="thinker">הוגה / תחום</option>
                  </select>
                </div>
              </div>

              {/* Concepts List Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '0 8px',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  <span>מוצגים {filteredConcepts.length} מושגים</span>
                  <span>לחץ על מושג לצפייה ברשומות התואמות</span>
                </div>

                {filteredConcepts.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: '14px',
                    color: '#94a3b8'
                  }}>
                    לא נמצאו מושגים התואמים את החיפוש והסינון הנבחר.
                  </div>
                ) : (
                  filteredConcepts.map((concept, index) => {
                    const isExpanded = expandedConceptId === concept.id;
                    const pct = Math.min(100, Math.round((concept.matchCount / (kpis.maxMatchCount || 1)) * 100));

                    return (
                      <div 
                        key={concept.id}
                        style={{
                          backgroundColor: 'rgba(30, 41, 59, 0.6)',
                          border: isExpanded ? '1px solid var(--accent-color, #ff7e40)' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Concept Header Item */}
                        <div 
                          onClick={() => setExpandedConceptId(isExpanded ? null : concept.id)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'space-between',
                            cursor: 'pointer',
                            gap: '16px',
                            backgroundColor: isExpanded ? 'rgba(255, 126, 64, 0.05)' : 'transparent'
                          }}
                        >
                          {/* Left Details */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 300px' }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: '#64748b',
                              width: '28px',
                              textAlign: 'center'
                            }}>
                              #{index + 1}
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                                  {concept.cleanTitle}
                                </span>
                                {concept.thinker && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    color: '#94a3b8',
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '2px 8px',
                                    borderRadius: '10px'
                                  }}>
                                    {concept.thinker}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Center Frequency Bar */}
                          <div style={{ flex: '1 1 200px', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                              <span style={{ color: concept.matchCount > 0 ? '#10b981' : '#64748b', fontWeight: 600 }}>
                                {concept.matchCount} רשומות ({pct}%)
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '6px',
                              backgroundColor: 'rgba(255,255,255,0.08)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: concept.matchCount > 0 ? 'var(--accent-color, #ff7e40)' : '#475569',
                                borderRadius: '3px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>

                          {/* Right Expand Arrow */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button style={{
                              background: 'transparent',
                              border: 'none',
                              color: isExpanded ? 'var(--accent-color, #ff7e40)' : '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Section: Matching Entries */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px 20px 20px 20px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            backgroundColor: 'rgba(15, 23, 42, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}>
                            {/* Concept Content Info if available */}
                            {concept.content && (
                              <div style={{
                                fontSize: '0.85rem',
                                color: '#cbd5e1',
                                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                borderRight: '3px solid var(--accent-color, #ff7e40)',
                                marginBottom: '8px',
                                lineHeight: '1.5'
                              }}>
                                <strong>תמצית המושג:</strong> {concept.content}
                              </div>
                            )}

                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} style={{ color: 'var(--accent-color, #ff7e40)' }} />
                              <span>רשומות יומן מקושרות ({concept.matchedEntries.length}):</span>
                            </div>

                            {concept.matchedEntries.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
                                מושג זה קיים בבסיס הידע אך עדיין לא קושר לרשומות יומן פעילות.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {concept.matchedEntries.map(entry => (
                                  <div 
                                    key={entry.id}
                                    style={{
                                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                                      border: '1px solid rgba(255, 255, 255, 0.06)',
                                      borderRadius: '8px',
                                      padding: '12px 16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justify: 'space-between',
                                      gap: '16px',
                                      flexWrap: 'wrap'
                                    }}
                                  >
                                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                                          {entry.date} ({getHebrewDayOfWeek(entry.date)})
                                        </span>
                                        {entry.mood && (
                                          <span style={{
                                            fontSize: '0.72rem',
                                            color: '#94a3b8',
                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                            padding: '2px 8px',
                                            borderRadius: '10px'
                                          }}>
                                            רגש: {entry.mood}
                                          </span>
                                        )}
                                        {entry.isDirectRef && (
                                          <span style={{
                                            fontSize: '0.7rem',
                                            color: '#10b981',
                                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            padding: '1px 6px',
                                            borderRadius: '6px',
                                            fontWeight: 600
                                          }}>
                                            קישור ישיר ✓
                                          </span>
                                        )}
                                      </div>

                                      {/* Snippet */}
                                      <div style={{
                                        fontSize: '0.8rem',
                                        color: '#cbd5e1',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '650px'
                                      }}>
                                        {entry.content}
                                      </div>
                                    </div>

                                    {/* Action button to open entry in feed */}
                                    <button
                                      onClick={() => {
                                        if (onNavigateToEntry) {
                                          onNavigateToEntry(entry.id);
                                        }
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        backgroundColor: 'rgba(255, 126, 64, 0.12)',
                                        border: '1px solid rgba(255, 126, 64, 0.3)',
                                        color: 'var(--accent-color, #ff7e40)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit'
                                      }}
                                    >
                                      <span>עבור לרשומה בפיד</span>
                                      <ExternalLink size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
