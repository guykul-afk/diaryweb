import React, { useMemo, useState, useEffect } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { Filter, Search, HelpCircle, Info, ArrowRight, Brain, Calendar, FileText } from 'lucide-react';
import { queryDiaryInsights } from './firebase';

export default function StorylineView({ onNavigateToEntry }) {
  const {
    getNodeType,
    searchQuery, setSearchQuery,
    selectedTopics, setSelectedTopics,
    selectedMoods, setSelectedMoods,
    visibleTypes, setVisibleTypes,
    limitEntities, setLimitEntities,
    filteredNodes,
    timeBucketsData,
    loading,
    error,
    entries,
    uid
  } = useDiaryData();

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null); // { nodeId, nodeName, nodeType, month, weight, entries }
  const [tooltip, setTooltip] = useState(null); // { x, y, content }

  // AI summary states
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [summaryCache, setSummaryCache] = useState({}); // { "nodeId:::month": summary }

  // Dimensions for SVG
  const width = 900;
  const height = 550;
  const paddingLeft = 60;
  const paddingRight = 60;
  const paddingTop = 40;
  const paddingBottom = 40;

  const { months, occurrences, coOccurrences } = timeBucketsData;

  // Color helper based on sentiment
  const getPointColor = (nodeId, monthStr, nodeType) => {
    // Find all entries in this month
    const monthEntries = entries.filter(entry => {
      const dateStr = entry.frontmatter?.date;
      if (!dateStr || dateStr === 'תאריך לא ידוע') return false;
      return dateStr.substring(0, 7) === monthStr;
    });

    // Filter entries containing the node
    const nodeIdLower = nodeId.toLowerCase();
    const matchingEntries = monthEntries.filter(entry => {
      const text = (entry.content || '').toLowerCase();
      return text.includes(nodeIdLower) || (entry.frontmatter?.topics || []).some(t => t.toLowerCase() === nodeIdLower);
    });

    if (matchingEntries.length === 0) {
      return '#a0aec0'; // Default gray if no mentions
    }

    let posCount = 0;
    let negCount = 0;

    const HEBREW_NEGATIVE_MOODS = ['לחץ', 'חרדה', 'עצב', 'כעס', 'תסכול', 'עומס', 'מתח', 'בדידות', 'דאגה'];
    const HEBREW_POSITIVE_MOODS = ['שמחה', 'רוגע', 'אהבה', 'התרגשות', 'סיפוק', 'שקט', 'טוב'];

    matchingEntries.forEach(entry => {
      const mood = (entry.frontmatter?.mood || 'ניטרלי').toLowerCase();
      if (HEBREW_NEGATIVE_MOODS.some(m => mood.includes(m))) negCount++;
      else if (HEBREW_POSITIVE_MOODS.some(m => mood.includes(m))) posCount++;
    });

    if (negCount > posCount) return '#e53e3e'; // Red (Negative)
    if (posCount > negCount) return '#48bb78'; // Green (Positive)
    
    // Fallback neutral type-specific color
    if (nodeType === 'Person') return '#10b981'; // Emerald
    if (nodeType === 'Topic') return '#8b5cf6'; // Purple
    if (nodeType === 'Emotion') return '#ec4899'; // Pink
    return '#4299e1'; // Concept (Blue)
  };

  // 1. Calculate layout with barycenter sorting, filtering out inactive nodes
  const layoutData = useMemo(() => {
    if (!months.length || !filteredNodes.length) return { paths: [], rowHeight: 0 };

    const activeNodes = filteredNodes.filter(node => {
      return months.some((_, mIdx) => (occurrences[node.id]?.[mIdx] || 0) > 0);
    });

    if (activeNodes.length === 0) return { paths: [], rowHeight: 0 };

    const globalOrder = [...activeNodes]
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .map(n => n.id);

    const globalRowMap = {};
    globalOrder.forEach((id, index) => {
      globalRowMap[id] = index;
    });

    const numEntities = activeNodes.length;
    const rowHeight = (height - paddingTop - paddingBottom) / Math.max(1, numEntities - 1);

    const entityRowsPerMonth = {};
    activeNodes.forEach(n => {
      entityRowsPerMonth[n.id] = new Array(months.length).fill(0);
    });

    months.forEach((month, mIdx) => {
      const matrix = coOccurrences[mIdx] || {};
      
      const scores = activeNodes.map(node => {
        const id = node.id;
        const totalMentions = occurrences[id]?.[mIdx] || 0;
        
        if (totalMentions === 0) {
          return { id, score: globalRowMap[id] };
        }

        let sumWeights = 0;
        let weightedSum = 0;
        
        activeNodes.forEach(otherNode => {
          if (otherNode.id === id) return;
          const coOccurVal = matrix[id]?.[otherNode.id] || 0;
          if (coOccurVal > 0) {
            weightedSum += coOccurVal * globalRowMap[otherNode.id];
            sumWeights += coOccurVal;
          }
        });

        const score = sumWeights > 0 ? (weightedSum / sumWeights) : globalRowMap[id];
        return { id, score };
      });

      scores.sort((a, b) => a.score - b.score);

      scores.forEach((item, sortedIdx) => {
        entityRowsPerMonth[item.id][mIdx] = sortedIdx;
      });
    });

    const stepX = (width - paddingLeft - paddingRight) / Math.max(1, months.length - 1);
    
    const paths = activeNodes.map(node => {
      const id = node.id;
      const type = getNodeType(node);
      let maxWeight = 0;
      let peakPoint = null;

      const points = months.map((month, mIdx) => {
        const rowIdx = entityRowsPerMonth[id][mIdx];
        const x = paddingLeft + mIdx * stepX;
        const y = paddingTop + rowIdx * rowHeight;
        const weight = occurrences[id]?.[mIdx] || 0;
        const color = getPointColor(id, month, type);
        
        const pt = { x, y, weight, month, mIdx, color };
        if (weight > maxWeight) {
          maxWeight = weight;
          peakPoint = pt;
        }
        return pt;
      });

      if (!peakPoint) {
        peakPoint = points[Math.floor(points.length / 2)];
      }

      return {
        id,
        name: node.name || node.id,
        type,
        weight: node.weight,
        points,
        peakPoint,
        maxWeight
      };
    });

    return { paths, rowHeight };
  }, [filteredNodes, months, occurrences, coOccurrences, height, entries]);

  // Aggregate co-occurrences of all months for the hovered node
  const totalCoOccur = useMemo(() => {
    if (!hoveredNodeId || !months.length) return {};
    const counts = {};
    months.forEach((_, mIdx) => {
      const matrix = coOccurrences[mIdx] || {};
      const nodeMatrix = matrix[hoveredNodeId] || {};
      Object.keys(nodeMatrix).forEach(otherId => {
        counts[otherId] = (counts[otherId] || 0) + nodeMatrix[otherId];
      });
    });
    return counts;
  }, [hoveredNodeId, months, coOccurrences]);

  // Handle selected entity details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = filteredNodes.find(n => n.id === selectedNodeId);
    if (!node) return null;
    return {
      ...node,
      type: getNodeType(node),
      associatedEntries: node.frontmatter?.entries || []
    };
  }, [selectedNodeId, filteredNodes]);

  // Trigger AI Summary on peak selection
  useEffect(() => {
    if (!selectedPoint || !uid) return;
    const cacheKey = `${selectedPoint.nodeId}:::${selectedPoint.month}`;
    if (summaryCache[cacheKey]) {
      setAiSummary(summaryCache[cacheKey]);
      setAiError(null);
      return;
    }

    setAiLoading(true);
    setAiSummary('');
    setAiError(null);

    const queryStr = `אנא סכם בקצרה, מדויק ובגוף ראשון (עד שורה וחצי) את מה שהעסיק אותי לגבי "${selectedPoint.nodeName}" בחודש ${selectedPoint.month}.`;
    
    queryDiaryInsights(uid, queryStr)
      .then(res => {
        const text = res || 'לא נמצאו מספיק נתונים לסיכום AI.';
        setAiSummary(text);
        setSummaryCache(prev => ({ ...prev, [cacheKey]: text }));
      })
      .catch(err => {
        console.error(err);
        setAiError('לא ניתן היה לטעון סיכום בינה מלאכותית כרגע.');
      })
      .finally(() => {
        setAiLoading(false);
      });
  }, [selectedPoint, uid]);

  // Base node styling color
  const getNodeColor = (type) => {
    if (type === 'Person') return '#10b981'; // Emerald
    if (type === 'Topic') return '#8b5cf6'; // Purple
    if (type === 'Emotion') return '#ec4899'; // Pink
    return '#4299e1'; // Concept (Blue)
  };

  const cleanId = (id) => encodeURIComponent(id).replace(/%/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

  const toggleTypeVisibility = (type) => {
    setVisibleTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handlePointClick = (path, p) => {
    // Find matching entries for this month containing this entity
    const monthEntries = entries.filter(entry => {
      const dateStr = entry.frontmatter?.date;
      if (!dateStr || dateStr === 'תאריך לא ידוע') return false;
      if (dateStr.substring(0, 7) !== p.month) return false;
      
      const text = (entry.content || '').toLowerCase();
      const nodeIdLower = path.id.toLowerCase();
      return text.includes(nodeIdLower) || (entry.frontmatter?.topics || []).some(t => t.toLowerCase() === nodeIdLower);
    });

    setSelectedPoint({
      nodeId: path.id,
      nodeName: path.name,
      nodeType: path.type,
      month: p.month,
      weight: p.weight,
      entries: monthEntries
    });
  };

  return (
    <div className="graph-container" style={{ direction: 'rtl' }}>
      {/* Sidebar controls */}
      <div className="graph-sidebar">
        {selectedPoint ? (
          /* Month Peak Analysis Panel */
          <div className="concept-details" style={{ marginTop: '0px' }}>
            <div className="concept-header" style={{ position: 'relative', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button 
                onClick={() => setSelectedPoint(null)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--accent-color)', 
                  fontWeight: 600, 
                  fontSize: '0.8rem', 
                  padding: 0 
                }}
              >
                <ArrowRight size={14} />
                חזרה לכללי
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="concept-badge" style={{ backgroundColor: getNodeColor(selectedPoint.nodeType), color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                  {selectedPoint.nodeType}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {selectedPoint.month}
                </span>
              </div>
              <h3 className="concept-title" style={{ marginTop: '8px', fontSize: '1.2rem', fontWeight: 800 }}>{selectedPoint.nodeName}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                הופעות בחודש זה: {selectedPoint.weight}
              </div>
            </div>

            {/* AI Summarized Peak Insight */}
            <div style={{ margin: '14px 0', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.8rem' }}>
                <Brain size={16} />
                <span>תובנת בינה מלאכותית לשיא:</span>
              </div>
              {aiLoading && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>מנתח רשומות ומחבר תובנה...</div>}
              {aiError && <div style={{ fontSize: '0.75rem', color: '#e53e3e' }}>{aiError}</div>}
              {aiSummary && <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>"{aiSummary}"</p>}
            </div>

            {/* List of matching entries */}
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)' }}>רשומות החודש המזכירות את הישות:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {selectedPoint.entries.map((entry, idx) => (
                  <div 
                    key={entry.id || idx}
                    onClick={() => onNavigateToEntry(entry.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-color)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    className="hover-card"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {entry.frontmatter?.date}
                      </span>
                      <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {entry.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : selectedNode ? (
          /* General Entity Panel */
          <div className="concept-details" style={{ marginTop: '12px' }}>
            <div className="concept-header" style={{ position: 'relative' }}>
              <button 
                onClick={() => setSelectedNodeId(null)}
                style={{ position: 'absolute', left: 0, top: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}
              >
                ×
              </button>
              <span className="concept-badge" style={{ backgroundColor: getNodeColor(selectedNode.type), color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                {selectedNode.type}
              </span>
              <h3 className="concept-title" style={{ marginTop: '6px', fontSize: '1.1rem' }}>{selectedNode.name}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                חשיבות/משקל: {selectedNode.weight}
              </div>
            </div>

            <div className="concept-body" style={{ maxHeight: '140px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {selectedNode.content ? selectedNode.content : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>אין פירוט נוסף</span>}
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Info size={12} style={{ color: 'var(--accent-color)', marginLeft: '4px', display: 'inline' }} />
              ניתן ללחוץ על נקודה בגרף לצפייה בפירוט לפי חודשים וסיכום AI.
            </div>
          </div>
        ) : (
          /* Empty/Sidebar Filter Panel */
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Filter size={16} />
                סינון תרשים עלילה
              </h3>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTopics([]);
                  setSelectedMoods([]);
                  setVisibleTypes(['Concept', 'Person', 'Topic', 'Emotion']);
                  setLimitEntities(30);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                אפס סינונים
              </button>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="חפש ישות בעלילה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  backgroundColor: 'var(--panel-bg)',
                  color: 'var(--text-primary)'
                }}
              />
              <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
            </div>

            {/* Limit Entities Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>כמות ישויות מקסימלית:</span>
                <strong>{limitEntities}</strong>
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={limitEntities}
                onChange={(e) => setLimitEntities(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
              />
            </div>

            {/* Type filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>הצג סוגי מידע:</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { type: 'Concept', label: 'מושגים', color: '#4299e1' },
                  { type: 'Person', label: 'שמות/אנשים', color: '#10b981' },
                  { type: 'Topic', label: 'נושאים/תגיות', color: '#8b5cf6' },
                  { type: 'Emotion', label: 'רגשות', color: '#ec4899' }
                ].map(item => {
                  const checked = visibleTypes.includes(item.type);
                  return (
                    <button
                      key={item.type}
                      onClick={() => toggleTypeVisibility(item.type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid',
                        borderColor: checked ? item.color : 'var(--border-color)',
                        background: checked ? `${item.color}15` : 'transparent',
                        color: checked ? item.color : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: checked ? 600 : 400
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Storyline Graphics Area */}
      <div className="graph-canvas-container" style={{ flexGrow: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }}>
        
        {/* Info Alert */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--accent-light)', color: 'var(--text-primary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.8rem' }}>
          <Info size={16} style={{ color: 'var(--accent-color)' }} />
          <span>העקומות צבועות לפי <strong>מצב הרוח הדומיננטי</strong> בחודש: <span style={{ color: '#48bb78', fontWeight: 'bold' }}>חיובי</span>, <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>שלילי</span>, או צבע הישות. <strong>לחץ על נקודה</strong> לסיכום AI.</span>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 'auto' }}>מחשב תרשים עלילה...</div>}
        {error && <div style={{ color: '#e53e3e', fontSize: '0.95rem', margin: 'auto' }}>שגיאה בחישוב: {error}</div>}

        {!loading && !error && months.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 'auto' }}>אין מספיק נתוני תאריכים להצגת ציר זמן.</div>
        )}

        {!loading && !error && months.length > 0 && (
          <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              style={{ 
                width: '100%', 
                height: '100%', 
                maxHeight: '100%', 
                background: 'var(--panel-bg)', 
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}
            >
              {/* SVG Gradients for dynamic sentiment-based color curves */}
              <defs>
                {layoutData.paths.map((path) => {
                  return path.points.map((p, idx) => {
                    if (idx === path.points.length - 1) return null;
                    const pNext = path.points[idx + 1];
                    const gradId = `grad-${cleanId(path.id)}-${idx}`;
                    return (
                      <linearGradient key={gradId} id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={p.color} />
                        <stop offset="100%" stopColor={pNext.color} />
                      </linearGradient>
                    );
                  });
                })}
              </defs>

              {/* Background Grid Lines (Months) */}
              {months.map((month, idx) => {
                const stepX = (width - paddingLeft - paddingRight) / Math.max(1, months.length - 1);
                const x = paddingLeft + idx * stepX;
                return (
                  <g key={idx}>
                    <line 
                      x1={x} 
                      y1={paddingTop - 10} 
                      x2={x} 
                      y2={height - paddingBottom + 10} 
                      stroke="var(--border-color)" 
                      strokeWidth={1} 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={x} 
                      y={height - paddingBottom + 30} 
                      fill="var(--text-muted)" 
                      fontSize="10.5" 
                      fontWeight="bold"
                      textAnchor="middle" 
                      fontFamily="var(--font-sans)"
                    >
                      {month}
                    </text>
                  </g>
                );
              })}

              {/* Storyline splines with sentiment gradients */}
              {layoutData.paths.map((path) => {
                const isHovered = hoveredNodeId === path.id;
                const isSelected = selectedNodeId === path.id;
                const isCoOccurrent = hoveredNodeId && totalCoOccur[path.id] > 0;
                
                // Build Bezier spline connections between months
                const segments = [];
                for (let i = 0; i < path.points.length - 1; i++) {
                  const p1 = path.points[i];
                  const p2 = path.points[i + 1];

                  const dx = p2.x - p1.x;
                  const cp1x = p1.x + dx / 2;
                  const cp1y = p1.y;
                  const cp2x = p2.x - dx / 2;
                  const cp2y = p2.y;

                  // Average thickness of segment (min thickness 1.5, max 16)
                  const avgWeight = (p1.weight + p2.weight) / 2;
                  const strokeWidth = avgWeight > 0 
                    ? Math.min(16, Math.max(2, avgWeight * 3.5))
                    : 1.0;

                  // Dynamic gradient stroke or single fallback
                  const strokeVal = (p1.weight > 0 || p2.weight > 0)
                    ? `url(#grad-${cleanId(path.id)}-${i})`
                    : p1.color;

                  // If both points have 0 occurrences, fade the line
                  let opacity = 0.65;
                  if (hoveredNodeId) {
                    if (isHovered || isSelected) opacity = 1.0;
                    else if (isCoOccurrent) opacity = 0.85; // Highlight co-occurring curves
                    else opacity = 0.05; // Fade out others
                  } else if (isSelected) {
                    opacity = 1.0;
                  }

                  if (p1.weight === 0 && p2.weight === 0) {
                    opacity = hoveredNodeId ? 0.01 : 0.06;
                  }

                  segments.push(
                    <path
                      key={i}
                      d={`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`}
                      fill="none"
                      stroke={strokeVal}
                      strokeWidth={isHovered || isSelected ? strokeWidth + 2.0 : strokeWidth}
                      opacity={opacity}
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => {
                        setHoveredNodeId(path.id);
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY - 40,
                          content: `${path.name} (${path.type})`
                        });
                      }}
                      onMouseMove={(e) => {
                        setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY - 40 } : null);
                      }}
                      onMouseLeave={() => {
                        setHoveredNodeId(null);
                        setTooltip(null);
                      }}
                      onClick={() => setSelectedNodeId(path.id)}
                    />
                  );
                }

                return <g key={path.id}>{segments}</g>;
              })}

              {/* Storyline Interaction Dots (occurrences only) */}
              {layoutData.paths.map((path) => {
                const isHovered = hoveredNodeId === path.id;
                const isSelected = selectedNodeId === path.id;
                const isCoOccurrent = hoveredNodeId && totalCoOccur[path.id] > 0;

                const showDots = !hoveredNodeId || isHovered || isSelected || isCoOccurrent;

                return path.points
                  .filter(p => p.weight > 0)
                  .map((p, pIdx) => {
                    const radius = Math.min(11, Math.max(4, p.weight * 2.5));
                    
                    let opacity = 0.85;
                    if (hoveredNodeId) {
                      if (isHovered || isSelected) opacity = 1.0;
                      else if (isCoOccurrent) opacity = 0.8;
                      else opacity = 0.15;
                    }

                    if (!showDots) return null;

                    return (
                      <circle
                        key={`${path.id}-${pIdx}`}
                        cx={p.x}
                        cy={p.y}
                        r={isHovered || isSelected ? radius + 2.0 : radius}
                        fill={p.color}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        opacity={opacity}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => {
                          setHoveredNodeId(path.id);
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY - 40,
                            content: `${path.name}: ${p.weight} הופעות ב-${p.month}`
                          });
                        }}
                        onMouseMove={(e) => {
                          setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY - 40 } : null);
                        }}
                        onMouseLeave={() => {
                          setHoveredNodeId(null);
                          setTooltip(null);
                        }}
                        onClick={() => handlePointClick(path, p)}
                      />
                    );
                  });
              })}

              {/* Inline entity labels at peak coordinates to avoid overlapping axis clutter */}
              {layoutData.paths.map((path) => {
                const isHovered = hoveredNodeId === path.id;
                const isSelected = selectedNodeId === path.id;
                const isCoOccurrent = hoveredNodeId && totalCoOccur[path.id] > 0;
                const peak = path.peakPoint;

                if (!peak || path.maxWeight === 0) return null;

                let opacity = isSelected ? 1.0 : 0.8;
                if (hoveredNodeId) {
                  if (isHovered || isSelected) opacity = 1.0;
                  else if (isCoOccurrent) opacity = 0.85;
                  else opacity = 0.1;
                }

                const isSmallBubble = path.maxWeight <= 1;

                return (
                  <g key={`label-${path.id}`} style={{ pointerEvents: 'none' }}>
                    <text
                      x={peak.x}
                      y={peak.y - (isSmallBubble ? 10 : 14)}
                      fill="var(--panel-bg)"
                      fontSize={isHovered || isSelected ? '11.5px' : '9.5px'}
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                      stroke="var(--panel-bg)"
                      strokeWidth={3.5}
                      opacity={opacity}
                    >
                      {path.name}
                    </text>
                    <text
                      x={peak.x}
                      y={peak.y - (isSmallBubble ? 10 : 14)}
                      fill={isHovered || isSelected ? peak.color : 'var(--text-primary)'}
                      fontSize={isHovered || isSelected ? '11.5px' : '9.5px'}
                      fontWeight={isHovered || isSelected ? 'bold' : '600'}
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                      opacity={opacity}
                    >
                      {path.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {/* HTML Floating Tooltip */}
            {tooltip && (
              <div 
                style={{
                  position: 'fixed',
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y}px`,
                  transform: 'translate(-50%, -100%)',
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  pointerEvents: 'none',
                  zIndex: 9999,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  whiteSpace: 'nowrap',
                  direction: 'rtl'
                }}
              >
                {tooltip.content}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
