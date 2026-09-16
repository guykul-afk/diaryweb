import React, { useState, useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Search, Compass, GitCommit, ArrowLeftRight } from 'lucide-react';

const CATEGORY_COLORS = {
  Person: { border: '#3b82f6', bg: '#eff6ff', text: '#1e40af' },
  Emotion: { border: '#ec4899', bg: '#fdf2f8', text: '#9d174d' },
  Domain: { border: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6' },
  Goal: { border: '#10b981', bg: '#ecfdf5', text: '#065f46' },
  Pattern: { border: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  Strategy: { border: '#06b6d4', bg: '#ecfeff', text: '#155e75' },
  Event: { border: '#f97316', bg: '#fff7ed', text: '#9a3412' },
  Insight: { border: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
  Unknown: { border: '#64748b', bg: '#f8fafc', text: '#334155' },
};

const CATEGORY_LABELS_HE = {
  Person: 'אדם',
  Emotion: 'רגש',
  Domain: 'תחום',
  Goal: 'מטרה',
  Pattern: 'דפוס',
  Strategy: 'אסטרטגיה',
  Event: 'אירוע',
  Insight: 'תובנה',
  Unknown: 'אחר'
};

export default function MicroInsightFlow({ diaryData }) {
  const { filteredNodes = [], filteredLinks = [] } = diaryData || {};

  // Sort nodes by degree to find the best default anchor
  const sortedNodes = useMemo(() => {
    const degrees = {};
    filteredLinks.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      degrees[src] = (degrees[src] || 0) + 1;
      degrees[tgt] = (degrees[tgt] || 0) + 1;
    });
    return [...filteredNodes].sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0));
  }, [filteredNodes, filteredLinks]);

  const [selectedCenterId, setSelectedCenterId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [depth, setDepth] = useState(1); // 1-hop or 2-hop

  const centerNodeId = selectedCenterId || (sortedNodes[0]?.id) || null;

  // Extract 1-hop or 2-hop neighborhood around centerNodeId
  const neighborhood = useMemo(() => {
    if (!centerNodeId || !filteredNodes.length) {
      return { nodes: [], edges: [] };
    }

    const neighborIds = new Set([centerNodeId]);
    const hop1Ids = new Set();

    // 1-hop
    filteredLinks.forEach(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      if (src === centerNodeId) {
        neighborIds.add(tgt);
        hop1Ids.add(tgt);
      } else if (tgt === centerNodeId) {
        neighborIds.add(src);
        hop1Ids.add(src);
      }
    });

    // 2-hop if enabled
    if (depth === 2) {
      filteredLinks.forEach(link => {
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        if (hop1Ids.has(src) && neighborIds.size < 40) {
          neighborIds.add(tgt);
        } else if (hop1Ids.has(tgt) && neighborIds.size < 40) {
          neighborIds.add(src);
        }
      });
    }

    const subNodes = filteredNodes.filter(n => neighborIds.has(n.id));
    const subEdges = filteredLinks.filter(link => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      return neighborIds.has(src) && neighborIds.has(tgt);
    });

    return { nodes: subNodes, edges: subEdges };
  }, [centerNodeId, filteredNodes, filteredLinks, depth]);

  // Compute Dagre hierarchical layout for the small neighborhood (instant execution)
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!neighborhood.nodes.length) return { nodes: [], edges: [] };

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });

    const nodes = neighborhood.nodes.map(n => {
      const isCenter = n.id === centerNodeId;
      const type = n.type || 'Unknown';
      const colors = CATEGORY_COLORS[type] || CATEGORY_COLORS.Unknown;
      const label = n.label || n.name || n.id;

      return {
        id: n.id,
        data: {
          label: (
            <div style={{ textAlign: 'center', direction: 'rtl', padding: '4px' }}>
              <div style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: colors.text,
                textTransform: 'uppercase',
                marginBottom: '2px'
              }}>
                {CATEGORY_LABELS_HE[type] || type}
              </div>
              <div style={{
                fontSize: isCenter ? '0.95rem' : '0.85rem',
                fontWeight: isCenter ? 700 : 500,
                color: isCenter ? '#1e293b' : '#334155'
              }}>
                {label}
              </div>
            </div>
          )
        },
        position: { x: 0, y: 0 },
        style: {
          background: isCenter ? '#fef3c7' : colors.bg,
          border: `2px solid ${isCenter ? '#f59e0b' : colors.border}`,
          borderRadius: '10px',
          padding: '8px 12px',
          width: 160,
          boxShadow: isCenter ? '0 4px 14px rgba(245, 158, 11, 0.3)' : '0 2px 6px rgba(0,0,0,0.05)',
          cursor: 'pointer'
        }
      };
    });

    const edges = neighborhood.edges.map((e, idx) => {
      const src = typeof e.source === 'object' ? e.source.id : e.source;
      const tgt = typeof e.target === 'object' ? e.target.id : e.target;
      const rel = e.relation || '';
      return {
        id: `e-${idx}-${src}-${tgt}`,
        source: src,
        target: tgt,
        label: rel,
        labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        labelBgPadding: [2, 4],
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        animated: true,
      };
    });

    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 160, height: 60 });
    });

    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const positionedNodes = nodes.map(node => {
      const pos = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: pos ? pos.x - 80 : 0,
          y: pos ? pos.y - 30 : 0,
        },
      };
    });

    return { nodes: positionedNodes, edges };
  }, [neighborhood, centerNodeId]);

  // Autocomplete candidates for search
  const filteredSearchCandidates = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return sortedNodes
      .filter(n => (n.label || n.name || n.id).toLowerCase().includes(q))
      .slice(0, 8);
  }, [sortedNodes, searchQuery]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      direction: 'rtl'
    }}>
      {/* Top Controls Toolbar */}
      <div style={{
        padding: '12px 18px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass size={18} style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
            מיקוד מחשבה (תבנית סיבתית):
          </span>
          <span style={{
            fontSize: '0.85rem',
            padding: '3px 10px',
            borderRadius: '8px',
            background: '#e0e7ff',
            color: '#3730a3',
            fontWeight: 600
          }}>
            {centerNodeId || 'בחר מושג'}
          </span>
        </div>

        {/* Search / Concept Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="חפש מושג להתמקדות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                fontSize: '0.82rem',
                padding: '6px 32px 6px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                width: '180px'
              }}
            />
            {filteredSearchCandidates.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                width: '220px',
                background: '#ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginTop: '4px',
                zIndex: 50,
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {filteredSearchCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    onClick={() => {
                      setSelectedCenterId(candidate.id);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{candidate.label || candidate.name || candidate.id}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {CATEGORY_LABELS_HE[candidate.type] || candidate.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Depth Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setDepth(1)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: depth === 1 ? '#6366f1' : '#e2e8f0',
                background: depth === 1 ? '#e0e7ff' : '#ffffff',
                color: depth === 1 ? '#3730a3' : '#64748b',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              קפיצה 1
            </button>
            <button
              onClick={() => setDepth(2)}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: depth === 2 ? '#6366f1' : '#e2e8f0',
                background: depth === 2 ? '#e0e7ff' : '#ffffff',
                color: depth === 2 ? '#3730a3' : '#64748b',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              2 קפיצות
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '550px' }}>
        <ReactFlow
          nodes={layoutedNodes}
          edges={layoutedEdges}
          onNodeClick={(_, node) => setSelectedCenterId(node.id)}
          fitView
        >
          <Background color="#f1f5f9" gap={16} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
