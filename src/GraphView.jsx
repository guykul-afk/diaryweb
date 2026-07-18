import React, { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import { Info, Search, Filter, Hash, Heart, Brain, RefreshCw, Sparkles } from 'lucide-react';
import { triggerGraphAnalysis, explainGraphLink, resolveAndClusterEntities } from './firebase';
import { forceCollide } from 'd3-force';
import { useDiaryData } from './hooks/useDiaryData';

export default function GraphView({ onNavigateToEntry, isaData }) {
  const {
    rawGraphData,
    loading,
    error,
    uid,
    uniqueTopics,
    uniqueMoods,
    allDatesSorted,
    conceptMetadataMap,
    getNodeType,
    rawNodeDegrees,
    searchQuery, setSearchQuery,
    selectedTopics, setSelectedTopics,
    selectedMoods, setSelectedMoods,
    minWeight, setMinWeight,
    visibleTypes, setVisibleTypes,
    minDegree, setMinDegree,
    minLinkWeight, setMinLinkWeight,
    limitEntities, setLimitEntities,
    selectedDateIndex, setSelectedDateIndex,
    filteredNodes,
    filteredLinks,
    fetchData
  } = useDiaryData();

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [graphMode, setGraphMode] = useState('2d'); // '2d' or '3d'
  const [egoDepth, setEgoDepth] = useState(1);
  const [colorByIsa, setColorByIsa] = useState(false);

  // AI Graph Analysis States
  const [analyzingGraph, setAnalyzingGraph] = useState(false);
  const [graphAnalysisResult, setGraphAnalysisResult] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  // AI Graph Optimization States
  const [optimizingGraph, setOptimizingGraph] = useState(false);
  const [optimizationMessage, setOptimizationMessage] = useState('');

  // AI Link Explanation States
  const [explainingLink, setExplainingLink] = useState(false);
  const [linkExplanation, setLinkExplanation] = useState(null);
  const [lastExplainedLink, setLastExplainedLink] = useState(null);

  // Fetch link explanation when selectedLink changes
  useEffect(() => {
    if (!selectedLink || !uid) {
      setLinkExplanation(null);
      setLastExplainedLink(null);
      return;
    }
    
    const sourceId = typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source;
    const targetId = typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target;
    const relation = selectedLink.label || selectedLink.relation || '';
    
    const linkKey = `${sourceId}-${targetId}-${relation}`;
    if (lastExplainedLink === linkKey) return;
    
    const fetchExplanation = async () => {
      setExplainingLink(true);
      setLinkExplanation(null);
      try {
        const response = await explainGraphLink(uid, sourceId, targetId, relation);
        if (response.status === 'success') {
          setLinkExplanation(response.explanation);
          setLastExplainedLink(linkKey);
        } else {
          setLinkExplanation('שגיאה בטעינת ההסבר מהשרת.');
        }
      } catch (err) {
        console.error(err);
        setLinkExplanation('לא ניתן היה לטעון הסבר קשר באמצעות AI.');
      } finally {
        setExplainingLink(false);
      }
    };
    
    fetchExplanation();
  }, [selectedLink, uid]);

  const handleAnalyzeGraph = async () => {
    if (analyzingGraph || !uid) return;
    setAnalyzingGraph(true);
    setGraphAnalysisResult(null);
    setShowAnalysisModal(true);
    try {
      const response = await triggerGraphAnalysis(uid);
      if (response.status === 'success') {
        setGraphAnalysisResult(response.result + '\n\n*(ניתוח זה נשמר אוטומטית במאגר הידע)*');
      } else {
        setGraphAnalysisResult('שגיאה בקבלת הניתוח מהשרת.');
      }
    } catch (err) {
      console.error(err);
      setGraphAnalysisResult('לא ניתן היה להריץ ניתוח גרף באמצעות AI.');
    } finally {
      setAnalyzingGraph(false);
    }
  };

  const handleOptimizeGraph = async () => {
    if (optimizingGraph || !uid) return;
    setOptimizingGraph(true);
    setOptimizationMessage('');
    try {
      const response = await resolveAndClusterEntities(uid);
      if (response.status === 'success') {
        setOptimizationMessage(response.message || 'האופטימיזציה הושלמה בהצלחה!');
        await fetchData(); // Refresh graph data
      } else {
        setOptimizationMessage(response.message || 'שגיאה באופטימיזציית הגרף.');
      }
    } catch (err) {
      console.error(err);
      setOptimizationMessage('לא ניתן היה לבצע אופטימיזציה לגרף.');
    } finally {
      setOptimizingGraph(false);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h5 key={idx} style={{ fontSize: '1rem', fontWeight: 700, margin: '14px 0 8px 0', color: 'var(--text-primary)' }}>{line.replace('### ', '')}</h5>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={idx} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '16px 0 10px 0', color: 'var(--accent-color)' }}>{line.replace('## ', '')}</h4>;
      }
      if (line.startsWith('# ')) {
        return <h3 key={idx} style={{ fontSize: '1.3rem', fontWeight: 700, margin: '18px 0 12px 0', color: 'var(--text-primary)' }}>{line.replace('# ', '')}</h3>;
      }
      
      let isListItem = false;
      let listContent = line;
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        isListItem = true;
        listContent = line.trim().substring(2);
      }
      
      const parts = [];
      let lastIndex = 0;
      const regex = /\*\*(.*?)\*\*/g;
      let match;
      while ((match = regex.exec(listContent)) !== null) {
        if (match.index > lastIndex) {
          parts.push(listContent.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < listContent.length) {
        parts.push(listContent.substring(lastIndex));
      }
      
      if (isListItem) {
        return (
          <li key={idx} style={{ marginRight: '16px', marginBottom: '6px', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', listStyleType: 'disc' }}>
            {parts}
          </li>
        );
      }
      
      return (
        <p key={idx} style={{ margin: '0 0 10px 0', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {parts}
        </p>
      );
    });
  };

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });


  // Handle resizing of the graph canvas
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

  const hasLinkWeight = useMemo(() => {
    return rawGraphData.links.some(l => l.weight !== undefined || l.val !== undefined || l.strength !== undefined || l.value !== undefined);
  }, [rawGraphData]);

  // Ego Network filter - applied locally over hook's filtered data
  const finalGraphData = useMemo(() => {
    let nodes = filteredNodes;
    let links = filteredLinks;

    if (selectedNode) {
      const selectedId = selectedNode.id;
      const egoIds = new Set([selectedId]);
      let currentLevel = new Set([selectedId]);
      
      for (let i = 0; i < egoDepth; i++) {
        const nextLevel = new Set();
        filteredLinks.forEach(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          
          if (currentLevel.has(sourceId) && !egoIds.has(targetId)) {
            nextLevel.add(targetId);
            egoIds.add(targetId);
          }
          if (currentLevel.has(targetId) && !egoIds.has(sourceId)) {
            nextLevel.add(sourceId);
            egoIds.add(sourceId);
          }
        });
        currentLevel = nextLevel;
      }

      nodes = filteredNodes.filter(node => egoIds.has(node.id));
      links = filteredLinks.filter(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return egoIds.has(sourceId) && egoIds.has(targetId);
      });
    }

    return {
      nodes,
      links
    };
  }, [filteredNodes, filteredLinks, selectedNode, egoDepth]);

  const getLinkColor = (link) => {
    if (selectedLink && link === selectedLink) return '#ff6b6b';
    if (link.sentimentScore > 0) return 'rgba(72, 187, 120, 0.6)';
    if (link.sentimentScore < 0) return 'rgba(229, 62, 62, 0.6)';
    return '#E0E0E0';
  };

  // Helper to calculate node radius based on weight with high variance
  const getNodeRadius = (node) => {
    const isGuy = node.id === 'גיא' || node.name === 'גיא' || node.id === 'guy';
    if (isGuy) return 5;
    const weight = node.weight || 1;
    // Steeper linear growth for high visual variance (weight 1 -> r=4, weight 10 -> r=40)
    return Math.max(4, weight * 4);
  };

  // Setup force simulation with collision detection
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-250);
      fgRef.current.d3Force('link').distance(120);
      // Dynamic collision detection to match the new size variance
      fgRef.current.d3Force('collision', forceCollide(node => getNodeRadius(node) + 20));
    }
  }, [finalGraphData]);

  const handleNodeClick = (node) => {
    const nodeIdLower = node.id.toLowerCase();
    const meta = conceptMetadataMap[nodeIdLower] || { topics: new Set(), moods: new Set(), entries: [] };
    
    setSelectedNode({
      ...node,
      type: getNodeType(node),
      associatedTopics: Array.from(meta.topics),
      associatedMoods: Array.from(meta.moods),
      associatedEntries: meta.entries || []
    });
  };

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => 
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const toggleMood = (mood) => {
    setSelectedMoods(prev => 
      prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]
    );
  };

  const toggleTypeVisibility = (type) => {
    setVisibleTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // -------------------------------------------------------------
  // COMMUNITY DETECTION (Connected Components / Simple Louvain Alternative)
  // -------------------------------------------------------------
  const nodeCommunities = useMemo(() => {
    const communities = {};
    const adjList = {};
    finalGraphData.nodes.forEach(n => { adjList[n.id] = []; });
    finalGraphData.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (adjList[s]) adjList[s].push(t);
      if (adjList[t]) adjList[t].push(s);
    });

    let currentCommunity = 0;
    const visited = new Set();
    
    // Sort nodes by degree descending to make hubs the center of communities
    const sortedNodes = [...finalGraphData.nodes].sort((a, b) => (adjList[b.id]?.length || 0) - (adjList[a.id]?.length || 0));

    sortedNodes.forEach(n => {
      if (!visited.has(n.id)) {
        currentCommunity++;
        const queue = [n.id];
        while (queue.length > 0) {
          const curr = queue.shift();
          if (!visited.has(curr)) {
            visited.add(curr);
            communities[curr] = currentCommunity;
            if (adjList[curr]) {
              adjList[curr].forEach(neighbor => {
                if (!visited.has(neighbor)) {
                  queue.push(neighbor);
                }
              });
            }
          }
        }
      }
    });
    return communities;
  }, [finalGraphData]);

  const COMMUNITY_COLORS = [
    '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
    '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'
  ];

  // Node Color scheme helper
  const getNodeColor = (node, isSelected) => {
    if (isSelected) return '#ffffff';
    
    if (colorByIsa && isaData) {
      const nodeIdLower = node.id.toLowerCase();
      const meta = conceptMetadataMap[nodeIdLower];
      if (meta && meta.entries && meta.entries.length > 0) {
        let totalScore = 0;
        let count = 0;
        
        meta.entries.forEach(e => {
          if (e.date && isaData[e.date]) {
            const dayData = isaData[e.date];
            let score = 0;
            const qualityScore = (val) => {
              if (val === 'good') return 10;
              if (val === 'medium') return 5;
              return 0;
            };
            score += qualityScore(dayData.sportsSets);
            score += qualityScore(dayData.cardio);
            score += qualityScore(dayData.meditation);
            score += qualityScore(dayData.journal);
            score += qualityScore(dayData.book);
            score += qualityScore(dayData.efficacy);
            score += qualityScore(dayData.nutrition);
            score += qualityScore(dayData.sleep);
            score += qualityScore(dayData.work);
            score += qualityScore(dayData.family);
            score += qualityScore(dayData.social);
            
            const dayScore = Math.round((score / 110) * 100);
            totalScore += dayScore;
            count++;
          }
        });
        
        if (count > 0) {
          const avgScore = totalScore / count;
          // Interpolate HSL color: 0% is Red (0 deg), 100% is Green (120 deg)
          const hue = Math.min(120, Math.max(0, (avgScore / 100) * 120));
          return `hsl(${hue}, 80%, 45%)`;
        }
      }
      return '#333344'; // Dark neutral if no entries with ISA data
    }

    // Community based color (Graphify style)
    const commId = nodeCommunities[node.id] || 1;
    return COMMUNITY_COLORS[commId % COMMUNITY_COLORS.length];
  };

  return (
    <div className="graph-container">
      {/* Sidebar Controls & Inspector */}
      <div className="graph-sidebar">
        {/* AI Detective Analysis & Graph Optimization */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={handleAnalyzeGraph}
            disabled={analyzingGraph || optimizingGraph}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: (analyzingGraph || optimizingGraph) ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'background-color 0.2s',
              opacity: (analyzingGraph || optimizingGraph) ? 0.7 : 1
            }}
          >
            {analyzingGraph ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Brain size={16} />
            )}
            <span>ניתוח פערים ותבניות בגרף (AI)</span>
          </button>

          <button
            onClick={handleOptimizeGraph}
            disabled={analyzingGraph || optimizingGraph}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#3182ce',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: (analyzingGraph || optimizingGraph) ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              transition: 'background-color 0.2s',
              opacity: (analyzingGraph || optimizingGraph) ? 0.7 : 1
            }}
          >
            {optimizingGraph ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            <span>ייעול ואיחוד ישויות בגרף (AI)</span>
          </button>

          {optimizationMessage && (
            <div style={{
              fontSize: '0.8rem',
              color: optimizationMessage.includes('שגיאה') || optimizationMessage.includes('לא ניתן') ? '#e53e3e' : '#38a169',
              marginTop: '4px',
              padding: '6px 8px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              border: '1px solid var(--border-color)',
              direction: 'rtl'
            }}>
              {optimizationMessage}
            </div>
          )}
        </div>

        {/* ISA Color Coding Toggle */}
        {isaData && (
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>קידוד צבע מיוחד:</span>
            <button
              onClick={() => setColorByIsa(!colorByIsa)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: colorByIsa ? '#059669' : 'rgba(255, 255, 255, 0.05)',
                color: colorByIsa ? '#fff' : 'var(--text-primary)',
                border: '1px solid',
                borderColor: colorByIsa ? '#059669' : 'var(--border-color)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🎨 {colorByIsa ? 'צובע לפי ציון ISA (פעילות יומית)' : 'צבע לפי ציון ISA'}
            </button>
          </div>
        )}

        {/* Filters Panel */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Filter size={16} />
              סינון גרף הידע
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTopics([]);
                setSelectedMoods([]);
                setMinWeight(1);
                setVisibleTypes(['Concept', 'Person', 'Topic', 'Emotion']);
                setMinDegree(0);
                setMinLinkWeight(1);
                setEgoDepth(1);
                if (allDatesSorted.length > 0) {
                  setSelectedDateIndex(allDatesSorted.length - 1);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              אפס סינונים
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="חפש מושג בגרף..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>הצג סוגי מידע:</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { type: 'Concept', label: 'מושגים', color: '#3182ce' },
                { type: 'Person', label: 'שמות/אנשים', color: '#48bb78' },
                { type: 'Topic', label: 'נושאים/תגיות', color: '#9f7aea' },
                { type: 'Emotion', label: 'רגשות', color: '#ed64a6' }
              ].map(item => {
                const checked = visibleTypes.includes(item.type);
                return (
                  <button
                    key={item.type}
                    onClick={() => toggleTypeVisibility(item.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: checked ? item.color : 'var(--border-color)',
                      background: checked ? `${item.color}15` : 'transparent',
                      color: checked ? item.color : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: checked ? 600 : 400,
                      textAlign: 'right'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Separation Depth Filter (Ego Depth) - visible when a node is selected */}
          {selectedNode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--accent-light)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--accent-color)', fontWeight: 600 }}>
                <span>דרגת מרחק מ-{selectedNode.name}:</span>
                <strong>{egoDepth} {egoDepth === 1 ? 'דרגה' : 'דרגות'}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={egoDepth}
                onChange={(e) => setEgoDepth(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
              />
            </div>
          )}

          {/* Time range slider (Timeline Slider) */}
          {allDatesSorted.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>הצג מידע מצטבר עד תאריך:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>מ-{allDatesSorted[0]} עד:</span>
                  <strong>{allDatesSorted[selectedDateIndex] || ''}</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max={allDatesSorted.length - 1}
                  value={selectedDateIndex}
                  onChange={(e) => setSelectedDateIndex(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Weight Filter Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>חשיבות מושג מינימלית:</span>
              <strong>{minWeight.toFixed(1)}</strong>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={minWeight}
              onChange={(e) => setMinWeight(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Node Degree Filter (Minimum connections) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>כמות קשרים מינימלית לצומת:</span>
              <strong>{minDegree}</strong>
            </label>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={minDegree}
              onChange={(e) => setMinDegree(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Entity Limit Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>כמות ישויות מקסימלית להצגה:</span>
              <strong>{limitEntities}</strong>
            </label>
            <input
              type="range"
              min="5"
              max={rawGraphData?.nodes?.length || 150}
              step="5"
              value={limitEntities}
              onChange={(e) => setLimitEntities(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-color)' }}
            />
          </div>

          {/* Connection Strength (Edge Weight) Filter - rendered conditionally if weight data is available */}
          {hasLinkWeight && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>חוזק קשר מינימלי (משקל):</span>
                <strong>{minLinkWeight}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={minLinkWeight}
                onChange={(e) => setMinLinkWeight(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Topics Filter List */}
          {uniqueTopics.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                <span>#</span>
                נושאים (Topics):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '90px', overflowY: 'auto' }}>
                {uniqueTopics.map((topic, i) => {
                  const isSelected = selectedTopics.includes(topic);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleTopic(topic)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                        backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                        color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Moods Filter List */}
          {uniqueMoods.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                <span>♥</span>
                רגשות (Moods):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {uniqueMoods.map((mood, i) => {
                  const isSelected = selectedMoods.includes(mood);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleMood(mood)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)',
                        backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                        color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {mood}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Selected Node Details */}
        {selectedNode ? (
          <div className="concept-details">
            <div className="concept-header" style={{ position: 'relative' }}>
              <button 
                onClick={() => setSelectedNode(null)}
                style={{ position: 'absolute', left: 0, top: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)', padding: '0 5px' }}
                title="סגור חלונית וחזור למפה המלאה"
              >
                ×
              </button>
              <span className="concept-badge" style={{ backgroundColor: getNodeColor(selectedNode, false), color: '#ffffff' }}>
                {selectedNode.type}
              </span>
              <h3 className="concept-title">{selectedNode.name}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                חשיבות/משקל: {selectedNode.weight}
              </div>
            </div>
            
            <div className="concept-body" style={{ maxHeight: '140px', overflowY: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              {selectedNode.content ? (
                selectedNode.content
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>רשומה ריקה או לא נוצרה עדיין</span>
              )}
            </div>

            {/* Link to related journal entries */}
            {selectedNode.associatedEntries && selectedNode.associatedEntries.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>רשומות יומן קשורות:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                  {selectedNode.associatedEntries.map((e, i) => (
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
                        gap: '6px',
                        width: 'fit-content'
                      }}
                    >
                      <span>📄</span>
                      <span style={{ textDecoration: 'underline' }}>כניסת יומן מתאריך: {e.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Display matched metadata from indexing */}
            {selectedNode.associatedTopics && selectedNode.associatedTopics.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>נושאים מקושרים:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {selectedNode.associatedTopics.map((t, i) => (
                    <span key={i} className="topic-badge" style={{ fontSize: '0.65rem' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing relationships list */}
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>קשרים בגרף:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                {finalGraphData.links
                  .filter(link => {
                    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                    return sourceId === selectedNode.id;
                  })
                  .map((link, i) => {
                    const targetName = typeof link.target === 'object' ? link.target.id : link.target;
                    return (
                      <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ← <strong>{link.label}</strong> את <span style={{ color: 'var(--accent-color)', fontWeight: 500 }}>[[{targetName}]]</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : selectedLink ? (
          <div className="concept-details">
            <div className="concept-header" style={{ position: 'relative' }}>
              <button 
                onClick={() => setSelectedLink(null)}
                style={{ position: 'absolute', left: 0, top: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)', padding: '0 5px' }}
                title="סגור חלונית"
              >
                ×
              </button>
              <h3 className="concept-title">פרטי קשר (Edge)</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                בין <strong>{typeof selectedLink.source === 'object' ? selectedLink.source.name || selectedLink.source.id : selectedLink.source}</strong> ל-<strong>{typeof selectedLink.target === 'object' ? selectedLink.target.name || selectedLink.target.id : selectedLink.target}</strong>
              </div>
            </div>
            <div className="concept-body">
              <p style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>סוג הקשר: {selectedLink.label || selectedLink.relation || 'לא צוין'}</p>
              {selectedLink.sentimentScore !== undefined && (
                <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                  סנטימנט: {selectedLink.sentimentScore > 0 ? 'חיובי 🟢' : selectedLink.sentimentScore < 0 ? 'שלילי 🔴' : 'ניטרלי ⚪'}
                </p>
              )}
              {selectedLink.sourceQuotes && selectedLink.sourceQuotes.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>ציטוטים מתוך היומן:</h4>
                  {selectedLink.sourceQuotes.map((q, i) => (
                    <blockquote key={i} style={{ fontSize: '0.8rem', fontStyle: 'italic', borderRight: '3px solid var(--accent-color)', paddingRight: '8px', margin: '4px 0', color: 'var(--text-muted)' }}>
                      "{q}"
                    </blockquote>
                  ))}
                </div>
              )}

              {/* AI Connection Explanation */}
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                  משמעות הקשר (AI):
                </h4>
                {explainingLink ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <RefreshCw className="spin" size={12} style={{ color: 'var(--accent-color)' }} />
                    <span>מנתח את הקשר הפסיכולוגי...</span>
                  </div>
                ) : linkExplanation ? (
                  <div>
                    <div style={{ padding: '10px', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', borderRight: '3px solid var(--accent-color)', fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {linkExplanation}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <Sparkles size={10} /> התובנה עודכנה בבסיס הידע באופן אוטומטי
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    לא ניתן לקבל הסבר ברגע זה
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="graph-instructions">
            <Info size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p style={{ fontSize: '0.8rem' }}>לחץ על צומת (Node) או קו (Edge) בגרף כדי לחקור את המידע.</p>
          </div>
        )}
      </div>

      {/* Main graph canvas */}
      <div className="graph-canvas-wrapper" ref={containerRef} style={{ position: 'relative' }}>
        {/* Floating Layout Selector */}
        {!loading && !error && (
          <div style={{ 
            position: 'absolute', 
            top: '16px', 
            left: '16px', 
            display: 'flex', 
            gap: '8px', 
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '4px',
            boxShadow: 'var(--shadow-sm)',
            direction: 'rtl'
          }}>
            <button
              onClick={() => setGraphMode('2d')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: graphMode === '2d' ? 'var(--accent-color)' : 'transparent',
                color: graphMode === '2d' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              דו-ממד (2D)
            </button>
            <button
              onClick={() => setGraphMode('3d')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: graphMode === '3d' ? 'var(--accent-color)' : 'transparent',
                color: graphMode === '3d' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              תלת-ממד (3D)
            </button>
          </div>
        )}

        {loading && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '0.9rem', color: 'var(--text-muted)' }}>טוען גרף ידע...</div>}
        {error && (
          <div style={{ 
            color: '#c53030', 
            padding: '20px',
            backgroundColor: '#fff5f5',
            borderRadius: 'var(--radius-md)',
            margin: '20px',
            fontSize: '0.85rem'
          }}>
            שגיאה בטעינת הגרף: {error}
          </div>
        )}
        
        {!loading && !error && graphMode === '2d' && (
          <ForceGraph2D
            ref={fgRef}
            graphData={finalGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor={node => getNodeColor(node, selectedNode && node.id === selectedNode.id)}
            nodeVal={node => getNodeRadius(node)}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onLinkClick={(link) => setSelectedLink(link)}
            linkWidth={link => (link.weight || 1) * 1.5}
            linkColor={getLinkColor}
            linkDirectionalParticles={link => (link.weight && link.weight > 1) ? 2 : 1}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={d => Math.max(0.005, (d.weight || 1) * 0.005)}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.name;
              const r = getNodeRadius(node);
              const isSelected = selectedNode && node.id === selectedNode.id;
              
              // Central (primary) node check: weight > 3 or selected
              const isPrimary = (node.weight && node.weight > 3) || isSelected;

              // Check if this node matches the search query directly (if searching)
              let isMatchingSearch = true;
              if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                isMatchingSearch = node.name.toLowerCase().includes(query) || (node.content && node.content.toLowerCase().includes(query));
              }

              // 1. Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
              
              if (isPrimary) {
                // Central: filled with node color
                ctx.fillStyle = isMatchingSearch ? getNodeColor(node, isSelected) : 'rgba(100, 100, 100, 0.25)';
                ctx.fill();
                
                ctx.strokeStyle = isSelected ? '#ffffff' : 'transparent';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              } else {
                // Secondary: Outline and dark center
                ctx.fillStyle = '#0f0f1a';
                ctx.fill();
                
                ctx.strokeStyle = isMatchingSearch ? getNodeColor(node, isSelected) : 'rgba(100, 100, 100, 0.25)';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Shadow effect for premium feel
              ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 2;
              
              // 2. Draw text label
              if (globalScale > 0.8 || isSelected || isPrimary) {
                const fontSize = 11 / globalScale;
                // Use Serif font for primary nodes, Sans-Serif for secondary nodes
                ctx.font = `${isPrimary ? 'bold' : 'normal'} ${fontSize}px var(--font-serif)`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Measure text
                const textWidth = ctx.measureText(label).width;
                const padX = 5 / globalScale;
                const padY = 3 / globalScale;
                const textY = node.y + r + 10 / globalScale;
                
                // Text background pill
                ctx.beginPath();
                ctx.roundRect(
                  node.x - textWidth/2 - padX, 
                  textY - fontSize/2 - padY, 
                  textWidth + padX*2, 
                  fontSize + padY*2, 
                  4 / globalScale
                );
                ctx.fillStyle = isMatchingSearch ? 'rgba(15, 15, 26, 0.85)' : 'rgba(15, 15, 26, 0.4)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 0.5 / globalScale;
                ctx.stroke();
                
                // Draw text
                ctx.fillStyle = isMatchingSearch ? '#e2e8f0' : 'rgba(226, 232, 240, 0.4)';
                ctx.fillText(label, node.x, textY);
              }
              
              // Reset shadow
              ctx.shadowColor = 'transparent';
            }}
          />
        )}

        {!loading && !error && graphMode === '3d' && (
          <ForceGraph3D
            ref={fgRef}
            graphData={finalGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor={node => getNodeColor(node, selectedNode && node.id === selectedNode.id)}
            nodeVal={node => getNodeRadius(node) * 1.5} // slightly larger spheres for better 3D visibility
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onLinkClick={(link) => setSelectedLink(link)}
            linkWidth={link => (link.weight || 1) * 1.5}
            linkColor={getLinkColor}
            linkDirectionalParticles={link => (link.weight && link.weight > 1) ? 2 : 1}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={d => Math.max(0.005, (d.weight || 1) * 0.005)}
          />
        )}
      </div>

      {/* Analysis Modal Overlay */}
      {showAnalysisModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px',
          direction: 'rtl'
        }}>
          <div style={{
            backgroundColor: 'var(--panel-bg)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--accent-light)'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)' }}>
                <Sparkles size={20} />
                ניתוח פערים פסיכולוגי בגרף הידע
              </h3>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              backgroundColor: 'var(--bg-primary)'
            }}>
              {analyzingGraph ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
                  <RefreshCw className="spin" size={32} style={{ color: 'var(--accent-color)' }} />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, textAlign: 'center' }}>
                    הבלש הדיגיטלי סורק את גרף המושגים שלך ומחפש תבניות, קשרים חסרים וקונפליקטים...
                  </div>
                </div>
              ) : graphAnalysisResult ? (
                <div style={{ textAlign: 'right' }}>
                  {renderMarkdown(graphAnalysisResult)}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  אין תוצאות להצגה.
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'var(--panel-bg)'
            }}>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent-color)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
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
