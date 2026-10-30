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
  HelpCircle,
  Network,
  Compass,
  Bot,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileText
} from 'lucide-react';
import { forceCollide } from 'd3-force';
import { useDiaryData } from './hooks/useDiaryData';
import { 
  enrichGraphData, 
  CATEGORY_COLORS, 
  RELATIONSHIP_COLORS, 
  RELATIONSHIP_LABELS 
} from './utils/semanticGraphEnricher';
import DomainInsightExplorer from './components/DomainInsightExplorer';
import * as fbModule from './firebase';

// Support both analyzeGraphDetective and triggerGraphAnalysis
const analyzeGraphDetective = fbModule.analyzeGraphDetective || fbModule.triggerGraphAnalysis;

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

export default function DeepKnowledgeView({ 
  onNavigateToEntry, 
  onOpenTraceability,
  uid: propUid,
  graphNodes: propGraphNodes,
  entries: propEntries
}) {
  const { rawGraphData, loading, error, entries: hookEntries, uid: hookUid } = useDiaryData();

  const uid = propUid || hookUid || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';
  const entries = propEntries || hookEntries || [];

  const fgRef = useRef();

  // Top View Mode: 'domains' (Default High-Signal Mode) | 'network' (Interactive Force Graph + Detective)
  const [viewMode, setViewMode] = useState('domains');

  // Enriched Graph Data
  const enrichedData = useMemo(() => {
    return enrichGraphData(rawGraphData);
  }, [rawGraphData]);

  const graphNodes = propGraphNodes || enrichedData.nodes || [];

  // Controls & Filters State
  const [dataScope, setDataScope] = useState('personal'); // 'personal' (default) | 'combined' | 'theoretical'
  const [searchQuery, setSearchQuery] = useState('');
  const [showClusters, setShowClusters] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  // Detective Agent State
  const [isDetectiveOpen, setIsDetectiveOpen] = useState(false);
  const [detectiveLoading, setDetectiveLoading] = useState(false);
  const [detectiveReport, setDetectiveReport] = useState(null);
  const [detectiveError, setDetectiveError] = useState(null);

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

  // Smooth camera zoom when a node is selected from DomainInsightExplorer
  useEffect(() => {
    if (selectedNode && viewMode === 'network' && fgRef.current) {
      if (typeof selectedNode.x === 'number' && typeof selectedNode.y === 'number') {
        setTimeout(() => {
          if (fgRef.current) {
            fgRef.current.centerAt(selectedNode.x, selectedNode.y, 800);
            fgRef.current.zoom(2.2, 800);
          }
        }, 150);
      }
    }
  }, [selectedNode, viewMode]);

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

  // Configure D3 Force Simulation
  useEffect(() => {
    if (!fgRef.current || viewMode !== 'network') return;

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
  }, [activeGraphData, viewMode]);

  // Category Toggle Handler
  const toggleCategory = useCallback((catName) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(catName)) {
        if (next.size > 1) next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  }, []);

  // Pre-Render Frame: Canvas Convex Hulls / Semantic Cluster Backgrounds
  const handleRenderFramePre = useCallback((ctx, globalScale) => {
    if (!showClusters || !activeGraphData.nodes.length) return;

    const categoryGroups = {};
    activeGraphData.nodes.forEach(node => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
      const cat = node.parent_category || 'כללי ומושגים';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push({ x: node.x, y: node.y });
    });

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

  // Custom Canvas Rendering for Nodes
  const handleNodeCanvasObject = useCallback((node, ctx, globalScale) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

    const isDimmed = matchingNodeIds && !matchingNodeIds.has(node.id);
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

    // INSIGHT NODES: Glowing Sun
    if (node.isInsight) {
      const radius = isHovered || isSelected ? 22 : 18;

      const glowGrad = ctx.createRadialGradient(node.x, node.y, 4, node.x, node.y, radius * 2.6);
      glowGrad.addColorStop(0, 'rgba(255, 230, 110, 0.95)');
      glowGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.60)');
      glowGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.20)');
      glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 2.6, 0, 2 * Math.PI);
      ctx.fillStyle = glowGrad;
      ctx.fill();

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

      ctx.font = `bold ${radius * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#78350f';
      ctx.fillText('★', node.x, node.y + 1);

    } else {
      // STANDARD NODES
      const radius = isHovered || isSelected ? 11 : (node.val || 7);
      const color = node.color || '#38bdf8';

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

    const label = node.name || node.label || node.id;
    const fontSize = Math.max(10, 12 / Math.sqrt(globalScale));
    ctx.font = `${node.isInsight ? '700' : '500'} ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textY = node.x && node.y ? node.y + (node.isInsight ? 24 : 10) : 0;

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

  // Run Detective Agent Analysis
  const handleTriggerDetective = async () => {
    if (!uid || detectiveLoading) return;
    setDetectiveLoading(true);
    setDetectiveError(null);
    setIsDetectiveOpen(true);
    try {
      if (typeof analyzeGraphDetective === 'function') {
        const queryPrompt = 'אנא פעל כסוכן בלש של מארג הידע שלי: זהה צווארי בקבוק מרכזיים בין תחומי החיים (עבודה, משפחה, בריאות, כספים, התפתחות), מצא גשרים סמויים וקונפליקטים בלתי מדוברים, והצע שאלות עומק לחקירה.';
        const response = await analyzeGraphDetective(uid, queryPrompt);
        if (response && response.status === 'success') {
          setDetectiveReport(response.result || response.data || response.analysis || JSON.stringify(response));
        } else if (typeof response === 'string') {
          setDetectiveReport(response);
        } else if (response?.result) {
          setDetectiveReport(response.result);
        } else {
          setDetectiveReport('סריקת סוכן הבלש הושלמה בהצלחה.');
        }
      } else {
        throw new Error('פונקציית סוכן הבלש אינה זמינה כרגע.');
      }
    } catch (err) {
      console.error('Detective Agent failed:', err);
      setDetectiveError(err.message || 'שגיאה בהפעלת סוכן הבלש');
    } finally {
      setDetectiveLoading(false);
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

      {/* Prominent Unified 2-Mode Switcher Header */}
      <div style={{
        padding: '12px 20px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 25,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Title & Badge */}
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
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧭 מפת עומק וקשרים
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                Deep Knowledge Map
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              סייר תחומי חיים עם דירוג בולטות, רשת סמנטית וסוכן בלש לניתוח צווארי בקבוק
            </div>
          </div>
        </div>

        {/* 2-Mode Header Switcher Buttons */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(30, 41, 59, 0.9)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          gap: '6px'
        }}>
          {/* Mode 1: Domain Cards (Default) */}
          <button
            onClick={() => setViewMode('domains')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: viewMode === 'domains' ? '#38bdf8' : 'transparent',
              color: viewMode === 'domains' ? '#0f172a' : '#cbd5e1',
              boxShadow: viewMode === 'domains' ? '0 2px 10px rgba(56, 189, 248, 0.4)' : 'none'
            }}
          >
            <Compass size={17} />
            <span>🗂️ סייר תחומי חיים ודפוסים</span>
          </button>

          {/* Mode 2: Interactive Network Graph */}
          <button
            onClick={() => setViewMode('network')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: viewMode === 'network' ? '#818cf8' : 'transparent',
              color: viewMode === 'network' ? '#0f172a' : '#cbd5e1',
              boxShadow: viewMode === 'network' ? '0 2px 10px rgba(129, 140, 248, 0.4)' : 'none'
            }}
          >
            <Network size={17} />
            <span>🕸️ רשת סמנטית וציר זמן</span>
          </button>
        </div>

        {/* AI Detective Action Button */}
        <button
          onClick={handleTriggerDetective}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#090d16',
            border: 'none',
            fontSize: '0.86rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(245, 158, 11, 0.35)',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Bot size={18} />
          <span>🕵️‍♂️ סוכן בלש (צווארי בקבוק)</span>
        </button>
      </div>

      {/* BODY VIEW 1: DOMAINS & HIGH-SIGNAL CARDS (DEFAULT MODE) */}
      {viewMode === 'domains' && (
        <div style={{ flexGrow: 1, width: '100%', height: 'calc(100% - 65px)', overflowY: 'auto' }}>
          <DomainInsightExplorer
            graphNodes={graphNodes}
            entries={entries}
            onNavigateToEntry={onNavigateToEntry}
            onOpenTraceability={onOpenTraceability}
            onSelectNodeInGraph={(node) => {
              setViewMode('network');
              setSelectedNode(node);
            }}
          />
        </div>
      )}

      {/* BODY VIEW 2: INTERACTIVE FORCE GRAPH 2D + TIMELINE SCRUBBER */}
      {viewMode === 'network' && (
        <div style={{ flexGrow: 1, width: '100%', height: 'calc(100% - 65px)', position: 'relative' }}>
          
          {/* Graph Controls Toolbar: Search & Filters */}
          <div style={{
            position: 'absolute',
            top: '14px',
            right: '16px',
            left: '16px',
            zIndex: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 16px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Scope Switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              gap: '4px'
            }}>
              <button
                onClick={() => setDataScope('personal')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dataScope === 'personal' ? '#38bdf8' : 'transparent',
                  color: dataScope === 'personal' ? '#0f172a' : '#cbd5e1'
                }}
              >
                👤 ידע אישי
              </button>
              <button
                onClick={() => setDataScope('combined')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dataScope === 'combined' ? '#f59e0b' : 'transparent',
                  color: dataScope === 'combined' ? '#0f172a' : '#cbd5e1'
                }}
              >
                🌐 משולב
              </button>
              <button
                onClick={() => setDataScope('theoretical')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dataScope === 'theoretical' ? '#8b5cf6' : 'transparent',
                  color: dataScope === 'theoretical' ? '#ffffff' : '#cbd5e1'
                }}
              >
                📚 אקדמי
              </button>
            </div>

            {/* Semantic Query Search Bar */}
            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="שאילתה בגרף (חרדה, שינה, עבודה)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 32px 6px 28px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: searchQuery ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              {Object.entries(CATEGORY_COLORS).map(([catKey, info]) => {
                const isEnabled = enabledCategories.has(catKey);
                return (
                  <button
                    key={catKey}
                    onClick={() => toggleCategory(catKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: `1px solid ${isEnabled ? info.border : 'rgba(255, 255, 255, 0.1)'}`,
                      backgroundColor: isEnabled ? info.bg : 'rgba(30, 41, 59, 0.4)',
                      color: isEnabled ? '#ffffff' : '#64748b'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isEnabled ? info.main : '#64748b' }} />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canvas Component */}
          <div style={{ width: '100%', height: '100%' }}>
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
            top: '80px',
            left: '16px',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.85)',
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

          {/* Edge Hover Tooltip */}
          {hoveredLink && (
            <div style={{
              position: 'absolute',
              bottom: '90px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${hoveredLink.color || '#38bdf8'}`,
              borderRadius: '12px',
              padding: '10px 16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              maxWidth: '420px',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: hoveredLink.color || '#38bdf8', marginBottom: '4px' }}>
                {RELATIONSHIP_LABELS[hoveredLink.relationshipType] || hoveredLink.relationshipType}
              </div>
              <div style={{ fontSize: '0.86rem', color: '#ffffff', fontWeight: 500 }}>
                {hoveredLink.summary}
              </div>
            </div>
          )}

          {/* Interactive Bottom Timeline Scrubber */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            zIndex: 20,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <button
              onClick={() => setIsPlayingTimeline(prev => !prev)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#38bdf8',
                border: 'none',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {isPlayingTimeline ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: '2px' }} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px', flexShrink: 0 }}>
              <Calendar size={15} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                {currentTimelineDate || 'כל הזמנים'}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(0, allChronologicalDates.length - 1)}
              value={timelineIndex}
              onChange={(e) => {
                setIsPlayingTimeline(false);
                setTimelineIndex(Number(e.target.value));
              }}
              style={{ flexGrow: 1, accentColor: '#38bdf8', cursor: 'pointer' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[1, 2, 4].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  style={{
                    background: playbackSpeed === spd ? 'rgba(56, 189, 248, 0.25)' : 'none',
                    border: 'none',
                    color: playbackSpeed === spd ? '#38bdf8' : '#94a3b8',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '3px 6px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setIsPlayingTimeline(false);
                setTimelineIndex(allChronologicalDates.length - 1);
              }}
              title="אפס ציר זמן"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            >
              <RotateCcw size={15} />
            </button>

            <div style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
              {activeGraphData.nodes.length} מושגים
            </div>
          </div>

          {/* Selected Node Inspector Drawer */}
          {selectedNode && (
            <div style={{
              position: 'absolute',
              top: '80px',
              right: '16px',
              width: '340px',
              maxHeight: 'calc(100% - 170px)',
              zIndex: 30,
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${selectedNode.color || '#38bdf8'}`,
              borderRadius: '16px',
              padding: '16px',
              overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: CATEGORY_COLORS[selectedNode.parent_category]?.bg || 'rgba(56, 189, 248, 0.2)',
                  color: CATEGORY_COLORS[selectedNode.parent_category]?.main || '#38bdf8'
                }}>
                  {selectedNode.parent_category || selectedNode.type || 'מושג'}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                {selectedNode.name || selectedNode.label || selectedNode.id}
              </h3>

              {selectedNode.content && (
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '12px' }}>
                  {selectedNode.content}
                </p>
              )}

              {/* Direct Links */}
              <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  קשרים ישירים בגרף:
                </div>
                {activeGraphData.links
                  .filter(l => {
                    const sId = typeof l.source === 'object' ? l.source.id : l.source;
                    const tId = typeof l.target === 'object' ? l.target.id : l.target;
                    return sId === selectedNode.id || tId === selectedNode.id;
                  })
                  .slice(0, 8)
                  .map((link, idx) => {
                    const sId = typeof link.source === 'object' ? link.source.id : link.source;
                    const otherId = sId === selectedNode.id 
                      ? (typeof link.target === 'object' ? link.target.id : link.target)
                      : sId;

                    return (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.76rem',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(30, 41, 59, 0.6)',
                          marginBottom: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderLeft: `3px solid ${link.color || '#38bdf8'}`
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>{otherId}</span>
                        <span style={{ color: link.color || '#38bdf8', fontWeight: 600, fontSize: '0.68rem' }}>
                          {link.relationshipType || link.label}
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
                    marginTop: '12px',
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: '#38bdf8',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>צפה ברשומה המלאה</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* AI Detective Modal / Panel */}
      {isDetectiveOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '20px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden',
            direction: 'rtl'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.15))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f59e0b',
                  color: '#090d16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                    🕵️‍♂️ סוכן בלש — ניתוח צמתים חבויים וצווארי בקבוק
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>
                    חילוץ תבניות עומק, גשרים סמויים וקונפליקטים מתוך מארג הידע
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsDetectiveOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.6 }}>
              {detectiveLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '16px' }}>
                  <Activity className="spin" size={36} style={{ color: '#f59e0b' }} />
                  <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '1rem' }}>
                    סוכן הבלש סורק כעת את מארג הידע...
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', maxWidth: '420px', textAlign: 'center' }}>
                    מנתח קשרים בין 5 תחומי החיים, מאתר צווארי בקבוק (חזרתיות של עומס וביקורת עצמית) ומבודד גשרים סמויים.
                  </div>
                </div>
              ) : detectiveError ? (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '16px',
                  borderRadius: '12px',
                  color: '#f87171'
                }}>
                  <AlertTriangle size={18} style={{ marginBottom: '6px' }} />
                  <div>{detectiveError}</div>
                  <button
                    onClick={handleTriggerDetective}
                    style={{
                      marginTop: '10px',
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}
                  >
                    נסה שוב
                  </button>
                </div>
              ) : detectiveReport ? (
                <div>
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '18px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit'
                  }}>
                    {detectiveReport}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
                    לחץ על הכפתור מטה להפעלת סריקת בלש מעמיקה על כלל המושגים, הרשומות והקשרים בגרף.
                  </p>
                  <button
                    onClick={handleTriggerDetective}
                    style={{
                      background: '#f59e0b',
                      color: '#090d16',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    הפעל סריקת בלש עכשיו
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={handleTriggerDetective}
                disabled={detectiveLoading}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: detectiveLoading ? 'not-allowed' : 'pointer'
                }}
              >
                רענן סריקה 🔄
              </button>

              <button
                onClick={() => setIsDetectiveOpen(false)}
                style={{
                  background: '#38bdf8',
                  color: '#090d16',
                  border: 'none',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
