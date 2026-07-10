import React, { useState, useMemo } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { Filter, Search, ArrowLeftRight, HelpCircle } from 'lucide-react';

export default function MatrixView({ onNavigateToEntry }) {
  const {
    filteredNodes,
    filteredLinks,
    conceptMetadataMap,
    getNodeType,
    searchQuery, setSearchQuery,
    limitEntities, setLimitEntities,
    visibleTypes, setVisibleTypes
  } = useDiaryData();

  const [sortingMode, setSortingMode] = useState('cluster'); // 'cluster', 'degree', 'conflict', 'chronological'
  const [hoveredCell, setHoveredCell] = useState(null); // { rowId, colId }
  const [selectedCell, setSelectedCell] = useState(null); // { nodeA, nodeB, link }

  // 1. Sort nodes based on selected sorting mode
  const sortedNodes = useMemo(() => {
    const nodes = [...filteredNodes];
    
    if (sortingMode === 'degree') {
      // Sort by degree (number of connected links)
      return nodes.sort((a, b) => {
        const degA = filteredLinks.filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return s === a.id || t === a.id;
        }).length;
        const degB = filteredLinks.filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return s === b.id || t === b.id;
        }).length;
        return degB - degA;
      });
    }

    if (sortingMode === 'conflict') {
      // Sort by negative connection count or score
      return nodes.sort((a, b) => {
        const negA = filteredLinks.filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return (s === a.id || t === a.id) && (l.sentimentScore || 0) < 0;
        }).length;
        const negB = filteredLinks.filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return (s === b.id || t === b.id) && (l.sentimentScore || 0) < 0;
        }).length;
        return negB - negA;
      });
    }

    if (sortingMode === 'chronological') {
      // Sort by first appearance date
      return nodes.sort((a, b) => {
        const entriesA = conceptMetadataMap[a.id.toLowerCase()]?.entries || [];
        const entriesB = conceptMetadataMap[b.id.toLowerCase()]?.entries || [];
        const dateA = entriesA.map(e => e.date).filter(Boolean).sort()[0] || '9999-99-99';
        const dateB = entriesB.map(e => e.date).filter(Boolean).sort()[0] || '9999-99-99';
        return dateA.localeCompare(dateB);
      });
    }

    // Default: 'cluster' (Group by type, then weight)
    return nodes.sort((a, b) => {
      const typeA = getNodeType(a);
      const typeB = getNodeType(b);
      if (typeA !== typeB) {
        return typeA.localeCompare(typeB);
      }
      return (b.weight || 0) - (a.weight || 0);
    });
  }, [filteredNodes, filteredLinks, sortingMode, conceptMetadataMap]);

  // 2. Build lookup maps for connections
  const connectionsMap = useMemo(() => {
    const map = {};
    sortedNodes.forEach(n1 => {
      map[n1.id] = {};
      sortedNodes.forEach(n2 => {
        map[n1.id][n2.id] = null;
      });
    });

    filteredLinks.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (map[s] && map[s][t] === null) {
        map[s][t] = link;
      }
      if (map[t] && map[t][s] === null) {
        map[t][s] = link;
      }
    });

    return map;
  }, [sortedNodes, filteredLinks]);

  // Handle cell click
  const handleCellClick = (rowId, colId, link) => {
    if (!link) return;
    const nodeA = filteredNodes.find(n => n.id === rowId);
    const nodeB = filteredNodes.find(n => n.id === colId);
    if (nodeA && nodeB) {
      // Find entries that contain both concepts
      const entriesA = conceptMetadataMap[rowId.toLowerCase()]?.entries || [];
      const entriesB = conceptMetadataMap[colId.toLowerCase()]?.entries || [];
      const commonEntries = entriesA.filter(eA => entriesB.some(eB => eB.id === eA.id));

      setSelectedCell({
        nodeA,
        nodeB,
        link,
        commonEntries
      });
    }
  };

  // Node Color Helper
  const getNodeBadgeColor = (type) => {
    switch (type) {
      case 'Person': return '#48bb78';
      case 'Topic': return '#9f7aea';
      case 'Emotion': return '#ed64a6';
      default: return '#3182ce';
    }
  };

  // Cell Background Styling Helper
  const getCellColor = (link, isHovered, isSelected) => {
    if (!link) return isHovered ? 'rgba(0, 53, 95, 0.04)' : 'transparent';
    
    const sentiment = link.sentimentScore || 0;
    const weight = link.weight || link.val || link.strength || link.value || 1;
    const baseOpacity = Math.min(1.0, 0.15 + (weight * 0.15));

    let color = 'rgba(128, 128, 128, '; // Neutral grey
    if (sentiment > 0) color = 'rgba(72, 187, 120, '; // Green
    if (sentiment < 0) color = 'rgba(229, 62, 62, '; // Red

    const activeOpacity = isSelected ? 1.0 : (isHovered ? baseOpacity + 0.15 : baseOpacity);
    return `${color}${activeOpacity})`;
  };

  return (
    <div className="graph-container" style={{ direction: 'rtl' }}>
      {/* Right controls sidebar */}
      <div className="graph-sidebar">
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>הגדרות מטריצה</h3>
          
          {/* Sorting controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>סדר מיון:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { mode: 'cluster', label: 'מיון לפי אשכולות (סוג)' },
                { mode: 'degree', label: 'מיון לפי כמות קשרים' },
                { mode: 'conflict', label: 'מיון לפי קונפליקטים/טעונות' },
                { mode: 'chronological', label: 'מיון כרונולוגי' }
              ].map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => setSortingMode(opt.mode)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: sortingMode === opt.mode ? 'var(--accent-light)' : 'transparent',
                    color: sortingMode === opt.mode ? 'var(--accent-color)' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    textAlign: 'right',
                    cursor: 'pointer',
                    fontWeight: sortingMode === opt.mode ? 600 : 400
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slider for limits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>כמות צמתים מקסימלית:</span>
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
        </div>

        {/* Selected connection details */}
        {selectedCell ? (
          <div className="concept-details" style={{ marginTop: '12px' }}>
            <div className="concept-header">
              <button 
                onClick={() => setSelectedCell(null)}
                style={{ float: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}
              >
                ×
              </button>
              <h3 className="concept-title" style={{ fontSize: '1rem', marginTop: '4px' }}>
                קשר: {selectedCell.nodeA.name} ↔ {selectedCell.nodeB.name}
              </h3>
              <div style={{ fontSize: '0.75rem', display: 'flex', gap: '4px', marginTop: '4px' }}>
                <span style={{ color: selectedCell.link.sentimentScore > 0 ? '#48bb78' : selectedCell.link.sentimentScore < 0 ? '#e53e3e' : 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedCell.link.sentimentScore > 0 ? 'חיובי / מרפא' : selectedCell.link.sentimentScore < 0 ? 'שלילי / מלחיץ' : 'ניטרלי'}
                </span>
                <span>• עוצמה: {selectedCell.link.weight || 1}</span>
              </div>
            </div>

            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>סוג הקשר:</strong> {selectedCell.link.label || 'לא מוגדר'}
            </div>

            {selectedCell.commonEntries.length > 0 ? (
              <div style={{ marginTop: '8px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>רשומות יומן משותפות ({selectedCell.commonEntries.length}):</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {selectedCell.commonEntries.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => onNavigateToEntry && onNavigateToEntry(e.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-color)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'right',
                        padding: 0,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>📄</span>
                      <span style={{ textDecoration: 'underline' }}>רשומה מתאריך: {e.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                לא נמצאו רשומות המקשרות בין המושגים בציר הזמן
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={24} style={{ color: 'var(--text-muted)' }} />
            <span>לחץ על תא צבוע במטריצה כדי להציג את הציטוטים והקשרים המשותפים.</span>
          </div>
        )}
      </div>

      {/* Main Grid Area */}
      <div style={{ flexGrow: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {sortedNodes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '100px' }}>אין נתונים להציג</div>
        ) : (
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 'fit-content' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: 'auto', margin: 'auto' }}>
              <thead>
                <tr>
                  {/* Top-left empty cell */}
                  <th style={{ width: '100px', height: '40px', border: '1px solid var(--border-color)' }}></th>
                  
                  {/* Top column headers (Rotated labels) */}
                  {sortedNodes.map(node => {
                    const isSelected = selectedCell && (selectedCell.nodeA.id === node.id || selectedCell.nodeB.id === node.id);
                    return (
                      <th 
                        key={node.id} 
                        style={{ 
                          width: '32px', 
                          height: '100px', 
                          border: '1px solid var(--border-color)', 
                          verticalAlign: 'bottom', 
                          padding: '5px',
                          position: 'relative',
                          backgroundColor: isSelected ? 'rgba(0,53,95,0.03)' : 'transparent'
                        }}
                      >
                        <div style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          textAlign: 'left',
                          fontSize: '0.7rem',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                          width: '100%',
                          margin: '0 auto',
                          fontFamily: 'var(--font-sans)',
                          whiteSpace: 'nowrap'
                        }}>
                          {node.name || node.id}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedNodes.map(rowNode => {
                  const isRowSelected = selectedCell && (selectedCell.nodeA.id === rowNode.id || selectedCell.nodeB.id === rowNode.id);
                  const rowType = getNodeType(rowNode);
                  
                  return (
                    <tr key={rowNode.id} style={{ backgroundColor: isRowSelected ? 'rgba(0,53,95,0.03)' : 'transparent' }}>
                      {/* Left row labels */}
                      <td 
                        style={{ 
                          width: '100px', 
                          height: '32px', 
                          border: '1px solid var(--border-color)', 
                          fontSize: '0.75rem', 
                          fontWeight: isRowSelected ? 'bold' : 'normal',
                          color: isRowSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                          padding: '0 8px',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          borderRight: `3px solid ${getNodeBadgeColor(rowType)}`
                        }}
                        title={rowNode.name || rowNode.id}
                      >
                        {rowNode.name || rowNode.id}
                      </td>

                      {/* Connection cells */}
                      {sortedNodes.map(colNode => {
                        const link = connectionsMap[rowNode.id][colNode.id];
                        const isSelf = rowNode.id === colNode.id;
                        
                        const isHovered = hoveredCell && (hoveredCell.rowId === rowNode.id || hoveredCell.colId === colNode.id);
                        const isSelected = selectedCell && 
                          ((selectedCell.nodeA.id === rowNode.id && selectedCell.nodeB.id === colNode.id) ||
                           (selectedCell.nodeA.id === colNode.id && selectedCell.nodeB.id === rowNode.id));

                        return (
                          <td
                            key={colNode.id}
                            onClick={() => !isSelf && handleCellClick(rowNode.id, colNode.id, link)}
                            onMouseEnter={() => !isSelf && setHoveredCell({ rowId: rowNode.id, colId: colNode.id })}
                            onMouseLeave={() => setHoveredCell(null)}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: isSelf 
                                ? '#E2E8F0' // Diagonal (Self-relation) grayed out
                                : getCellColor(link, isHovered, isSelected),
                              cursor: (isSelf || !link) ? 'default' : 'pointer',
                              position: 'relative',
                              transition: 'background-color 0.15s'
                            }}
                            title={isSelf ? '' : `${rowNode.name} ↔ ${colNode.name}${link ? ` (${link.label || 'קשר'})` : ' (אין קשר)'}`}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
