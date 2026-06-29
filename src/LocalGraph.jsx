import React, { useMemo } from 'react';

const NODE_COLORS = {
  Person: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },   // Indigo
  Emotion: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },  // Pink
  Topic: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },    // Sky
  Concept: { bg: '#f4f4f5', border: '#71717a', text: '#27272a' },  // Zinc
};

export default function LocalGraph({ entry, graphData, entries }) {
  const localData = useMemo(() => {
    if (!entry || !graphData || !graphData.nodes) {
      return { nodes: [], links: [] };
    }

    const entryText = (entry.content || '').toLowerCase();
    const entryTopics = entry.frontmatter.topics || [];
    const entryMood = entry.frontmatter.mood || '';

    // Helper to detect type
    const getNodeType = (node) => {
      const type = (node.type || '').toLowerCase();
      if (type === 'person' || type === 'people' || type === 'name') return 'Person';
      if (type === 'emotion' || type === 'mood' || type === 'feeling') return 'Emotion';
      if (type === 'topic' || type === 'hashtag') return 'Topic';

      const nodeIdLower = node.id.toLowerCase();
      const HEBREW_PERSON_NAMES = ['גיא', 'טלי', 'איתן', 'יוגב', 'שמואל', 'נוה', 'אבא', 'אימא', 'ילדים', 'הילדים', 'בן של'];
      const HEBREW_EMOTION_KEYWORDS = ['לחץ', 'חרדה', 'עצב', 'כעס', 'שמחה', 'פחד', 'דאגה', 'אהבה', 'תסכול', 'עומס', 'מתח', 'רגש'];

      if (HEBREW_PERSON_NAMES.some(name => nodeIdLower.includes(name))) return 'Person';
      if (HEBREW_EMOTION_KEYWORDS.some(keyword => nodeIdLower.includes(keyword))) return 'Emotion';
      if (entryTopics.some(t => t.toLowerCase() === nodeIdLower || nodeIdLower.includes(t.toLowerCase()))) return 'Topic';
      if (entryMood && entryMood.toLowerCase().includes(nodeIdLower)) return 'Emotion';
      if (node.id.startsWith('#')) return 'Topic';

      return 'Concept';
    };

    // Find nodes mentioned in this entry
    const mentionedNodes = graphData.nodes.filter(node => {
      const nodeIdLower = node.id.toLowerCase();
      const nodeNameLower = (node.name || node.id).toLowerCase();
      return entryText.includes(nodeIdLower) || entryText.includes(nodeNameLower);
    });

    const nodes = [
      { id: 'CENTER_ENTRY', name: 'הרשומה הנוכחית', type: 'Center', isCenter: true },
      ...mentionedNodes.map(node => ({
        id: node.id,
        name: node.name || node.id,
        type: getNodeType(node)
      }))
    ];

    const links = [];
    // Link everything to the center
    mentionedNodes.forEach(node => {
      links.push({ source: 'CENTER_ENTRY', target: node.id });
    });

    // Link between mentioned nodes if they are linked in the raw graph
    const mentionedNodeIds = new Set(mentionedNodes.map(n => n.id));
    if (graphData.links) {
      graphData.links.forEach(link => {
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        if (mentionedNodeIds.has(src) && mentionedNodeIds.has(tgt)) {
          links.push({ source: src, target: tgt });
        }
      });
    }

    return { nodes, links };
  }, [entry, graphData]);

  const width = 450;
  const height = 280;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 100;

  // Calculate radial positions for outer nodes
  const nodesWithPositions = useMemo(() => {
    const list = localData.nodes;
    if (list.length === 0) return [];
    
    const center = list.find(n => n.isCenter);
    const outers = list.filter(n => !n.isCenter);
    
    const result = [];
    if (center) {
      result.push({ ...center, x: centerX, y: centerY });
    }

    outers.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / outers.length;
      result.push({
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    return result;
  }, [localData.nodes, centerX, centerY, radius]);

  const nodeMap = useMemo(() => {
    const map = {};
    nodesWithPositions.forEach(n => {
      map[n.id] = n;
    });
    return map;
  }, [nodesWithPositions]);

  if (nodesWithPositions.length <= 1) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        אין קשרים/מושגים מזוהים ברשומה זו.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
        מפת קשרים מקומית של הרשומה
      </div>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* Draw Links */}
        {localData.links.map((link, i) => {
          const srcNode = nodeMap[link.source];
          const tgtNode = nodeMap[link.target];
          if (!srcNode || !tgtNode) return null;
          return (
            <line
              key={i}
              x1={srcNode.x}
              y1={srcNode.y}
              x2={tgtNode.x}
              y2={tgtNode.y}
              stroke="#e4e4e7"
              strokeWidth={link.source === 'CENTER_ENTRY' || link.target === 'CENTER_ENTRY' ? 1.5 : 1}
              strokeDasharray={link.source === 'CENTER_ENTRY' || link.target === 'CENTER_ENTRY' ? 'none' : '3,3'}
            />
          );
        })}

        {/* Draw Nodes */}
        {nodesWithPositions.map((node) => {
          const colors = node.isCenter 
            ? { bg: '#18181b', border: '#09090b', text: '#ffffff' }
            : (NODE_COLORS[node.type] || NODE_COLORS.Concept);

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={node.isCenter ? 12 : 8}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={1.5}
              />
              <text
                y={node.isCenter ? -18 : 16}
                textAnchor="middle"
                fontSize={node.isCenter ? '10px' : '9px'}
                fontWeight={node.isCenter ? 700 : 500}
                fill={node.isCenter ? '#09090b' : colors.text}
                style={{ direction: 'rtl', fontFamily: 'var(--font-sans)' }}
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
