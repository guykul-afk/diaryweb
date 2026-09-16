import React, { useEffect, useRef } from 'react';
import { Graph } from '@antv/g6';

export default function MacroKnowledgeGraph({ diaryData }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const { filteredNodes, filteredLinks } = diaryData || {};

  useEffect(() => {
    if (!containerRef.current) return;
    if (!filteredNodes || !filteredLinks) return;
    
    const types = new Set();
    filteredNodes.forEach(n => types.add(n.type || 'Unknown'));
    
    const combos = Array.from(types).map(type => ({
      id: `combo-${type}`,
      data: {
        type: 'combo',
        label: type,
      },
      style: {
        labelText: type,
        fill: '#f8fafc',
        stroke: '#cbd5e1',
        lineWidth: 2,
        padding: 20
      }
    }));
    
    const nodes = filteredNodes.map(n => ({
      id: n.id,
      combo: `combo-${n.type || 'Unknown'}`,
      data: {
        label: n.name || n.id,
        type: n.type
      },
      style: {
        labelText: n.name || n.id,
        fill: '#6366f1',
        stroke: '#4f46e5',
        lineWidth: 1
      }
    }));

    const edges = filteredLinks.map((e, idx) => ({
      id: `edge-${idx}`,
      source: typeof e.source === 'object' ? e.source.id : e.source,
      target: typeof e.target === 'object' ? e.target.id : e.target,
    }));

    const data = { nodes, edges, combos };

    if (!graphRef.current) {
      graphRef.current = new Graph({
        container: containerRef.current,
        autoFit: 'view',
        data,
        node: {
          style: {
            size: 24,
            labelPlacement: 'bottom',
            labelDistance: 5,
          },
        },
        combo: {
          type: 'circle',
          style: {
            labelPlacement: 'top',
          }
        },
        layout: {
          type: 'comboCombined', // AntV G6 v5 uses comboCombined
          preventOverlap: true,
          nodeSpacing: 20,
          comboSpacing: 40,
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'collapse-expand-combo'],
      });
      graphRef.current.render();
    } else {
      graphRef.current.setData(data);
      graphRef.current.render();
    }

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [filteredNodes, filteredLinks]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', background: '#ffffff', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
