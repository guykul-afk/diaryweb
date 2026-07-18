import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useDiaryData } from '../hooks/useDiaryData';

export default function WikiLocalGraph({ activeNodeId, onNodeClick }) {
  const { filteredNodes, filteredLinks, getNodeType } = useDiaryData();
  const fgRef = useRef();

  // Calculate local graph data (degree 1)
  const graphData = useMemo(() => {
    if (!activeNodeId || !filteredNodes.length) return { nodes: [], links: [] };

    const nodesMap = new Map();
    const links = [];
    const neighborIds = new Set();
    
    neighborIds.add(activeNodeId);

    filteredLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === activeNodeId || targetId === activeNodeId) {
        neighborIds.add(sourceId);
        neighborIds.add(targetId);
        links.push(link);
      }
    });

    filteredNodes.forEach(node => {
      if (neighborIds.has(node.id)) {
        nodesMap.set(node.id, { ...node });
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: links.map(l => ({ ...l }))
    };
  }, [activeNodeId, filteredNodes, filteredLinks]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-150);
      fgRef.current.d3Force('link').distance(40);
      
      // Auto fit graph to view
      setTimeout(() => {
        if(fgRef.current) {
           fgRef.current.zoomToFit(400, 20);
        }
      }, 500);
    }
  }, [graphData]);

  const getNodeColor = useCallback((node) => {
    if (node.id === activeNodeId) return '#ecc94b'; // Yellow for center
    const type = getNodeType(node);
    switch (type) {
      case 'Person': return '#48bb78';
      case 'Topic': return '#9f7aea';
      case 'Emotion': return '#ed64a6';
      default: return '#3182ce';
    }
  }, [activeNodeId, getNodeType]);

  const getNodeVal = useCallback((node) => {
    return node.id === activeNodeId ? 10 : 5;
  }, [activeNodeId]);

  if (!graphData.nodes.length) return null;

  return (
    <div style={{ 
      width: '100%', 
      height: '240px', 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: 'var(--radius-md)', 
      overflow: 'hidden', 
      background: 'rgba(0,0,0,0.2)',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
        סביבה מקומית
      </div>
      <ForceGraph2D
        ref={fgRef}
        width={300}
        height={240}
        graphData={graphData}
        nodeLabel={node => node.name || node.id}
        nodeColor={getNodeColor}
        nodeVal={getNodeVal}
        linkColor={() => 'rgba(255,255,255,0.15)'}
        onNodeClick={(node) => onNodeClick && onNodeClick(node.id)}
        enableNodeDrag={true}
        enableZoomPanInteraction={true}
        cooldownTicks={100}
        backgroundColor="transparent"
      />
    </div>
  );
}
