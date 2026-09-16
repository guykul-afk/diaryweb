import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import { Search, Filter, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const CATEGORY_COLORS = {
  Person: { fill: '#3b82f6', stroke: '#1d4ed8', bg: 'rgba(59, 130, 246, 0.1)' },
  Emotion: { fill: '#ec4899', stroke: '#be185d', bg: 'rgba(236, 72, 153, 0.1)' },
  Domain: { fill: '#8b5cf6', stroke: '#6d28d9', bg: 'rgba(139, 92, 246, 0.1)' },
  Goal: { fill: '#10b981', stroke: '#047857', bg: 'rgba(16, 185, 129, 0.1)' },
  Pattern: { fill: '#f59e0b', stroke: '#b45309', bg: 'rgba(245, 158, 11, 0.1)' },
  Strategy: { fill: '#06b6d4', stroke: '#0e7490', bg: 'rgba(6, 182, 212, 0.1)' },
  Event: { fill: '#f97316', stroke: '#c2410c', bg: 'rgba(249, 115, 22, 0.1)' },
  Insight: { fill: '#6366f1', stroke: '#4338ca', bg: 'rgba(99, 102, 241, 0.1)' },
  Unknown: { fill: '#64748b', stroke: '#334155', bg: 'rgba(100, 116, 139, 0.1)' },
};

const CATEGORY_LABELS_HE = {
  Person: 'אנשים',
  Emotion: 'רגשות',
  Domain: 'תחומי חיים',
  Goal: 'מטרות ויעדים',
  Pattern: 'דפוסים',
  Strategy: 'אסטרטגיות',
  Event: 'אירועים',
  Insight: 'תובנות',
  Unknown: 'אחר'
};

export default function MacroKnowledgeGraph({ diaryData }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const { filteredNodes = [], filteredLinks = [] } = diaryData || {};

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [maxNodes, setMaxNodes] = useState(80);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);

  // 1. Calculate node degrees to prioritize the most important nodes
  const nodeDegrees = useMemo(() => {
    const degrees = {};
    filteredLinks.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      degrees[src] = (degrees[src] || 0) + 1;
      degrees[tgt] = (degrees[tgt] || 0) + 1;
    });
    return degrees;
  }, [filteredLinks]);

  // 2. Filter nodes smartly for Macro View (avoiding browser crash)
  const displayData = useMemo(() => {
    if (!filteredNodes || filteredNodes.length === 0) {
      return { nodes: [], edges: [], combos: [] };
    }

    // Sort all nodes by degree (connectivity) descending
    let candidateNodes = [...filteredNodes].sort((a, b) => {
      const degA = (nodeDegrees[a.id] || 0) + (a.val || 1);
      const degB = (nodeDegrees[b.id] || 0) + (b.val || 1);
      return degB - degA;
    });

    // Apply category filter
    if (selectedCategory !== 'ALL') {
      candidateNodes = candidateNodes.filter(n => (n.type || 'Unknown') === selectedCategory);
    }

    // Apply search filter if typed
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      candidateNodes = candidateNodes.filter(n => 
        (n.label || n.name || n.id).toLowerCase().includes(q)
      );
    }

    // Cap at maxNodes to keep G6 layout super fast and crisp
    const topNodes = candidateNodes.slice(0, maxNodes);
    const topNodeIds = new Set(topNodes.map(n => n.id));

    // Filter relevant edges between the selected top nodes
    const topEdges = filteredLinks
      .filter(link => {
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        return topNodeIds.has(src) && topNodeIds.has(tgt);
      })
      .slice(0, maxNodes * 3); // cap edges to avoid edge mesh

    // Extract unique active types for combos
    const activeTypes = new Set();
    topNodes.forEach(n => activeTypes.add(n.type || 'Unknown'));

    const combos = Array.from(activeTypes).map(type => {
      const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.Unknown;
      const label = CATEGORY_LABELS_HE[type] || type;
      return {
        id: `combo-${type}`,
        data: { label },
        style: {
          labelText: label,
          labelFill: colors.stroke,
          labelFontSize: 13,
          labelFontWeight: 'bold',
          fill: colors.bg,
          stroke: colors.stroke,
          lineWidth: 1.5,
          lineDash: [4, 4],
          padding: 18,
        }
      };
    });

    const nodes = topNodes.map(n => {
      const type = n.type || 'Unknown';
      const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.Unknown;
      const deg = nodeDegrees[n.id] || 1;
      const nodeSize = Math.min(36, Math.max(18, 16 + Math.log2(deg + 1) * 4));
      const label = n.label || n.name || n.id;

      return {
        id: n.id,
        combo: `combo-${type}`,
        data: {
          label,
          type,
          degree: deg,
          description: n.description || n.essence || ''
        },
        style: {
          size: nodeSize,
          fill: colors.fill,
          stroke: '#ffffff',
          lineWidth: 2,
          labelText: label.length > 12 ? `${label.substring(0, 11)}..` : label,
          labelFill: '#0f172a',
          labelFontSize: 11,
          labelFontWeight: 500,
          labelPlacement: 'bottom',
          labelBackground: true,
          labelBackgroundFill: 'rgba(255, 255, 255, 0.85)',
          labelBackgroundRadius: 3,
          labelBackgroundPadding: [1, 4],
        }
      };
    });

    const edges = topEdges.map((e, idx) => {
      const src = typeof e.source === 'object' ? e.source.id : e.source;
      const tgt = typeof e.target === 'object' ? e.target.id : e.target;
      const relation = e.relation || '';

      return {
        id: `edge-${idx}-${src}-${tgt}`,
        source: src,
        target: tgt,
        data: { relation },
        style: {
          stroke: '#cbd5e1',
          lineWidth: 1.2,
          endArrow: true,
          labelText: relation || '',
          labelFill: '#64748b',
          labelFontSize: 9,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
        }
      };
    });

    return { nodes, edges, combos };
  }, [filteredNodes, filteredLinks, nodeDegrees, selectedCategory, maxNodes, searchQuery]);

  // 3. Mount and update AntV G6 Graph
  useEffect(() => {
    if (!containerRef.current) return;
    if (displayData.nodes.length === 0) {
      if (graphRef.current) {
        graphRef.current.clear();
      }
      return;
    }

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 650;

    if (!graphRef.current) {
      const graph = new Graph({
        container: containerRef.current,
        width,
        height,
        autoFit: 'view',
        data: displayData,
        layout: {
          type: 'comboCombined',
          nodeSpacing: 18,
          comboSpacing: 35,
          preventOverlap: true,
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'collapse-expand-combo'],
        animation: true,
      });

      graph.on('node:click', (evt) => {
        const { target } = evt;
        if (target && target.id) {
          const found = displayData.nodes.find(n => n.id === target.id);
          if (found) {
            setSelectedNodeInfo(found);
          }
        }
      });

      graph.on('canvas:click', () => {
        setSelectedNodeInfo(null);
      });

      graph.render();
      graphRef.current = graph;
    } else {
      graphRef.current.setData(displayData);
      graphRef.current.render();
    }

    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [displayData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#f8fafc',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      direction: 'rtl'
    }}>
      {/* Top Toolbar */}
      <div style={{
        padding: '12px 18px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginLeft: '4px' }}>
            <Filter size={14} style={{ display: 'inline', verticalAlign: '-2px', marginLeft: '4px' }} />
            סינון:
          </span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            style={{
              fontSize: '0.78rem',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: selectedCategory === 'ALL' ? '#0f172a' : '#e2e8f0',
              background: selectedCategory === 'ALL' ? '#0f172a' : '#ffffff',
              color: selectedCategory === 'ALL' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s'
            }}
          >
            הכל ({filteredNodes.length})
          </button>
          {Object.entries(CATEGORY_LABELS_HE).map(([cat, label]) => {
            if (cat === 'Unknown') return null;
            const isSelected = selectedCategory === cat;
            const colors = CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isSelected ? colors.stroke : '#e2e8f0',
                  background: isSelected ? colors.fill : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right Tools: Search & LOD Slider */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', right: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="חיפוש צומת..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                fontSize: '0.8rem',
                padding: '5px 30px 5px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                width: '140px'
              }}
            />
          </div>

          {/* LOD Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>צמתים:</span>
            <select
              value={maxNodes}
              onChange={(e) => setMaxNodes(Number(e.target.value))}
              style={{
                fontSize: '0.78rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155'
              }}
            >
              <option value={40}>40 צמתים (מהיר)</option>
              <option value={80}>80 צמתים (מאוזן)</option>
              <option value={150}>150 צמתים (מפורט)</option>
              <option value={250}>250 צמתים (עמוק)</option>
            </select>
          </div>

          <button
            onClick={() => graphRef.current?.fitView()}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="מרכז תצוגה"
          >
            <RotateCcw size={12} />
            איפוס מבט
          </button>
        </div>
      </div>

      {/* Graph View Canvas Area */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Selected Node Details Card */}
        {selectedNodeInfo && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            padding: '14px 18px',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0',
            maxWidth: '280px',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: (CATEGORY_COLORS[selectedNodeInfo.data.type] || CATEGORY_COLORS.Unknown).bg,
                color: (CATEGORY_COLORS[selectedNodeInfo.data.type] || CATEGORY_COLORS.Unknown).stroke,
                fontWeight: 600
              }}>
                {CATEGORY_LABELS_HE[selectedNodeInfo.data.type] || selectedNodeInfo.data.type}
              </span>
              <button
                onClick={() => setSelectedNodeInfo(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: '4px' }}>
              {selectedNodeInfo.data.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              קשרים בגרף: {selectedNodeInfo.data.degree}
            </div>
            {selectedNodeInfo.data.description && (
              <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                {selectedNodeInfo.data.description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
