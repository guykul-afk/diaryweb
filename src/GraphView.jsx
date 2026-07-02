import React, { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import { Info, Search, Filter, Hash, Heart } from 'lucide-react';
import { fetchFirebaseGraph, fetchFirebaseEntries, triggerGraphAnalysis } from './firebase';
import { forceCollide } from 'd3-force';

export default function GraphView({ dataSource, uid, onNavigateToEntry }) {
  const [rawGraphData, setRawGraphData] = useState({ nodes: [], links: [] });
  const [entries, setEntries] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [graphMode, setGraphMode] = useState('2d'); // '2d' or '3d'

  const getLinkColor = (link) => {
    if (selectedLink && link === selectedLink) return '#ff6b6b';
    if (link.sentimentScore > 0) return 'rgba(72, 187, 120, 0.6)';
    if (link.sentimentScore < 0) return 'rgba(229, 62, 62, 0.6)';
    return '#E0E0E0';
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [minWeight, setMinWeight] = useState(1);
  const [visibleTypes, setVisibleTypes] = useState(['Concept', 'Person', 'Topic', 'Emotion']);
  const [minDegree, setMinDegree] = useState(0);
  const [minLinkWeight, setMinLinkWeight] = useState(1);
  const [egoDepth, setEgoDepth] = useState(1);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!uid) {
        throw new Error('אנא הגדר מזהה משתמש (UID) כדי להתחבר לפיירבייס.');
      }
      const [graphData, entriesData] = await Promise.all([
        fetchFirebaseGraph(uid),
        fetchFirebaseEntries(uid)
      ]);
      
      setRawGraphData(graphData);
      setEntries(entriesData);
    } catch (err) {
      setError(err.message);
      setRawGraphData({ nodes: [], links: [] });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataSource, uid]);

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

  // Extract unique topics and moods for filter options
  const uniqueTopics = useMemo(() => {
    const topics = new Set();
    entries.forEach(e => {
      if (e.frontmatter.topics) {
        e.frontmatter.topics.forEach(t => topics.add(t));
      }
    });
    return Array.from(topics);
  }, [entries]);

  const uniqueMoods = useMemo(() => {
    const moods = new Set();
    entries.forEach(e => {
      if (e.frontmatter.mood) moods.add(e.frontmatter.mood);
    });
    return Array.from(moods);
  }, [entries]);

  const allDatesSorted = useMemo(() => {
    const dates = entries
      .map(e => e.frontmatter.date)
      .filter(d => d && d !== 'תאריך לא ידוע')
      .sort();
    return Array.from(new Set(dates));
  }, [entries]);

  useEffect(() => {
    if (allDatesSorted.length > 0) {
      setSelectedDateIndex(allDatesSorted.length - 1);
    }
  }, [allDatesSorted]);

  const rawNodeDegrees = useMemo(() => {
    const degrees = {};
    rawGraphData.nodes.forEach(n => { degrees[n.id] = 0; });
    rawGraphData.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (degrees[s] !== undefined) degrees[s]++;
      if (degrees[t] !== undefined) degrees[t]++;
    });
    return degrees;
  }, [rawGraphData]);

  const hasLinkWeight = useMemo(() => {
    return rawGraphData.links.some(l => l.weight !== undefined || l.val !== undefined || l.strength !== undefined || l.value !== undefined);
  }, [rawGraphData]);

  // Dynamic helper to identify node types
  const getNodeType = (node) => {
    const type = (node.type || '').toLowerCase();
    if (type === 'person' || type === 'people' || type === 'name' || node.id.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/)) return 'Person';
    if (type === 'emotion' || type === 'mood' || type === 'feeling') return 'Emotion';
    if (type === 'topic' || type === 'hashtag') return 'Topic';

    const nodeIdLower = node.id.toLowerCase();
    const nodeLabelLower = (node.name || node.id).toLowerCase();
    const HEBREW_PERSON_NAMES = ['גיא', 'טלי', 'גיל', 'איתן', 'יוגב', 'שמואל', 'נוה', 'נווה', 'אבא', 'אמא', 'אימא', 'אסף', 'ילדים', 'הילדים', 'בן של'];
    const HEBREW_EMOTION_KEYWORDS = ['לחץ', 'חרדה', 'עצב', 'כעס', 'שמחה', 'פחד', 'דאגה', 'אהבה', 'תסכול', 'עומס', 'מתח', 'רגש'];

    if (HEBREW_PERSON_NAMES.some(name => nodeIdLower.includes(name) || nodeLabelLower.includes(name))) return 'Person';
    if (HEBREW_EMOTION_KEYWORDS.some(keyword => nodeIdLower.includes(keyword) || nodeLabelLower.includes(keyword))) return 'Emotion';
    
    // Check if node is listed in entry topics or moods
    if (uniqueTopics.some(t => t.toLowerCase() === node.id.toLowerCase())) return 'Topic';
    if (uniqueMoods.some(m => m.toLowerCase() === node.id.toLowerCase())) return 'Emotion';
    
    return 'Concept';
  };

  // Map concepts to their associated entry topics, moods, and entries list
  const conceptMetadataMap = useMemo(() => {
    const map = {};
    
    rawGraphData.nodes.forEach(node => {
      map[node.id.toLowerCase()] = {
        topics: new Set(),
        moods: new Set(),
        entries: []
      };
    });

    entries.forEach(entry => {
      const entryText = (entry.content || '').toLowerCase();
      const entryTopics = entry.frontmatter.topics || [];
      const entryMood = entry.frontmatter.mood || 'ניטרלי';

      rawGraphData.nodes.forEach(node => {
        const nodeIdLower = node.id.toLowerCase();
        const nodeNameLower = node.name.toLowerCase();
        
        const isMentioned = entryText.includes(nodeNameLower) || 
                            entryText.includes(nodeIdLower);

        if (isMentioned) {
          entryTopics.forEach(t => map[nodeIdLower]?.topics.add(t));
          map[nodeIdLower]?.moods.add(entryMood);
          if (!map[nodeIdLower]?.entries.some(e => e.id === entry.id)) {
            map[nodeIdLower]?.entries.push({ id: entry.id, date: entry.frontmatter.date });
          }
        }
      });
    });

    return map;
  }, [rawGraphData.nodes, entries]);

  // Apply filters to graph data
  const filteredGraphData = useMemo(() => {
    const maxDateStr = allDatesSorted[selectedDateIndex];

    // 1. Filter nodes by base filters (type, weight, topics, moods, date range, degree)
    const baseFilteredNodes = rawGraphData.nodes.filter(node => {
      const type = getNodeType(node);
      
      // Node Type Filter
      if (!visibleTypes.includes(type)) return false;

      const nodeIdLower = node.id.toLowerCase();
      const metadata = conceptMetadataMap[nodeIdLower] || { topics: new Set(), moods: new Set(), entries: [] };

      // Weight Filter
      if (node.weight < minWeight) return false;

      // Degree Filter
      const degree = rawNodeDegrees[node.id] || 0;
      if (degree < minDegree) return false;

      // Date Range Filter (timeline slider) - only filter if the user has moved the slider away from the maximum/latest date
      if (allDatesSorted.length > 0 && maxDateStr && selectedDateIndex < allDatesSorted.length - 1) {
        const nodeEntries = metadata.entries || [];
        const hasEntryInVal = nodeEntries.some(e => e.date && e.date <= maxDateStr);
        if (!hasEntryInVal) return false;
      }

      // Topics Filter
      if (selectedTopics.length > 0) {
        const hasMatchingTopic = selectedTopics.some(t => metadata.topics.has(t));
        if (!hasMatchingTopic) return false;
      }

      // Moods Filter
      if (selectedMoods.length > 0) {
        const hasMatchingMood = selectedMoods.some(m => metadata.moods.has(m));
        if (!hasMatchingMood) return false;
      }

      return true;
    });

    const baseFilteredNodeIds = new Set(baseFilteredNodes.map(n => n.id));
    let finalActiveNodeIds = new Set();

    // 2. If searching, find primary matches and also keep their direct neighbors
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const primaryMatchingNodes = baseFilteredNodes.filter(node => 
        node.name.toLowerCase().includes(query) || 
        (node.content && node.content.toLowerCase().includes(query))
      );
      
      const primaryIds = new Set(primaryMatchingNodes.map(n => n.id));
      
      // Look at all links to add direct neighbors of primary nodes
      rawGraphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        
        if (primaryIds.has(sourceId) && baseFilteredNodeIds.has(targetId)) {
          finalActiveNodeIds.add(sourceId);
          finalActiveNodeIds.add(targetId);
        }
        if (primaryIds.has(targetId) && baseFilteredNodeIds.has(sourceId)) {
          finalActiveNodeIds.add(sourceId);
          finalActiveNodeIds.add(targetId);
        }
      });

      // Always include matching primary nodes even if they have no links
      primaryIds.forEach(id => finalActiveNodeIds.add(id));
    } else {
      finalActiveNodeIds = baseFilteredNodeIds;
    }

    // 2.5 Ego Network filter - if a node is selected, keep only it and its neighbors up to egoDepth
    if (selectedNode) {
      const selectedId = selectedNode.id;
      const egoIds = new Set([selectedId]);
      let currentLevel = new Set([selectedId]);
      
      for (let i = 0; i < egoDepth; i++) {
        const nextLevel = new Set();
        rawGraphData.links.forEach(link => {
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

      const intersectedIds = new Set();
      finalActiveNodeIds.forEach(id => {
        if (egoIds.has(id)) intersectedIds.add(id);
      });
      finalActiveNodeIds = intersectedIds;
    }

    const filteredNodes = rawGraphData.nodes.filter(node => finalActiveNodeIds.has(node.id));

    // 3. Filter links (keep links between active nodes)
    const filteredLinks = rawGraphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      // If searching, only keep links where at least one endpoint is a primary search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const sourceNode = rawGraphData.nodes.find(n => n.id === sourceId);
        const targetNode = rawGraphData.nodes.find(n => n.id === targetId);
        
        const sourceMatches = sourceNode && (sourceNode.name.toLowerCase().includes(query) || (sourceNode.content && sourceNode.content.toLowerCase().includes(query)));
        const targetMatches = targetNode && (targetNode.name.toLowerCase().includes(query) || (targetNode.content && targetNode.content.toLowerCase().includes(query)));
        
        if (!sourceMatches && !targetMatches) return false;
      }

      // Link weight filter
      if (hasLinkWeight) {
        const w = link.weight || link.val || link.strength || link.value || 1;
        if (w < minLinkWeight) return false;
      }
      
      return finalActiveNodeIds.has(sourceId) && finalActiveNodeIds.has(targetId);
    });

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }, [rawGraphData, searchQuery, selectedTopics, selectedMoods, minWeight, visibleTypes, conceptMetadataMap, selectedNode, minDegree, minLinkWeight, egoDepth, selectedDateIndex, allDatesSorted, rawNodeDegrees, hasLinkWeight]);

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
      fgRef.current.d3Force('charge').strength(-120);
      fgRef.current.d3Force('link').distance(65);
      // Dynamic collision detection to match the new size variance
      fgRef.current.d3Force('collision', forceCollide(node => getNodeRadius(node) + 12));
    }
  }, [filteredGraphData]);

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

  // Node Color scheme helper
  const getNodeColor = (node, isSelected) => {
    if (isSelected) return '#ff6b6b';
    const type = getNodeType(node);
    switch (type) {
      case 'Person': return '#48bb78';  // Green
      case 'Topic': return '#9f7aea';   // Purple
      case 'Emotion': return '#ed64a6'; // Pink
      default: return '#3182ce';        // Blue (Concept)
    }
  };

  return (
    <div className="graph-container">
      {/* Sidebar Controls & Inspector */}
      <div className="graph-sidebar">
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
                {filteredGraphData.links
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
            graphData={filteredGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor={node => ((node.weight && node.weight > 3) || (selectedNode && node.id === selectedNode.id) ? '#00355F' : '#FFFFFF')}
            nodeVal={node => getNodeRadius(node)}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onLinkClick={(link) => setSelectedLink(link)}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkWidth={1.5}
            linkColor={getLinkColor}
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
                // Central: filled with blue #00355F
                ctx.fillStyle = isMatchingSearch ? '#00355F' : 'rgba(0, 53, 95, 0.25)';
                ctx.fill();
                
                ctx.strokeStyle = isSelected ? '#ff6b6b' : 'transparent';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              } else {
                // Secondary: Outline and white center
                ctx.fillStyle = '#FFFFFF';
                ctx.fill();
                
                ctx.strokeStyle = isMatchingSearch ? '#00355F' : 'rgba(0, 53, 95, 0.25)';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Shadow effect for premium feel
              ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
              ctx.shadowBlur = 4;
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
                ctx.fillStyle = isMatchingSearch ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 53, 95, 0.05)';
                ctx.lineWidth = 0.5 / globalScale;
                ctx.stroke();
                
                // Draw text
                ctx.fillStyle = isMatchingSearch ? '#1A1A1A' : 'rgba(26, 26, 26, 0.4)';
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
            graphData={filteredGraphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel="name"
            nodeColor={node => getNodeColor(node, selectedNode && node.id === selectedNode.id)}
            nodeVal={node => getNodeRadius(node) * 1.5} // slightly larger spheres for better 3D visibility
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => { setSelectedNode(null); setSelectedLink(null); }}
            onLinkClick={(link) => setSelectedLink(link)}
            linkWidth={1.5}
            linkColor={getLinkColor}
          />
        )}
      </div>
    </div>
  );
}
