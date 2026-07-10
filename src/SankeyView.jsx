import React, { useMemo, useState, useEffect } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { Sliders, Info, Calendar, ArrowRight, FileText, Activity } from 'lucide-react';

export default function SankeyView({ onNavigateToEntry }) {
  const { entries, filteredNodes, getNodeType, loading, error } = useDiaryData();
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  // Selected node for detail drill-down
  const [selectedSankeyNode, setSelectedSankeyNode] = useState(null);

  // Control States
  const [flowMode, setFlowMode] = useState('flow_a'); // 'flow_a' or 'flow_b'
  const [maxLeftNodes, setMaxLeftNodes] = useState(10);
  const [maxMidNodes, setMaxMidNodes] = useState(10);
  const [maxRightNodes, setMaxRightNodes] = useState(8);
  const [minLinkValue, setMinLinkValue] = useState(1);

  // Time-slicing months
  const availableMonths = useMemo(() => {
    const months = new Set();
    entries.forEach(e => {
      const dateStr = e.frontmatter?.date;
      if (dateStr && dateStr !== 'תאריך לא ידוע') {
        months.add(dateStr.substring(0, 7)); // "YYYY-MM"
      }
    });
    return Array.from(months).sort();
  }, [entries]);

  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');

  // Set default month range
  useEffect(() => {
    if (availableMonths.length > 0) {
      setStartMonth(availableMonths[0]);
      setEndMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths]);

  // Filter entries based on selected month range
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const dateStr = e.frontmatter?.date;
      if (!dateStr || dateStr === 'תאריך לא ידוע') return false;
      const m = dateStr.substring(0, 7);
      const startOk = !startMonth || m >= startMonth;
      const endOk = !endMonth || m <= endMonth;
      return startOk && endOk;
    });
  }, [entries, startMonth, endMonth]);

  // SVG dimensions
  const width = 800;
  const height = 500;
  const paddingX = 140; 
  const paddingY = 40;

  // Build nodes and links based on flowMode and dynamic thresholds
  const sankeyData = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) return null;

    const leftCounts = {};
    const midCounts = {};
    const rightCounts = {};

    const leftToMidLinks = {}; // "left:::mid" -> count
    const midToRightLinks = {}; // "mid:::right" -> count

    filteredEntries.forEach(entry => {
      const contentLower = (entry.content || '').toLowerCase();
      
      // Clean and normalize mood
      let rawMood = entry.frontmatter?.mood || 'ניטרלי';
      if (rawMood.length > 30) rawMood = 'ניטרלי';
      const entryMood = rawMood.trim();

      const entryTopics = entry.frontmatter?.topics || [];
      const entryActions = entry.frontmatter?.open_threads || [];

      if (flowMode === 'flow_a') {
        // Mode A: People -> Topics -> Moods
        // Find people mentioned in this entry
        const entryPeople = filteredNodes
          .filter(n => getNodeType(n) === 'Person')
          .filter(n => {
            const idL = n.id.toLowerCase();
            const nameL = (n.name || n.id).toLowerCase();
            return contentLower.includes(idL) || contentLower.includes(nameL);
          })
          .map(n => n.name || n.id);

        entryPeople.forEach(person => {
          leftCounts[person] = (leftCounts[person] || 0) + 1;
          entryTopics.forEach(topic => {
            const key = `${person}:::${topic}`;
            leftToMidLinks[key] = (leftToMidLinks[key] || 0) + 1;
          });
        });

        entryTopics.forEach(topic => {
          midCounts[topic] = (midCounts[topic] || 0) + 1;
          const key = `${topic}:::${entryMood}`;
          midToRightLinks[key] = (midToRightLinks[key] || 0) + 1;
        });

        rightCounts[entryMood] = (rightCounts[entryMood] || 0) + 1;

      } else {
        // Mode B: Topics -> Moods -> Actions/Open Threads
        entryTopics.forEach(topic => {
          leftCounts[topic] = (leftCounts[topic] || 0) + 1;
          const key = `${topic}:::${entryMood}`;
          leftToMidLinks[key] = (leftToMidLinks[key] || 0) + 1;
        });

        midCounts[entryMood] = (midCounts[entryMood] || 0) + 1;

        entryActions.forEach(action => {
          // Normalize action text to avoid extremely long nodes
          const shortAction = action.length > 35 ? action.substring(0, 32) + '...' : action;
          rightCounts[shortAction] = (rightCounts[shortAction] || 0) + 1;
          const key = `${entryMood}:::${shortAction}`;
          midToRightLinks[key] = (midToRightLinks[key] || 0) + 1;
        });
      }
    });

    // Top elements by limits
    const sortedLeft = Object.keys(leftCounts)
      .sort((a, b) => leftCounts[b] - leftCounts[a])
      .slice(0, maxLeftNodes);

    const sortedMid = Object.keys(midCounts)
      .sort((a, b) => midCounts[b] - midCounts[a])
      .slice(0, maxMidNodes);

    const sortedRight = Object.keys(rightCounts)
      .sort((a, b) => rightCounts[b] - rightCounts[a])
      .slice(0, maxRightNodes);

    const activeLeftSet = new Set(sortedLeft);
    const activeMidSet = new Set(sortedMid);
    const activeRightSet = new Set(sortedRight);

    // Build nodes array and map
    const nodes = [];
    const nodeMap = {}; // name -> index

    sortedLeft.forEach(name => {
      nodeMap[name] = nodes.length;
      nodes.push({ name, category: flowMode === 'flow_a' ? 'person' : 'topic' });
    });

    sortedMid.forEach(name => {
      nodeMap[name] = nodes.length;
      nodes.push({ name, category: flowMode === 'flow_a' ? 'topic' : 'mood' });
    });

    sortedRight.forEach(name => {
      nodeMap[name] = nodes.length;
      nodes.push({ name, category: flowMode === 'flow_a' ? 'mood' : 'action' });
    });

    // Build links
    const links = [];

    Object.keys(leftToMidLinks).forEach(key => {
      const [left, mid] = key.split(':::');
      const val = leftToMidLinks[key];
      if (val >= minLinkValue && activeLeftSet.has(left) && activeMidSet.has(mid)) {
        if (nodeMap[left] !== undefined && nodeMap[mid] !== undefined) {
          links.push({ source: nodeMap[left], target: nodeMap[mid], value: val });
        }
      }
    });

    Object.keys(midToRightLinks).forEach(key => {
      const [mid, right] = key.split(':::');
      const val = midToRightLinks[key];
      if (val >= minLinkValue && activeMidSet.has(mid) && activeRightSet.has(right)) {
        if (nodeMap[mid] !== undefined && nodeMap[right] !== undefined) {
          links.push({ source: nodeMap[mid], target: nodeMap[right], value: val });
        }
      }
    });

    if (nodes.length === 0 || links.length === 0) return null;

    // Apply manual column constraints for strict columns layout
    nodes.forEach(node => {
      let colIdx = 0;
      if (flowMode === 'flow_a') {
        if (node.category === 'person') colIdx = 0;
        else if (node.category === 'topic') colIdx = 1;
        else colIdx = 2;
      } else {
        if (node.category === 'topic') colIdx = 0;
        else if (node.category === 'mood') colIdx = 1;
        else colIdx = 2;
      }

      const nodeW = 16;
      if (colIdx === 0) {
        node.x0 = paddingX;
        node.x1 = paddingX + nodeW;
      } else if (colIdx === 1) {
        node.x0 = width / 2 - nodeW / 2;
        node.x1 = width / 2 + nodeW / 2;
      } else {
        node.x0 = width - paddingX - nodeW;
        node.x1 = width - paddingX;
      }
    });

    // Run d3 sankey layout generator (it respects pre-assigned x0/x1)
    const sankeyGenerator = sankey()
      .nodeWidth(16)
      .nodePadding(18)
      .extent([[paddingX, paddingY], [width - paddingX, height - paddingY]]);

    try {
      const graph = {
        nodes: nodes.map(n => ({ ...n })),
        links: links.map(l => ({ ...l }))
      };
      const result = sankeyGenerator(graph);
      return result;
    } catch (err) {
      console.error("Sankey layout generation failed: ", err);
      return null;
    }
  }, [filteredEntries, filteredNodes, flowMode, maxLeftNodes, maxMidNodes, maxRightNodes, minLinkValue, width, height]);

  // Mood color helper
  const getMoodColor = (moodName) => {
    const HEBREW_NEGATIVE_MOODS = ['לחץ', 'חרדה', 'עצב', 'כעס', 'תסכול', 'עומס', 'מתח', 'בדידות', 'דאגה'];
    const HEBREW_POSITIVE_MOODS = ['שמחה', 'רוגע', 'אהבה', 'התרגשות', 'סיפוק', 'שקט', 'טוב'];
    
    const moodLower = moodName.toLowerCase();
    if (HEBREW_NEGATIVE_MOODS.some(m => moodLower.includes(m))) return '#e53e3e'; // Red
    if (HEBREW_POSITIVE_MOODS.some(m => moodLower.includes(m))) return '#38a169'; // Green
    return '#a0aec0'; // Grey neutral
  };

  const getNodeColor = (node) => {
    if (node.category === 'mood') return getMoodColor(node.name);
    if (node.category === 'person') return '#10b981'; // Emerald
    if (node.category === 'topic') return '#8b5cf6'; // Purple
    return '#4299e1'; // Action / Concept
  };

  // Find entries contributing to selected Sankey node
  const selectedNodeEntries = useMemo(() => {
    if (!selectedSankeyNode) return [];
    
    const nameLower = selectedSankeyNode.name.toLowerCase();
    
    return filteredEntries.filter(entry => {
      const contentLower = (entry.content || '').toLowerCase();
      const entryTopics = (entry.frontmatter?.topics || []).map(t => t.toLowerCase());
      const entryActions = (entry.frontmatter?.open_threads || []).map(t => t.toLowerCase());
      const entryMood = (entry.frontmatter?.mood || 'ניטרלי').toLowerCase();

      if (selectedSankeyNode.category === 'person') {
        return contentLower.includes(nameLower);
      }
      if (selectedSankeyNode.category === 'topic') {
        return entryTopics.includes(nameLower);
      }
      if (selectedSankeyNode.category === 'mood') {
        return entryMood.includes(nameLower) || (nameLower === 'ניטרלי' && !entryMood);
      }
      if (selectedSankeyNode.category === 'action') {
        return entryActions.some(act => act.includes(nameLower) || nameLower.includes(act));
      }
      return false;
    });
  }, [selectedSankeyNode, filteredEntries]);

  return (
    <div className="graph-container" style={{ direction: 'rtl', height: '100%', display: 'flex' }}>
      
      {/* Sidebar Controls and Drill-Down details */}
      <div className="graph-sidebar" style={{ width: '290px', flexShrink: 0, padding: '20px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--panel-bg)', overflowY: 'auto' }}>
        
        {selectedSankeyNode ? (
          /* Drill-down details panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button 
                onClick={() => setSelectedSankeyNode(null)}
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
                חזרה לבקרת זרימה
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span className="concept-badge" style={{ backgroundColor: getNodeColor(selectedSankeyNode), color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                  {selectedSankeyNode.category === 'person' ? 'אדם' : selectedSankeyNode.category === 'topic' ? 'נושא' : selectedSankeyNode.category === 'mood' ? 'רגש' : 'פעולה'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  סה"כ קשרים: {selectedSankeyNode.value}
                </span>
              </div>
              <h3 style={{ marginTop: '8px', fontSize: '1.15rem', fontWeight: 800 }}>{selectedSankeyNode.name}</h3>
            </div>

            {/* List of contributing entries */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} />
                רשומות קשורות ({selectedNodeEntries.length}):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedNodeEntries.map((entry, idx) => (
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
                      <span style={{ fontSize: '0.7rem', padding: '1px 4px', borderRadius: '2px', backgroundColor: getMoodColor(entry.frontmatter?.mood || ''), color: '#fff' }}>
                        {entry.frontmatter?.mood || 'ניטרלי'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {entry.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Normal Flow Control Sidebar */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>סוג זרימה ובקרה</h3>
            </div>

            {/* Mode selection buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>מודל זרימה:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => setFlowMode('flow_a')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: flowMode === 'flow_a' ? 'var(--accent-color)' : 'var(--border-color)',
                    background: flowMode === 'flow_a' ? 'var(--accent-light)' : 'transparent',
                    color: flowMode === 'flow_a' ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: flowMode === 'flow_a' ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  👤 אנשים ⬅️ 🏷️ נושאים ⬅️ 🎭 רגשות
                </button>
                <button
                  onClick={() => setFlowMode('flow_b')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: flowMode === 'flow_b' ? 'var(--accent-color)' : 'var(--border-color)',
                    background: flowMode === 'flow_b' ? 'var(--accent-light)' : 'transparent',
                    color: flowMode === 'flow_b' ? 'var(--accent-color)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: flowMode === 'flow_b' ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  🏷️ נושאים ⬅️ 🎭 רגשות ⬅️ ⚡ פעולות/פתילים
                </button>
              </div>
            </div>

            {/* Time Slicing Month Filters */}
            {availableMonths.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} />
                  פילוח לפי זמן:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>מחודש:</label>
                    <select
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                    >
                      {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>עד חודש:</label>
                    <select
                      value={endMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                    >
                      {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Limits Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>מקורות (עמודה 1):</span>
                  <strong>{maxLeftNodes}</strong>
                </label>
                <input
                  type="range" min="3" max="25" value={maxLeftNodes}
                  onChange={(e) => setMaxLeftNodes(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>מרכזיים (עמודה 2):</span>
                  <strong>{maxMidNodes}</strong>
                </label>
                <input
                  type="range" min="3" max="25" value={maxMidNodes}
                  onChange={(e) => setMaxMidNodes(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>יעדים (עמודה 3):</span>
                  <strong>{maxRightNodes}</strong>
                </label>
                <input
                  type="range" min="3" max="20" value={maxRightNodes}
                  onChange={(e) => setMaxRightNodes(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>קשר מינימלי:</span>
                  <strong>{minLinkValue} הופעות</strong>
                </label>
                <input
                  type="range" min="1" max="6" value={minLinkValue}
                  onChange={(e) => setMinLinkValue(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main diagram area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px', overflow: 'hidden' }}>
        
        {/* Title */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            תרשים סנקי תלת-שלבי
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            מראה זרימה היררכית לרוחב קטגוריות. <strong>הצבע על קשר או מלבן להבלטה, לחץ על מלבן לפירוט רשומות</strong>.
          </p>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', padding: '20px', overflow: 'hidden' }}>
          {loading && <div style={{ color: 'var(--text-muted)' }}>מחשב נתוני זרימה...</div>}
          {error && <div style={{ color: '#e53e3e' }}>שגיאה בטעינה: {error}</div>}
          
          {!loading && !error && !sankeyData && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              לא נמצאו נתוני זרימה תואמים לסינון ולטווח התאריכים הנוכחי.<br/>נסה להפחית את עוצמת הקשר או לשנות את מודל הזרימה.
            </div>
          )}

          {!loading && !error && sankeyData && (
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              style={{ 
                width: '100%', 
                height: '100%', 
                maxHeight: '440px',
                padding: '10px'
              }}
            >
              {/* Render column titles on top */}
              <g style={{ fontSize: '10px', fontWeight: 700, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                <text x={paddingX} y={paddingY - 14} textAnchor="start">
                  {flowMode === 'flow_a' ? '👤 אנשים וגורמים' : '🏷️ נושאי יומן'}
                </text>
                <text x={width / 2} y={paddingY - 14} textAnchor="middle">
                  {flowMode === 'flow_a' ? '🏷️ נושאי יומן' : '🎭 רגשות ומצבי רוח'}
                </text>
                <text x={width - paddingX} y={paddingY - 14} textAnchor="end">
                  {flowMode === 'flow_a' ? '🎭 רגשות ומצבי רוח' : '⚡ פעולות / פתילים'}
                </text>
              </g>

              {/* Draw links/ribbons */}
              <g fill="none">
                {sankeyData.links.map((link, idx) => {
                  const isHovered = hoveredLink === link || 
                                   (hoveredNode && (link.source.index === hoveredNode.index || link.target.index === hoveredNode.index));
                  
                  // Color link based on the mood node color
                  let strokeColor = '#cbd5e0';
                  if (flowMode === 'flow_a') {
                    strokeColor = getMoodColor(link.target.name);
                  } else {
                    strokeColor = getMoodColor(link.source.name);
                  }

                  const pathGenerator = sankeyLinkHorizontal();
                  const d = pathGenerator(link);

                  return (
                    <path
                      key={idx}
                      d={d}
                      stroke={strokeColor}
                      strokeWidth={Math.max(1.5, link.width)}
                      strokeOpacity={hoveredLink || hoveredNode ? (isHovered ? 0.65 : 0.04) : 0.22}
                      style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredLink(link)}
                      onMouseLeave={() => setHoveredLink(null)}
                    >
                      <title>{`${link.source.name} ↔ ${link.target.name}: ${link.value} הופעות`}</title>
                    </path>
                  );
                })}
              </g>

              {/* Draw Nodes */}
              <g>
                {sankeyData.nodes.map((node, idx) => {
                  const isHovered = hoveredNode === node || 
                                   (hoveredLink && (hoveredLink.source.index === node.index || hoveredLink.target.index === node.index));
                  
                  const nodeColor = getNodeColor(node);
                  
                  // Text alignment logic
                  let textX = node.x1 + 8;
                  let textAnchor = 'start';
                  if (node.x0 > width / 2 + 50) {
                    textX = node.x0 - 8;
                    textAnchor = 'end';
                  } else if (node.x0 > width / 2 - 50 && node.x0 < width / 2 + 50) {
                    textX = node.x0 - 8;
                    textAnchor = 'end';
                  }

                  return (
                    <g key={idx}>
                      {/* Node rectangle */}
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={node.x1 - node.x0}
                        height={Math.max(4, node.y1 - node.y0)}
                        fill={nodeColor}
                        fillOpacity={hoveredLink || hoveredNode ? (isHovered ? 1.0 : 0.25) : 0.8}
                        rx={3}
                        style={{ cursor: 'pointer', transition: 'fill-opacity 0.15s' }}
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => setSelectedSankeyNode(node)}
                      >
                        <title>{`${node.name}: ${node.value} רשומות קשורות`}</title>
                      </rect>

                      {/* Node Text Label */}
                      <text
                        x={textX}
                        y={(node.y0 + node.y1) / 2}
                        dy="0.35em"
                        textAnchor={textAnchor}
                        fontSize="10"
                        fontWeight={isHovered ? 'bold' : '600'}
                        fill="var(--text-primary)"
                        fontFamily="var(--font-sans)"
                        opacity={hoveredLink || hoveredNode ? (isHovered ? 1.0 : 0.3) : 0.9}
                        style={{ transition: 'opacity 0.15s, font-weight 0.15s', pointerEvents: 'none' }}
                      >
                        {node.name} ({node.value})
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
