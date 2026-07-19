import React, { useMemo, useState, useEffect } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { Calendar, Info } from 'lucide-react';
import * as d3 from 'd3-force';

export default function SmallMultiplesView({ onNavigateToMonth }) {
  const {
    rawGraphData,
    allDatesSorted,
    loading,
    error,
    entries,
    setSelectedDateIndex
  } = useDiaryData();

  const [layoutData, setLayoutData] = useState(null);
  const [computing, setComputing] = useState(false);

  // Take the last 12 unique months available in the dates
  const targetMonths = useMemo(() => {
    if (!allDatesSorted || allDatesSorted.length === 0) return [];
    const uniqueMonths = new Set(allDatesSorted.map(d => d.substring(0, 7)));
    const monthsArr = Array.from(uniqueMonths).sort();
    return monthsArr.slice(-12);
  }, [allDatesSorted]);

  // Dimensions for each mini-graph
  const WIDTH = 250;
  const HEIGHT = 200;

  // Run a static layout simulation ONCE for all nodes
  useEffect(() => {
    if (loading || !rawGraphData.nodes.length || !targetMonths.length) return;

    setComputing(true);
    
    // We want a layout that encompasses all nodes that were active in ANY of the target months
    // But for simplicity and stability, we can just layout the entire rawGraphData and then filter visibility.
    // Deep clone nodes and links so we don't mutate the raw data
    const nodes = rawGraphData.nodes.map(n => ({ ...n }));
    
    // Ensure links use valid node IDs
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = rawGraphData.links
      .filter(l => nodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) && 
                   nodeIds.has(typeof l.target === 'object' ? l.target.id : l.target))
      .map(l => ({ ...l }));

    // Run simulation synchronously but unblock UI with a timeout
    const timer = setTimeout(() => {
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(20))
        .force('charge', d3.forceManyBody().strength(-30))
        .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
        .force('collide', d3.forceCollide().radius(5));

      // Fast-forward 300 ticks to settle the layout
      simulation.tick(300);
      simulation.stop();

      setLayoutData({ nodes, links });
      setComputing(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [rawGraphData, loading, targetMonths]);

  // Helper to determine if a link is active in a specific month
  const isLinkActiveInMonth = (link, monthStr) => {
    const monthStart = `${monthStr}-01`;
    const monthEnd = `${monthStr}-31`; // Approx

    if (link.valid_from) {
      if (link.valid_from > monthEnd) return false; // Hasn't opened yet
      if (link.valid_to && link.valid_to < monthStart) return false; // Closed before this month
      return true;
    }
    
    if (link.timestamp) {
      const linkDate = new Date(link.timestamp).toISOString().split('T')[0];
      if (linkDate > monthEnd) return false;
      return true;
    }
    
    return true; // Default assume active
  };

  // Helper to check sentiment for a link in a specific month based on entries
  const getLinkSentimentColor = (link, monthStr) => {
    // Collect all observations/mentions of this link in this month
    const monthEntries = entries.filter(entry => {
      const dateStr = entry.frontmatter?.date;
      if (!dateStr || dateStr === 'תאריך לא ידוע') return false;
      return dateStr.substring(0, 7) === monthStr;
    });

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    
    const sourceLower = sourceId.toLowerCase();
    const targetLower = targetId.toLowerCase();

    const matchingEntries = monthEntries.filter(entry => {
      const text = (entry.content || '').toLowerCase();
      const topics = (entry.frontmatter?.topics || []).map(t => t.toLowerCase());
      
      const hasSource = text.includes(sourceLower) || topics.includes(sourceLower);
      const hasTarget = text.includes(targetLower) || topics.includes(targetLower);
      
      return hasSource && hasTarget;
    });

    if (matchingEntries.length === 0) {
      // If it's active but not mentioned THIS month, render as a faded gray
      return { color: 'rgba(160, 174, 192, 0.15)', active: false };
    }

    let posCount = 0;
    let negCount = 0;

    const HEBREW_NEGATIVE_MOODS = ['לחץ', 'חרדה', 'עצב', 'כעס', 'תסכול', 'עומס', 'מתח', 'בדידות', 'דאגה'];
    const HEBREW_POSITIVE_MOODS = ['שמחה', 'רוגע', 'אהבה', 'התרגשות', 'סיפוק', 'שקט', 'טוב'];

    matchingEntries.forEach(entry => {
      const mood = (entry.frontmatter?.mood || 'ניטרלי').toLowerCase();
      if (HEBREW_NEGATIVE_MOODS.some(m => mood.includes(m))) negCount++;
      else if (HEBREW_POSITIVE_MOODS.some(m => mood.includes(m))) posCount++;
    });

    if (negCount > posCount) return { color: 'rgba(229, 62, 62, 0.9)', active: true, thick: true }; // Red
    if (posCount > negCount) return { color: 'rgba(72, 187, 120, 0.9)', active: true, thick: true }; // Green
    
    return { color: 'rgba(66, 153, 225, 0.6)', active: true, thick: false }; // Blue (Neutral)
  };

  const handleMonthClick = (monthStr) => {
    // Find the closest full date string that starts with this month, prefer the last day available
    const monthDates = allDatesSorted.filter(d => d.substring(0, 7) === monthStr);
    if (monthDates.length > 0) {
      const lastDateInMonth = monthDates[monthDates.length - 1];
      const index = allDatesSorted.indexOf(lastDateInMonth);
      if (index !== -1) {
        setSelectedDateIndex(index);
        if (onNavigateToMonth) {
          onNavigateToMonth();
        }
      }
    }
  };

  if (loading || computing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
        מחשב מיקומי רשת חודשיים...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#e53e3e', padding: '20px', textAlign: 'center' }}>
        שגיאה בטעינת נתונים: {error}
      </div>
    );
  }

  if (!layoutData) return null;

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Calendar size={24} style={{ color: 'var(--accent-color)' }} />
        <h2 style={{ fontSize: '1.4rem', margin: 0 }}>רשת זמנים (Small Multiples)</h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--panel-bg)', color: 'var(--text-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '0.85rem' }}>
        <Info size={16} style={{ color: 'var(--accent-color)' }} />
        <span>מציג את התפתחות רשת הידע שלך לאורך {targetMonths.length} החודשים האחרונים. קואורדינטות הצמתים <strong>קבועות</strong>, כך שניתן לזהות בקלות שינויי צפיפות ומגמות. קשתות שדובר עליהן בהקשר חיובי הן <strong style={{ color: '#48bb78' }}>ירוקות</strong> ובשלילי <strong style={{ color: '#e53e3e' }}>אדומות</strong>. קשתות ישנות צבועות באפור. לחץ על גרף כדי לצלול לאותו חודש.</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {targetMonths.map((monthStr, idx) => (
          <div 
            key={monthStr}
            onClick={() => handleMonthClick(monthStr)}
            style={{
              backgroundColor: 'var(--panel-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              position: 'relative'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = 'var(--accent-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '2px 8px',
              borderRadius: '4px',
              backdropFilter: 'blur(4px)'
            }}>
              {monthStr}
            </div>

            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="200px" style={{ display: 'block' }}>
              {/* Draw Links */}
              {layoutData.links.map((link, lIdx) => {
                if (!isLinkActiveInMonth(link, monthStr)) return null;
                
                const { color, active, thick } = getLinkSentimentColor(link, monthStr);
                
                return (
                  <line
                    key={`link-${lIdx}`}
                    x1={link.source.x}
                    y1={link.source.y}
                    x2={link.target.x}
                    y2={link.target.y}
                    stroke={color}
                    strokeWidth={active ? (thick ? 2.5 : 1.5) : 0.5}
                    opacity={active ? 1.0 : 0.4}
                  />
                );
              })}

              {/* Draw Nodes */}
              {layoutData.nodes.map((node, nIdx) => (
                <circle
                  key={`node-${nIdx}`}
                  cx={node.x}
                  cy={node.y}
                  r={2.5}
                  fill="var(--text-secondary)"
                  opacity={0.5}
                />
              ))}
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
