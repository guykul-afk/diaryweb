import React, { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Info, HelpCircle, RefreshCw } from 'lucide-react';
import { useDiaryData } from './hooks/useDiaryData';
import { forceCollide } from 'd3-force';

export default function MindMapBuilderView() {
  const {
    rawGraphData,
    filteredNodes,
    filteredLinks,
    limitEntities,
    setLimitEntities,
    loading,
    error,
    uid,
    getNodeType,
    rawNodeDegrees,
    fetchData
  } = useDiaryData();

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [highlightBackbone, setHighlightBackbone] = useState(true);
  const [backboneMinDegree, setBackboneMinDegree] = useState(3);
  
  // View mode states
  const [viewMode, setViewMode] = useState('force'); // 'force' | 'hierarchical' | 'focus'
  const [hierarchyRootId, setHierarchyRootId] = useState('גיא');

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  // Resize handler
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      const handleResize = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [loading]);

  // Adjust force simulation settings
  useEffect(() => {
    if (fgRef.current) {
      if (viewMode === 'force') {
        fgRef.current.d3Force('charge').strength(-200);
        fgRef.current.d3Force('link').distance(130);
        fgRef.current.d3Force('collision', forceCollide(node => getNodeRadius(node) + 15));
      } else {
        fgRef.current.d3Force('charge').strength(-400);
        fgRef.current.d3Force('link').distance(80);
        fgRef.current.d3Force('collision', forceCollide(node => getNodeRadius(node) + 20));
      }
    }
  }, [rawGraphData, viewMode]);

  // Node radius styling based on weight
  const getNodeRadius = (node) => {
    const isGuy = node.id === 'גיא' || node.name === 'גיא' || node.id === 'guy';
    if (isGuy) return 7;
    const weight = node.weight || 1;
    return Math.max(5, weight * 4);
  };

  // Node Color scheme helper
  const getNodeColor = (node, isSelected) => {
    if (isSelected) return '#ff6b6b';
    
    // Check if it's backbone
    const degree = rawNodeDegrees[node.id] || 0;
    const isBackbone = highlightBackbone && (degree >= backboneMinDegree);

    if (isBackbone) {
      return '#2b6cb0'; // Distinct Slate/Navy for backbone anchor points
    }

    const type = getNodeType(node);
    switch (type) {
      case 'Person': return '#48bb78';  // Green
      case 'Topic': return '#9f7aea';   // Purple
      case 'Emotion': return '#ed64a6'; // Pink
      default: return '#cbd5e0';        // Neutral gray/blue (Concept)
    }
  };

  const handleNodeDrag = (node) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleNodeDragEnd = (node) => {
    node.fx = node.x;
    node.fy = node.y;
  };

  const handleNodeDoubleClick = (node) => {
    node.fx = null;
    node.fy = null;
  };

  // Find connections related to selected node
  const activeNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    return rawGraphData.links.filter(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      return s === selectedNode.id || t === selectedNode.id;
    });
  }, [selectedNode, rawGraphData.links]);

  // Generate derived graph data for current view mode
  const graphDataToRender = useMemo(() => {
    if (viewMode === 'force') return { nodes: filteredNodes, links: filteredLinks };
    
    let rootId = hierarchyRootId;
    const rootExists = filteredNodes.some(n => n.id === rootId);
    if (!rootExists) {
      rootId = filteredNodes.length > 0 ? filteredNodes[0].id : null;
    }
    if (!rootId) return { nodes: [], links: [] };

    if (viewMode === 'focus') {
      const connectedNodes = new Set([rootId]);
      const connectedLinks = [];

      filteredLinks.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === rootId) {
          connectedNodes.add(t);
          connectedLinks.push(l);
        } else if (t === rootId) {
          connectedNodes.add(s);
          connectedLinks.push(l);
        }
      });

      return {
        nodes: filteredNodes.filter(n => connectedNodes.has(n.id)).map(n => ({...n})),
        links: connectedLinks
      };
    }

    if (viewMode === 'hierarchical') {
      // Build BFS tree from rootId using filtered nodes/links
      const adj = {};
      filteredNodes.forEach(n => { adj[n.id] = []; });
      filteredLinks.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (adj[s]) adj[s].push(t);
        if (adj[t]) adj[t].push(s);
      });

      const visited = new Set();
      visited.add(rootId);
      const queue = [rootId];
      const treeLinks = [];
      const treeNodes = new Set([rootId]);

      while (queue.length > 0) {
        const curr = queue.shift();
        if (adj[curr]) {
          for (const neighbor of adj[curr]) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              treeNodes.add(neighbor);
              queue.push(neighbor);
              
              const origLink = filteredLinks.find(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                return (s === curr && t === neighbor) || (t === curr && s === neighbor);
              });

              if (origLink) {
                treeLinks.push({
                  ...origLink,
                  source: curr,
                  target: neighbor
                });
              }
            }
          }
        }
      }

      return {
        nodes: filteredNodes.filter(n => treeNodes.has(n.id)).map(n => ({...n})),
        links: treeLinks
      };
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }, [filteredNodes, filteredLinks, viewMode, hierarchyRootId]);

  return (
    <div className="graph-container" style={{ direction: 'rtl' }}>
      {/* Sidebar Editor */}
      <div className="graph-sidebar" style={{ minWidth: '350px', maxWidth: '350px' }}>
        <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            חוקר מפת מוח
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            חקירה ויזואלית וארגון מרחבי של הידע.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div style={{ margin: '14px 0' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            מצב תצוגה
          </h4>
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setViewMode('force')}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: viewMode === 'force' ? 'var(--accent-color)' : 'transparent',
                color: viewMode === 'force' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              מפת מוח חופשית
            </button>
            <button
              onClick={() => setViewMode('hierarchical')}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: viewMode === 'hierarchical' ? 'var(--accent-color)' : 'transparent',
                color: viewMode === 'hierarchical' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              היררכיה (עץ)
            </button>
            <button
              onClick={() => setViewMode('focus')}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: viewMode === 'focus' ? 'var(--accent-color)' : 'transparent',
                color: viewMode === 'focus' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              מיקוד במושג
            </button>
          </div>
          {(viewMode === 'hierarchical' || viewMode === 'focus') && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
              * לחץ על מושג כדי להפוך אותו למרכז התצוגה
            </p>
          )}
        </div>

        {/* Entity Limit Slider */}
        <div style={{ margin: '14px 0', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <span>כמות מושגים מובילים להצגה:</span>
            <strong>{limitEntities}</strong>
          </label>
          <input
            type="range"
            min="5"
            max="150"
            step="5"
            value={limitEntities}
            onChange={(e) => setLimitEntities(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
          />
        </div>



        {/* Node Inspector */}
        {selectedNode && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              מפקח מושג: {selectedNode.name || selectedNode.id}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                סוג: <span className="concept-badge">{getNodeType(selectedNode)}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                נעול במרחב: {selectedNode.fx !== null && selectedNode.fx !== undefined ? 'כן 📌' : 'לא'}
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>קשרים פעילים:</label>
                {activeNodeConnections.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>אין קשרים למושג זה.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                    {activeNodeConnections.map((link, idx) => {
                      const s = typeof link.source === 'object' ? link.source.id : link.source;
                      const t = typeof link.target === 'object' ? link.target.id : link.target;
                      const otherNode = s === selectedNode.id ? t : s;
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontSize: '0.75rem' }}>
                            {s === selectedNode.id ? '← ' : '→ '}
                            <strong>{link.label}</strong> {otherNode}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Link Inspector */}
        {selectedLink && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              מפקח קשר
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.8rem' }}>
                מקור: <strong>{typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source}</strong>
              </div>
              <div style={{ fontSize: '0.8rem' }}>
                קשר: <strong>{selectedLink.label}</strong>
              </div>
              <div style={{ fontSize: '0.8rem' }}>
                יעד: <strong>{typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                סוג קשר: {selectedLink.isManual ? 'קשר ידני' : 'קשר אוטומטי (מבוסס רשומות)'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Graph Area */}
      <div 
        ref={containerRef} 
        className="graph-canvas-wrapper" 
        style={{ height: '100%', position: 'relative' }}
      >
        {loading ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw className="spin" size={32} />
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphDataToRender}
            dagMode={viewMode === 'hierarchical' ? 'td' : null}
            dagLevelDistance={viewMode === 'hierarchical' ? 100 : undefined}

            nodeLabel={node => `${node.name || node.id} [${getNodeType(node)}]`}
            nodeVal={getNodeRadius}
            nodeColor={node => getNodeColor(node, selectedNode?.id === node.id)}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.name || node.id;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px var(--font-sans)`;
              
              const radius = getNodeRadius(node);
              
              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              ctx.fillStyle = getNodeColor(node, selectedNode?.id === node.id);
              ctx.fill();

              // Draw extra ring for backbone anchors
              const degree = rawNodeDegrees[node.id] || 0;
              const isBackbone = highlightBackbone && (degree >= backboneMinDegree);
              if (isBackbone) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#3182ce';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Draw a tiny pin icon/dot if locked/pinned
              if (node.fx !== null && node.fx !== undefined) {
                ctx.beginPath();
                ctx.arc(node.x + radius - 2, node.y - radius + 2, 2, 0, 2 * Math.PI, false);
                ctx.fillStyle = '#ff3b30';
                ctx.fill();
              }

              // Draw Text Label
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#1A1A1A';
              
              // Draw text with white background for readability
              const textY = node.y + radius + (8 / globalScale);
              const textWidth = ctx.measureText(label).width;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.fillRect(node.x - textWidth / 2 - 2, textY - fontSize / 2 - 1, textWidth + 4, fontSize + 2);
              
              ctx.fillStyle = '#1A1A1A';
              ctx.fillText(label, node.x, textY);
            }}
            onNodeClick={node => {
              if (viewMode === 'hierarchical' || viewMode === 'focus') {
                setHierarchyRootId(node.id);
              }
              setSelectedNode(node);
              setSelectedLink(null);
            }}
            onLinkClick={link => {
              setSelectedLink(link);
              setSelectedNode(null);
            }}
            onNodeDrag={viewMode === 'force' ? handleNodeDrag : undefined}
            onNodeDragEnd={viewMode === 'force' ? handleNodeDragEnd : undefined}
            onNodeDoubleClick={viewMode === 'force' ? handleNodeDoubleClick : undefined}
            
            // Custom link visual styling (GRIND: Directional and Relational)
            linkLineDashArray={link => link.isManual ? null : [3, 3]} // Dashed for AI-suggested
            linkWidth={link => (selectedLink === link ? 3 : link.isManual ? 1.8 : 1)}
            linkColor={link => {
              if (selectedLink === link) return '#ff6b6b';
              return link.isManual ? '#4a5568' : '#cbd5e0';
            }}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.95}
          />
        )}
      </div>
    </div>
  );
}
