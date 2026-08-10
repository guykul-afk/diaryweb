import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { 
  Search, 
  Play, 
  Pause, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Filter, 
  Layers, 
  Calendar,
  X,
  ArrowRight,
  Info,
  Brain,
  Zap,
  Activity,
  Heart,
  HelpCircle
} from 'lucide-react';
import { forceCollide } from 'd3-force';
import { useDiaryData } from './hooks/useDiaryData';
import { 
  enrichGraphData, 
  CATEGORY_COLORS, 
  RELATIONSHIP_COLORS, 
  RELATIONSHIP_LABELS 
} from './utils/semanticGraphEnricher';

/**
 * Computes 2D Convex Hull of an array of points {x, y} using Andrew's Monotone Chain algorithm.
 */
function getConvexHull(points) {
  if (points.length < 3) return points;
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export default function DeepKnowledgeView({ onNavigateToEntry }) {
  const { rawGraphData, loading, error, entries } = useDiaryData();

  const fgRef = useRef();

  // Enriched Graph Data
  const enrichedData = useMemo(() => {
    return enrichGraphData(rawGraphData);
  }, [rawGraphData]);

  // Controls & Filters State
  const [dataScope, setDataScope] = useState('personal'); // 'personal' (default) | 'combined' | 'theoretical'
  const [searchQuery, setSearchQuery] = useState('');
  const [showClusters, setShowClusters] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  // Enabled Categories for Filtering
  const [enabledCategories, setEnabledCategories] = useState(() => {
    return new Set(Object.keys(CATEGORY_COLORS));
  });

  // Timeline Slider State
  const allChronologicalDates = useMemo(() => {
    const datesSet = new Set();
    enrichedData.nodes.forEach(n => {
      if (n.date) datesSet.add(n.date);
    });
    entries.forEach(e => {
      if (e.date) datesSet.add(e.date);
      if (e.frontmatter?.date) datesSet.add(e.frontmatter.date);
    });
    return Array.from(datesSet).sort();
  }, [enrichedData, entries]);

  const [timelineIndex, setTimelineIndex] = useState(allChronologicalDates.length - 1);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Update timeline index when dates arrive
  useEffect(() => {
    if (allChronologicalDates.length > 0 && timelineIndex === 0) {
      setTimelineIndex(allChronologicalDates.length - 1);
    }
  }, [allChronologicalDates]);

  // Timeline Playback Animation Timer
  useEffect(() => {
    let interval = null;
    if (isPlayingTimeline && allChronologicalDates.length > 0) {
      interval = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= allChronologicalDates.length - 1) {
            setIsPlayingTimeline(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200 / playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayingTimeline, allChronologicalDates, playbackSpeed]);

  const currentTimelineDate = allChronologicalDates[timelineIndex] || null;

  // Filter Nodes & Links by Scope, Timeline and Category
  const activeGraphData = useMemo(() => {
    if (!enrichedData.nodes) return { nodes: [], links: [] };

    // 0. Filter by Data Scope (Personal Knowledge & Insights vs TKF)
    let visibleNodes = enrichedData.nodes;
    if (dataScope === 'personal') {
      visibleNodes = visibleNodes.filter(node => !node.isTheoretical);
    } else if (dataScope === 'theoretical') {
      visibleNodes = visibleNodes.filter(node => node.isTheoretical);
    }

    // 1. Filter by Enabled Categories
    visibleNodes = visibleNodes.filter(node => 
      enabledCategories.has(node.parent_category)
    );

    // 2. Filter by Timeline Date
    if (currentTimelineDate && timelineIndex < allChronologicalDates.length - 1) {
      visibleNodes = visibleNodes.filter(node => {
        if (!node.date) return true; // Nodes without dates remain visible
        return node.date <= currentTimelineDate;
      });
    }

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // 3. Filter Links whose source & target are visible
    const visibleLinks = enrichedData.links.filter(link => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      return visibleNodeIds.has(sId) && visibleNodeIds.has(tId);
    });

    return {
      nodes: visibleNodes,
      links: visibleLinks
    };
  }, [enrichedData, dataScope, enabledCategories, currentTimelineDate, timelineIndex, allChronologicalDates]);

  // Semantic Query Search & Path Highlight Calculation
  const { matchingNodeIds, connectedEdgeIds } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { matchingNodeIds: null, connectedEdgeIds: null };
    }

    const q = searchQuery.toLowerCase().trim();
    const matched = new Set();
    const connectedEdges = new Set();

    activeGraphData.nodes.forEach(node => {
      const name = (node.name || node.label || node.id || '').toLowerCase();
      const content = (node.content || '').toLowerCase();
      const type = (node.type || '').toLowerCase();
      const category = (node.parent_category || '').toLowerCase();

      if (name.includes(q) || content.includes(q) || type.includes(q) || category.includes(q)) {
        matched.add(node.id);
      }
    });

    // 1-hop path traversal: add direct neighbors of matched nodes
    activeGraphData.links.forEach(link => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      const edgeId = link.id || `${sId}-${tId}`;

      if (matched.has(sId) || matched.has(tId)) {
        matched.add(sId);
        matched.add(tId);
        connectedEdges.add(edgeId);
      }
    });

    return { matchingNodeIds: matched, connectedEdgeIds: connectedEdges };
  }, [searchQuery, activeGraphData]);

  // Configure D3 Force Simulation for Insight Attraction & Collisions
  useEffect(() => {
    if (!fgRef.current) return;

    fgRef.current.d3Force('charge')?.strength(node => {
      return node.isInsight ? -420 : -130;
    });

    fgRef.current.d3Force('collide', forceCollide(node => {
      return node.isInsight ? 38 : 16;
    }));

    fgRef.current.d3Force('link')?.distance(link => {
      if (link.relationshipType === 'MITIGATES') return 75;
      if (link.relationshipType === 'CAUSES') return 90;
      return 110;
    });
  }, [activeGraphData]);

  // Category Toggle Handler
  const toggleCategory = useCallback((catName) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(catName)) {
        if (next.size > 1) next.delete(catName); // Keep at least one category
      } else {
        next.add(catName);
      }
      return next;
    });
  }, []);

  // Pre-Render Frame: Canvas Convex Hulls / Semantic Cluster Backgrounds
  const handleRenderFramePre = useCallback((ctx, globalScale) => {
    if (!showClusters || !activeGraphData.nodes.length) return;

    // Group active visible nodes by parent category
    const categoryGroups = {};
    activeGraphData.nodes.forEach(node => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
      const cat = node.parent_category || 'כללי ומושגים';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push({ x: node.x, y: node.y });
    });

    // Render convex hull / cluster bubble for each category
    Object.entries(categoryGroups).forEach(([catName, points]) => {
      if (points.length === 0) return;
      const colorInfo = CATEGORY_COLORS[catName] || CATEGORY_COLORS['כללי ומושגים'];

      ctx.save();
      ctx.beginPath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(28, 48 / Math.sqrt(globalScale));
      ctx.fillStyle = colorInfo.bg;
      ctx.strokeStyle = colorInfo.border;

      if (points.length >= 3) {
        const hull = getConvexHull(points);
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) {
          ctx.lineTo(hull[i].x, hull[i].y);
        }
        ctx.closePath();
      } else if (points.length === 2) {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
      } else if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, 22, 0, 2 * Math.PI);
      }

      ctx.fill();
      ctx.stroke();

      // Cluster Label Centroid
      if (points.length >= 2 && globalScale > 0.4) {
        const cx = points.reduce((acc, p) => acc + p.x, 0) / points.length;
        const cy = points.reduce((acc, p) => acc + p.y, 0) / points.length;
        
        ctx.font = `600 ${Math.max(10, 13 / Math.sqrt(globalScale))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colorInfo.main;
        ctx.fillText(colorInfo.label, cx, cy - 26 / Math.sqrt(globalScale));
      }

      ctx.restore();
    });
  }, [showClusters, activeGraphData]);

  // Custom Canvas Rendering for Nodes (Insight Sun Nodes & Standard Nodes)
  const handleNodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

    const isDimmed = matchingNodeIds && !matchingNodeIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

    // INSIGHT NODES: Glowing Sun-like rendering
    if (node.isInsight) {
      const radius = isHovered || isSelected ? 22 : 18;

      // Outer Sun Glow
      const glowGrad = ctx.createRadialGradient(node.x, node.y, 4, node.x, node.y, radius * 2.6);
      glowGrad.addColorStop(0, 'rgba(255, 230, 110, 0.95)');
      glowGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.60)');
      glowGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.20)');
      glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 2.6, 0, 2 * Math.PI);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Core Sun Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner Star Symbol
      ctx.font = `bold ${radius * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#78350f';
      ctx.fillText('★', node.x, node.y + 1);

    } else {
      // STANDARD NODES
      const radius = isHovered || isSelected ? 11 : (node.val || 7);
      const color = node.color || '#38bdf8';

      // Highlight Ring if selected or hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Node Label Drawing
    const label = node.name || node.label || node.id;
    const fontSize = Math.max(10, 12 / Math.sqrt(globalScale));
    ctx.font = `${node.isInsight ? '700' : '500'} ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textY = node.x && node.y ? node.y + (node.isInsight ? 24 : 10) : 0;

    // Text Outline for Contrast
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, node.x, textY);

    ctx.fillStyle = node.isInsight ? '#fef08a' : (isHovered || isSelected ? '#ffffff' : '#e2e8f0');
    ctx.fillText(label, node.x, textY);

    ctx.restore();
  }, [matchingNodeIds, selectedNode, hoveredNode]);

  // Handle Zoom & View reset
  const handleResetView = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 40);
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>

      {/* Top Header & Search Bar */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        left: '16px',
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 18px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>

        {/* Title Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
          }}>
            <Sparkles size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', letterSpacing: '-0.02em', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              גרף סמנטי 2.0
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                Deep Knowledge
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              מבט רב-ממדי: אשכולות סמנטיים, קשרים כיווניים ותובנות
            </div>
          </div>
        </div>

        {/* Data Scope Switcher Toolbar */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          padding: '3px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          gap: '4px'
        }}>
          <button
            onClick={() => setDataScope('personal')}
            title="הצג נתוני ידע אישי, רשומות ותובנות בלבד"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: dataScope === 'personal' ? '#38bdf8' : 'transparent',
              color: dataScope === 'personal' ? '#0f172a' : '#cbd5e1',
              boxShadow: dataScope === 'personal' ? '0 2px 8px rgba(56, 189, 248, 0.4)' : 'none'
            }}
          >
            <span>👤 ידע אישי ותובנות</span>
          </button>

          <button
            onClick={() => setDataScope('combined')}
            title="הצג ידע אישי יחד עם מושגים אקדמיים (TKF)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: dataScope === 'combined' ? '#f59e0b' : 'transparent',
              color: dataScope === 'combined' ? '#0f172a' : '#cbd5e1',
              boxShadow: dataScope === 'combined' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none'
            }}
          >
            <span>🌐 משולב</span>
          </button>

          <button
            onClick={() => setDataScope('theoretical')}
            title="הצג מושגים ממאגר הידע האקדמי (TKF) בלבד"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: dataScope === 'theoretical' ? '#8b5cf6' : 'transparent',
              color: dataScope === 'theoretical' ? '#ffffff' : '#cbd5e1',
              boxShadow: dataScope === 'theoretical' ? '0 2px 8px rgba(139, 92, 246, 0.4)' : 'none'
            }}
          >
            <span>📚 אקדמי (TKF)</span>
          </button>
        </div>

        {/* Semantic Query Input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="שאילתה סמנטית (לדוגמה: חרדה, שינה, ספורט)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 36px 8px 32px',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              border: searchQuery ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY_COLORS).map(([catKey, info]) => {
            const isEnabled = enabledCategories.has(catKey);
            return (
              <button
                key={catKey}
                onClick={() => toggleCategory(catKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  border: `1px solid ${isEnabled ? info.border : 'rgba(255, 255, 255, 0.1)'}`,
                  backgroundColor: isEnabled ? info.bg : 'rgba(30, 41, 59, 0.4)',
                  color: isEnabled ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isEnabled ? info.main : '#64748b' }} />
                {info.label}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Force Graph Canvas */}
      <div style={{ flexGrow: 1, width: '100%', height: '100%', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#94a3b8' }}>
            <Activity className="spin" size={32} style={{ color: '#38bdf8' }} />
            <div>טוען ומעשיר גרף ידע סמנטי...</div>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f43f5e' }}>
            שגיאה בטעינת הנתונים: {error}
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={activeGraphData}
            backgroundColor="#090d16"
            nodeRelSize={7}
            nodeVal={n => n.val || 8}
            onRenderFramePre={handleRenderFramePre}
            nodeCanvasObject={handleNodeCanvasObject}
            
            // Rich Edges Parameters
            linkColor={link => {
              const isDimmed = matchingNodeIds && 
                (!matchingNodeIds.has(typeof link.source === 'object' ? link.source.id : link.source) ||
                 !matchingNodeIds.has(typeof link.target === 'object' ? link.target.id : link.target));
              return isDimmed ? 'rgba(51, 65, 85, 0.15)' : (link.color || '#38bdf8');
            }}
            linkWidth={link => (hoveredLink === link ? 3.5 : 1.8)}
            linkDirectionalParticles={link => (showParticles ? 3 : 0)}
            linkDirectionalParticleWidth={link => (hoveredLink === link ? 4.5 : 2.5)}
            linkDirectionalParticleSpeed={0.007}
            linkDirectionalParticleColor={link => link.color || '#38bdf8'}
            linkDirectionalArrowLength={4.5}
            linkDirectionalArrowRelPos={0.88}
            
            onNodeClick={(node) => setSelectedNode(node)}
            onNodeHover={(node) => setHoveredNode(node)}
            onLinkHover={(link) => setHoveredLink(link)}
            enableNodeDrag={true}
            cooldownTicks={100}
          />
        )}
      </div>

      {/* Floating Canvas Controls Toolbar */}
      <div style={{
        position: 'absolute',
        top: '90px',
        left: '16px',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        padding: '8px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button
          onClick={handleResetView}
          title="מרכז גרף"
          style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
        >
          <Maximize2 size={18} />
        </button>

        <button
          onClick={() => setShowClusters(prev => !prev)}
          title={showClusters ? "הסתר אשכולות סמנטיים" : "הצג אשכולות סמנטיים"}
          style={{
            background: showClusters ? 'rgba(56, 189, 248, 0.2)' : 'none',
            border: 'none',
            color: showClusters ? '#38bdf8' : '#e2e8f0',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px'
          }}
        >
          <Layers size={18} />
        </button>

        <button
          onClick={() => setShowParticles(prev => !prev)}
          title={showParticles ? "הסתר חלקיקי זרימה" : "הצג חלקיקי זרימה"}
          style={{
            background: showParticles ? 'rgba(245, 158, 11, 0.2)' : 'none',
            border: 'none',
            color: showParticles ? '#f59e0b' : '#e2e8f0',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px'
          }}
        >
          <Activity size={18} />
        </button>
      </div>

      {/* Edge Hover Summary Tooltip */}
      {hoveredLink && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${hoveredLink.color || '#38bdf8'}`,
          borderRadius: '12px',
          padding: '10px 16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          maxWidth: '420px',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: hoveredLink.color || '#38bdf8', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span>{RELATIONSHIP_LABELS[hoveredLink.relationshipType] || hoveredLink.relationshipType}</span>
          </div>
          <div style={{ fontSize: '0.88rem', color: '#ffffff', fontWeight: '500' }}>
            {hoveredLink.summary}
          </div>
        </div>
      )}

      {/* Interactive Bottom Timeline Slider */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        right: '16px',
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Play / Pause Toggle */}
        <button
          onClick={() => setIsPlayingTimeline(prev => !prev)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#38bdf8',
            border: 'none',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(56, 189, 248, 0.4)'
          }}
        >
          {isPlayingTimeline ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
        </button>

        {/* Date Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '130px', flexShrink: 0 }}>
          <Calendar size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#ffffff' }}>
            {currentTimelineDate || 'כל הזמנים'}
          </span>
        </div>

        {/* Timeline Range Slider */}
        <input
          type="range"
          min={0}
          max={Math.max(0, allChronologicalDates.length - 1)}
          value={timelineIndex}
          onChange={(e) => {
            setIsPlayingTimeline(false);
            setTimelineIndex(Number(e.target.value));
          }}
          style={{
            flexGrow: 1,
            accentColor: '#38bdf8',
            cursor: 'pointer'
          }}
        />

        {/* Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[1, 2, 4].map(spd => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              style={{
                background: playbackSpeed === spd ? 'rgba(56, 189, 248, 0.25)' : 'none',
                border: 'none',
                color: playbackSpeed === spd ? '#38bdf8' : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: '600',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Reset Timeline Button */}
        <button
          onClick={() => {
            setIsPlayingTimeline(false);
            setTimelineIndex(allChronologicalDates.length - 1);
          }}
          title="אפס ציר זמן"
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
        >
          <RotateCcw size={16} />
        </button>

        {/* Node Count Indicator */}
        <div style={{ fontSize: '0.78rem', color: '#94a3b8', flexShrink: 0 }}>
          {activeGraphData.nodes.length} מושגים
        </div>
      </div>

      {/* Selected Node Sidebar Modal */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: '90px',
          right: '16px',
          width: '340px',
          maxHeight: 'calc(100% - 190px)',
          zIndex: 30,
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${selectedNode.color || '#38bdf8'}`,
          borderRadius: '16px',
          padding: '16px',
          overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              padding: '3px 8px',
              borderRadius: '12px',
              backgroundColor: CATEGORY_COLORS[selectedNode.parent_category]?.bg || 'rgba(56, 189, 248, 0.2)',
              color: CATEGORY_COLORS[selectedNode.parent_category]?.main || '#38bdf8'
            }}>
              {selectedNode.parent_category}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
            {selectedNode.name || selectedNode.label || selectedNode.id}
          </h3>

          {selectedNode.content && (
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '14px' }}>
              {selectedNode.content}
            </p>
          )}

          {/* Connected Links Section */}
          <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
              קשרים ישירים:
            </div>
            {activeGraphData.links
              .filter(l => {
                const sId = typeof l.source === 'object' ? l.source.id : l.source;
                const tId = typeof l.target === 'object' ? l.target.id : l.target;
                return sId === selectedNode.id || tId === selectedNode.id;
              })
              .map((link, idx) => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const otherId = sId === selectedNode.id 
                  ? (typeof link.target === 'object' ? link.target.id : link.target)
                  : sId;

                return (
                  <div
                    key={idx}
                    style={{
                      fontSize: '0.78rem',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(30, 41, 59, 0.6)',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderLeft: `3px solid ${link.color}`
                    }}
                  >
                    <span>{otherId}</span>
                    <span style={{ color: link.color, fontWeight: '600', fontSize: '0.7rem' }}>
                      {link.relationshipType}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Navigate to Entry Button */}
          {selectedNode.entryId && onNavigateToEntry && (
            <button
              onClick={() => onNavigateToEntry(selectedNode.entryId)}
              style={{
                width: '100%',
                marginTop: '14px',
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: '#38bdf8',
                color: '#0f172a',
                fontWeight: '600',
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>צפה ברשומה המלאה</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

    </div>
  );
}
