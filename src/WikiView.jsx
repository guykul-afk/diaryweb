import React, { useState, useMemo } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { Search, Hash, Heart, User, Sparkles, ArrowLeftRight, FileText, ArrowLeft } from 'lucide-react';

export default function WikiView({ onNavigateToEntry }) {
  const {
    filteredNodes,
    filteredLinks,
    conceptMetadataMap,
    getNodeType,
    searchQuery, setSearchQuery,
    limitEntities, setLimitEntities,
    visibleTypes, setVisibleTypes
  } = useDiaryData();

  // Selected Wiki Page Entity ID
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    return filteredNodes[0]?.id || null;
  });

  // Safe selected node
  const activeNode = useMemo(() => {
    if (!selectedNodeId) return filteredNodes[0] || null;
    return filteredNodes.find(n => n.id === selectedNodeId) || filteredNodes[0] || null;
  }, [selectedNodeId, filteredNodes]);

  // Derived properties of the active node
  const pageDetails = useMemo(() => {
    if (!activeNode) return null;
    const nodeId = activeNode.id;
    const nodeIdLower = nodeId.toLowerCase();
    
    // Get entry mentions
    const meta = conceptMetadataMap[nodeIdLower] || { topics: new Set(), moods: new Set(), entries: [] };
    
    // Find all links involving this node
    const relatedLinks = filteredLinks.filter(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      return s === nodeId || t === nodeId;
    });

    // Group related nodes by sentiment
    const positiveConnections = [];
    const negativeConnections = [];
    const neutralConnections = [];

    relatedLinks.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      const otherId = s === nodeId ? t : s;
      const otherNode = filteredNodes.find(n => n.id === otherId);
      
      if (!otherNode) return;

      const connection = {
        id: otherId,
        name: otherNode.name || otherId,
        type: getNodeType(otherNode),
        label: link.label,
        sentiment: link.sentimentScore || 0
      };

      if (link.sentimentScore > 0) {
        positiveConnections.push(connection);
      } else if (link.sentimentScore < 0) {
        negativeConnections.push(connection);
      } else {
        neutralConnections.push(connection);
      }
    });

    return {
      type: getNodeType(activeNode),
      entries: meta.entries || [],
      positive: positiveConnections,
      negative: negativeConnections,
      neutral: neutralConnections
    };
  }, [activeNode, filteredNodes, filteredLinks, conceptMetadataMap]);

  // Node type icon helper
  const getTypeIcon = (type) => {
    switch (type) {
      case 'Person': return <User size={16} style={{ color: '#48bb78' }} />;
      case 'Topic': return <Hash size={16} style={{ color: '#9f7aea' }} />;
      case 'Emotion': return <Heart size={16} style={{ color: '#ed64a6' }} />;
      default: return <Sparkles size={16} style={{ color: '#3182ce' }} />;
    }
  };

  const getNodeBadgeColor = (type) => {
    switch (type) {
      case 'Person': return 'rgba(72, 187, 120, 0.15)';
      case 'Topic': return 'rgba(159, 122, 234, 0.15)';
      case 'Emotion': return 'rgba(237, 100, 166, 0.15)';
      default: return 'rgba(49, 130, 206, 0.15)';
    }
  };

  return (
    <div className="graph-container" style={{ direction: 'rtl', height: '100%', display: 'flex', overflow: 'hidden' }}>
      
      {/* Right Sidebar: Index of Pages */}
      <div className="graph-sidebar" style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', height: '100%' }}>
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>אינדקס ישויות (Obsidian Wiki)</h3>
          
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="חפש דף..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {[
              { type: 'Concept', label: 'מושגים' },
              { type: 'Person', label: 'שמות' },
              { type: 'Topic', label: 'נושאים' },
              { type: 'Emotion', label: 'רגשות' }
            ].map(item => {
              const checked = visibleTypes.includes(item.type);
              return (
                <button
                  key={item.type}
                  onClick={() => setVisibleTypes(prev => prev.includes(item.type) ? prev.filter(t => t !== item.type) : [...prev, item.type])}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)',
                    background: checked ? 'var(--accent-light)' : 'transparent',
                    color: checked ? 'var(--accent-color)' : 'var(--text-muted)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontWeight: checked ? 600 : 400
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Index Page List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filteredNodes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.85rem' }}>לא נמצאו דפים תואמים לסינון</div>
          ) : (
            filteredNodes.map(node => {
              const isSelected = activeNode && node.id === activeNode.id;
              const type = getNodeType(node);
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(0, 53, 95, 0.05)' : 'transparent',
                    color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getTypeIcon(type)}
                    <span style={{ fontSize: '0.85rem' }}>{node.name || node.id}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>w:{node.weight}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Wiki Page Panel */}
      <div style={{ flexGrow: 1, height: '100%', overflowY: 'auto', padding: '32px', backgroundColor: 'var(--bg-primary)' }}>
        {activeNode ? (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header */}
            <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    background: getNodeBadgeColor(pageDetails.type)
                  }}
                >
                  {getTypeIcon(pageDetails.type)}
                  {pageDetails.type}
                </span>
              </div>
              <h1 style={{ fontSize: '2.2rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeNode.name || activeNode.id}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                מזהה רשומה: <code>[[{activeNode.id}]]</code> • חשיבות במאגר: {activeNode.weight}
              </p>
            </div>

            {/* Content Section */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>תיאור / תוכן:</h3>
              <div 
                style={{ 
                  padding: '16px', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: 'var(--panel-bg)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {activeNode.content ? activeNode.content : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>אין הגדרה מורחבת עבור מושג זה.</span>}
              </div>
            </div>

            {/* Connections Grid */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>רשת הקשרים סמנטית:</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Positive (Healing / Supportive) */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'var(--panel-bg)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#48bb78', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>מרפא / תומך ↑</span>
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {pageDetails.positive.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>אין קשרים חיוביים ישירים</span>
                    ) : (
                      pageDetails.positive.map((conn, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedNodeId(conn.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            border: '1px solid #48bb78',
                            background: 'rgba(72, 187, 120, 0.05)',
                            color: '#2f855a',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {getTypeIcon(conn.type)}
                          <strong>{conn.name}</strong> <span style={{ opacity: 0.7 }}>({conn.label})</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Negative (Stressful / Load) */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'var(--panel-bg)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#e53e3e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>מלחיץ / מעכב ↓</span>
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {pageDetails.negative.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>אין קשרים מעכבים ישירים</span>
                    ) : (
                      pageDetails.negative.map((conn, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedNodeId(conn.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            border: '1px solid #e53e3e',
                            background: 'rgba(229, 62, 62, 0.05)',
                            color: '#9b2c2c',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {getTypeIcon(conn.type)}
                          <strong>{conn.name}</strong> <span style={{ opacity: 0.7 }}>({conn.label})</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Neutral / Other Connections */}
              {pageDetails.neutral.length > 0 && (
                <div style={{ marginTop: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', backgroundColor: 'var(--panel-bg)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>קשרים נוספים:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {pageDetails.neutral.map((conn, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedNodeId(conn.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          border: '1.5px dashed var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {getTypeIcon(conn.type)}
                        <strong>{conn.name}</strong> <span style={{ opacity: 0.7 }}>({conn.label})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Backlinks & Quotes (Journal mentions) */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>מוזכר ביומן (Backlinks):</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pageDetails.entries.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>אין אזכורים ישירים ברשומות היומן הנוכחיות.</div>
                ) : (
                  pageDetails.entries.map((entry, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '12px 16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--panel-bg)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📄</span>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>רשומה מתאריך: {entry.date}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigateToEntry && onNavigateToEntry(entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-color)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'underline'
                        }}
                      >
                        פתח רשומה מלאה
                        <ArrowLeft size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
            <h2>אין דפים זמינים בארכיון</h2>
            <p>נסה לאפס את הסינונים כדי למצוא דפים.</p>
          </div>
        )}
      </div>

    </div>
  );
}
