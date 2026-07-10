import React, { useMemo, useState } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { pack, hierarchy } from 'd3-hierarchy';
import { HelpCircle, Sparkles } from 'lucide-react';

export default function CirclePackingView({ onNavigateToEntry }) {
  const {
    filteredNodes,
    filteredLinks,
    conceptMetadataMap,
    getNodeType,
    loading,
    error
  } = useDiaryData();

  const [focusedNodeId, setFocusedNodeId] = useState('root'); // ID of the currently focused/zoomed circle
  const [hoveredNode, setHoveredNode] = useState(null);

  // SVG dimensions
  const width = 600;
  const height = 600;

  // 1. Calculate average sentiment for each node based on its links
  const nodeSentimentMap = useMemo(() => {
    const sentiments = {};
    filteredNodes.forEach(node => {
      const nodeLinks = filteredLinks.filter(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        return s === node.id || t === node.id;
      });

      if (nodeLinks.length === 0) {
        sentiments[node.id] = 0;
      } else {
        const sum = nodeLinks.reduce((acc, curr) => acc + (curr.sentimentScore || 0), 0);
        sentiments[node.id] = sum / nodeLinks.length;
      }
    });
    return sentiments;
  }, [filteredNodes, filteredLinks]);

  // 2. Build the hierarchical tree data structure
  const hierarchyData = useMemo(() => {
    if (!filteredNodes || filteredNodes.length === 0) return null;

    // Group nodes by category
    const categories = {
      Person: { name: 'שמות ואנשים', id: 'cat-Person', children: [] },
      Topic: { name: 'נושאים ותגיות', id: 'cat-Topic', children: [] },
      Emotion: { name: 'רגשות ומצב רוח', id: 'cat-Emotion', children: [] },
      Concept: { name: 'מושגים נוספים', id: 'cat-Concept', children: [] }
    };

    filteredNodes.forEach(node => {
      const type = getNodeType(node);
      const cat = categories[type] || categories.Concept;
      
      cat.children.push({
        id: node.id,
        name: node.name || node.id,
        weight: node.weight || 1,
        sentiment: nodeSentimentMap[node.id] || 0,
        content: node.content,
        // D3 Pack requires a leaf node to have a 'value' property
        value: Math.max(1, node.weight || 1)
      });
    });

    // Remove empty categories to keep chart clean
    const activeCategories = Object.values(categories).filter(c => c.children.length > 0);

    return {
      name: 'מפה היררכית',
      id: 'root',
      children: activeCategories
    };
  }, [filteredNodes, getNodeType, nodeSentimentMap]);

  // 3. Compute D3 packing layout
  const packLayout = useMemo(() => {
    if (!hierarchyData) return null;

    const rootNode = hierarchy(hierarchyData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);

    const packGenerator = pack()
      .size([width, height])
      .padding(4);

    return packGenerator(rootNode);
  }, [hierarchyData, width, height]);

  // 4. Flatten packed layout into renderable nodes list and find focused coordinate space
  const layoutNodes = useMemo(() => {
    if (!packLayout) return [];
    return packLayout.descendants();
  }, [packLayout]);

  // Get focused circle coordinates to compute view box transform dynamically
  const viewBoxTransform = useMemo(() => {
    if (!packLayout) return `0 0 ${width} ${height}`;

    // Find the currently focused node in layout
    const focused = layoutNodes.find(n => n.data.id === focusedNodeId) || packLayout;
    
    // Zoom boundary calculation: focused circle center (x, y) and radius (r)
    const x = focused.x;
    const y = focused.y;
    const r = focused.r;

    // Viewbox boundary around focused circle with slight padding
    const zoomPad = 5;
    const minX = x - r - zoomPad;
    const minY = y - r - zoomPad;
    const diameter = (r + zoomPad) * 2;

    return `${minX} ${minY} ${diameter} ${diameter}`;
  }, [packLayout, layoutNodes, focusedNodeId, width, height]);

  // Get parent ID of the current focused node to allow back navigation
  const parentNodeId = useMemo(() => {
    if (focusedNodeId === 'root') return null;
    const current = layoutNodes.find(n => n.data.id === focusedNodeId);
    return current?.parent ? current.parent.data.id : 'root';
  }, [focusedNodeId, layoutNodes]);

  // Sentiment Color Helper for Circles
  const getCircleColor = (node) => {
    if (node.depth === 0) return 'var(--panel-bg)'; // Root outer circle
    if (node.depth === 1) return 'rgba(0, 53, 95, 0.03)'; // Category group circle
    
    // Leaf node: color by sentiment score
    const sentiment = node.data.sentiment || 0;
    if (sentiment > 0.1) return 'rgba(72, 187, 120, 0.2)'; // Supportive green
    if (sentiment < -0.1) return 'rgba(229, 62, 62, 0.2)'; // Stressful red
    return 'rgba(49, 130, 206, 0.15)'; // Neutral blue
  };

  const getCircleStroke = (node) => {
    if (node.depth === 0) return 'transparent';
    if (node.depth === 1) return 'rgba(0, 53, 95, 0.15)';
    
    const sentiment = node.data.sentiment || 0;
    if (sentiment > 0.1) return '#48bb78';
    if (sentiment < -0.1) return '#e53e3e';
    return '#3182ce';
  };

  // Safe selected node details to render in sidebar
  const selectedNodeDetails = useMemo(() => {
    if (!hoveredNode) return null;
    if (hoveredNode.depth <= 1) return null; // Only show details for actual leaf nodes
    
    const nodeId = hoveredNode.data.id;
    const meta = conceptMetadataMap[nodeId.toLowerCase()] || { entries: [] };
    
    return {
      name: hoveredNode.data.name,
      weight: hoveredNode.data.weight,
      sentiment: hoveredNode.data.sentiment,
      content: hoveredNode.data.content,
      associatedEntries: meta.entries || []
    };
  }, [hoveredNode, conceptMetadataMap]);

  return (
    <div className="graph-container" style={{ direction: 'rtl' }}>
      
      {/* Sidebar: Inspector for hovered entity */}
      <div className="graph-sidebar">
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>אריזת עיגולים</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            הידע מוצג כטריטוריות היררכיות.
            לחץ על קטגוריה או מושג כדי לבצע **Zoom In** ולהעמיק פנימה.
          </p>
          {parentNodeId && (
            <button
              onClick={() => setFocusedNodeId(parentNodeId)}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid var(--border-color)',
                background: 'var(--accent-light)',
                color: 'var(--accent-color)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              ← חזור רמה אחת למעלה
            </button>
          )}
        </div>

        {selectedNodeDetails ? (
          <div className="concept-details" style={{ marginTop: '12px' }}>
            <div className="concept-header">
              <h3 className="concept-title">{selectedNodeDetails.name}</h3>
              <div style={{ fontSize: '0.75rem', display: 'flex', gap: '4px', marginTop: '2px' }}>
                <span style={{ color: selectedNodeDetails.sentiment > 0.1 ? '#48bb78' : selectedNodeDetails.sentiment < -0.1 ? '#e53e3e' : 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedNodeDetails.sentiment > 0.1 ? 'חיובי' : selectedNodeDetails.sentiment < -0.1 ? 'מלחיץ' : 'ניטרלי'}
                </span>
                <span>• חשיבות: {selectedNodeDetails.weight}</span>
              </div>
            </div>
            
            <div className="concept-body" style={{ maxHeight: '140px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              {selectedNodeDetails.content ? selectedNodeDetails.content : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>אין פירוט נוסף</span>}
            </div>

            {selectedNodeDetails.associatedEntries && selectedNodeDetails.associatedEntries.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>רשומות קשורות:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {selectedNodeDetails.associatedEntries.map((e, i) => (
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
                      <span style={{ textDecoration: 'underline' }}>רשומה מ-{e.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={24} style={{ color: 'var(--text-muted)' }} />
            <span>רחף עם העכבר מעל עיגולים של מושגים כדי לראות את פרטיהם כאן.</span>
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div style={{ flexGrow: 1, padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        {loading && <div style={{ color: 'var(--text-muted)' }}>בונה פריסת עיגולים...</div>}
        {error && <div style={{ color: '#e53e3e' }}>שגיאה בחישוב: {error}</div>}
        
        {!loading && !error && !hierarchyData && (
          <div style={{ color: 'var(--text-muted)' }}>אין מספיק נתונים להצגת פריסת אריזה.</div>
        )}

        {!loading && !error && hierarchyData && packLayout && (
          <svg 
            viewBox={viewBoxTransform}
            style={{ 
              width: '100%', 
              height: '100%', 
              maxHeight: '520px',
              maxWidth: '520px',
              background: 'var(--panel-bg)',
              borderRadius: '50%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
              transition: 'viewBox 0.6s cubic-bezier(0.25, 1, 0.5, 1)' // Beautiful smooth zoom animation!
            }}
          >
            {layoutNodes.map((node) => {
              const isFocused = node.data.id === focusedNodeId;
              const hasChildren = node.children && node.children.length > 0;
              
              // Only draw root boundary and nested actual entities
              if (node.depth === 0 && focusedNodeId === 'root') {
                return (
                  <circle
                    key={node.data.id}
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill="var(--bg-primary)"
                    stroke="var(--border-color)"
                    strokeWidth={1}
                  />
                );
              }

              return (
                <g key={node.data.id}>
                  {/* Circle Element */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill={getCircleColor(node)}
                    stroke={getCircleStroke(node)}
                    strokeWidth={node.depth === 1 ? 1.5 : 1}
                    style={{ 
                      cursor: 'pointer',
                      transition: 'fill-opacity 0.2s, stroke-width 0.2s'
                    }}
                    onMouseEnter={() => node.depth > 1 && setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Only allow zooming into categories or nodes that have nested structure,
                      // or navigate to focused node
                      if (hasChildren) {
                        setFocusedNodeId(node.data.id);
                      } else {
                        // If leaf node clicked, focus it to see details, or double click to expand?
                        // For leaf nodes we just hover, clicking can navigate parent
                      }
                    }}
                  />

                  {/* Text Label inside circle (conditionally rendered for legibility) */}
                  {node.r > 20 && (
                    <text
                      x={node.x}
                      y={node.depth === 1 ? node.y - node.r + 14 : node.y}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize={node.depth === 1 ? '10' : '8'}
                      fontWeight={node.depth === 1 ? 'bold' : 'normal'}
                      fill="var(--text-primary)"
                      fontFamily="var(--font-sans)"
                      style={{ 
                        pointerEvents: 'none', 
                        opacity: hoveredNode && hoveredNode.data.id !== node.data.id && node.depth > 1 ? 0.35 : 1
                      }}
                    >
                      {node.data.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

    </div>
  );
}
