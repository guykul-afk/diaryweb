import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

export default function MicroInsightFlow({ diaryData }) {
  const { filteredNodes, filteredLinks } = diaryData || {};

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!filteredNodes || !filteredLinks) return { nodes: [], edges: [] };
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR' });

    const nodes = filteredNodes.map(n => ({
      id: n.id,
      data: { label: n.name || n.id },
      position: { x: 0, y: 0 },
      style: {
        background: '#fff',
        border: '1px solid #777',
        borderRadius: '5px',
        padding: '10px',
      }
    }));

    const edges = filteredLinks.map((e, idx) => ({
      id: `e-${idx}`,
      source: typeof e.source === 'object' ? e.source.id : e.source,
      target: typeof e.target === 'object' ? e.target.id : e.target,
    }));

    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });

    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 75,
          y: nodeWithPosition.y - 25,
        },
      };
    });

    return { nodes: newNodes, edges };
  }, [filteredNodes, filteredLinks]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px' }}>
      <ReactFlow nodes={layoutedNodes} edges={layoutedEdges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
