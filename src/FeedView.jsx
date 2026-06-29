import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Tag, RefreshCw, Search, BookOpen } from 'lucide-react';
import { fetchFirebaseEntries, fetchFirebaseGraph } from './firebase';
import LocalGraph from './LocalGraph';

export default function FeedView({ dataSource, uid, selectedEntryId, onSelectEntry }) {
  const [entries, setEntries] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'heatmap'

  // Map of entries by YYYY-MM-DD
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      if (e.frontmatter.date) {
        map[e.frontmatter.date] = e;
      }
    });
    return map;
  }, [entries]);

  // Generate 12 months for the heatmap (ending in the current month)
  const heatmapMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday...
      months.push({
        year,
        month,
        daysInMonth,
        firstDayOfWeek,
        name: d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
      });
    }
    return months;
  }, []);

  const getMoodColor = (mood) => {
    if (!mood) return 'rgba(148, 163, 184, 0.1)';
    const m = mood.toLowerCase();
    if (m.includes('שמח') || m.includes('טוב') || m.includes('אהב') || m.includes('רוגע') || m.includes('חיובי') || m.includes('joy') || m.includes('happy') || m.includes('calm') || m.includes('love') || m.includes('peace') || m.includes('בטוח')) {
      return '#22c55e'; // Green
    }
    if (m.includes('עצב') || m.includes('בדידות') || m.includes('דאגה') || m.includes('ספק') || m.includes('sad') || m.includes('worr') || m.includes('lonel')) {
      return '#3b82f6'; // Blue
    }
    if (m.includes('לחץ') || m.includes('חרד') || m.includes('עומס') || m.includes('מתח') || m.includes('תסכול') || m.includes('כעס') || m.includes('פחד') || m.includes('stress') || m.includes('anxiety') || m.includes('frust') || m.includes('angr') || m.includes('fear')) {
      return '#ef4444'; // Red
    }
    return '#f59e0b'; // Amber (neutral/other)
  };

  const formatDateString = (year, month, day) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const fetchEntriesAndGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!uid) {
        throw new Error('חיבור לפיירבייס לא אותחל עדיין. אנא המתן...');
      }
      const [entriesData, graphDataRes] = await Promise.all([
        fetchFirebaseEntries(uid),
        fetchFirebaseGraph(uid)
      ]);
      setEntries(entriesData);
      setGraphData(graphDataRes);

      // Auto-select first entry if none selected
      if (entriesData.length > 0 && !selectedEntryId) {
        onSelectEntry(entriesData[0].id);
      }
    } catch (err) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      fetchEntriesAndGraph();
    }
  }, [uid]);

  // Sync selectedEntryId if it changes and is not in filtered list, or set default
  const selectedEntry = useMemo(() => {
    return entries.find(e => e.id === selectedEntryId) || null;
  }, [entries, selectedEntryId]);

  // Calculate the min/max dates and sort them for the timeline
  const dateRange = useMemo(() => {
    if (entries.length === 0) return { min: 0, max: 0, list: [] };
    const list = entries
      .map(e => ({
        id: e.id,
        dateStr: e.frontmatter.date,
        time: new Date(e.frontmatter.date).getTime()
      }))
      .filter(e => !isNaN(e.time))
      .sort((a, b) => a.time - b.time); // Oldest to newest
      
    if (list.length === 0) return { min: 0, max: 0, list: [] };
    return {
      min: list[0].time,
      max: list[list.length - 1].time,
      list
    };
  }, [entries]);

  // Sync slider value when entries load
  useEffect(() => {
    if (dateRange.list.length > 0) {
      setSliderValue(dateRange.max); // Default to the newest entry
    }
  }, [dateRange]);

  const handleSliderChange = (e) => {
    const targetTime = parseInt(e.target.value);
    setSliderValue(targetTime);
    
    if (dateRange.list.length === 0) return;
    
    // Find closest entry
    let closestEntry = dateRange.list[0];
    let minDiff = Math.abs(dateRange.list[0].time - targetTime);
    
    for (let i = 1; i < dateRange.list.length; i++) {
      const diff = Math.abs(dateRange.list[i].time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestEntry = dateRange.list[i];
      }
    }
    
    onSelectEntry(closestEntry.id);
  };

  const formatSliderDate = (time) => {
    if (!time) return '';
    return new Date(time).toISOString().split('T')[0];
  };

  // Client-side filtering by name, mood, hashtag, or keyword
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase().trim();
    
    return entries.filter(entry => {
      const contentMatch = (entry.content || '').toLowerCase().includes(query);
      const topicsMatch = entry.frontmatter.topics && 
        entry.frontmatter.topics.some(topic => topic.toLowerCase().includes(query));
      const moodMatch = entry.frontmatter.mood && 
        entry.frontmatter.mood.toLowerCase().includes(query);
      const triplesMatch = entry.frontmatter.triples && 
        entry.frontmatter.triples.some(t => {
          const s = (t.subject || t.s || '').toLowerCase();
          const o = (t.object || t.o || '').toLowerCase();
          const r = (t.relation || t.r || '').toLowerCase();
          return s.includes(query) || o.includes(query) || r.includes(query);
        });
        
      return contentMatch || topicsMatch || moodMatch || triplesMatch;
    });
  }, [entries, searchQuery]);

  return (
    <div style={{ display: 'flex', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
      
      {/* 1. Middle Column: Timeline Pane */}
      <aside className="timeline-pane">
        {/* Header Section */}
        <div style={{ 
          padding: '16px 20px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} />
            רשומות יומן ({filteredEntries.length})
          </h2>
          <button 
            onClick={fetchEntriesAndGraph}
            style={{ 
              background: 'none', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-sm)', 
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
            title="רענן מידע"
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <input
            type="text"
            placeholder="חפש מושג, רגש או #נושא..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 36px 8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: 'var(--bg-color)',
              boxSizing: 'border-box',
              textAlign: 'right'
            }}
          />
          <Search size={14} style={{ position: 'absolute', right: '26px', top: '20px', color: 'var(--text-muted)' }} />
        </div>

        {/* View Mode Toggle */}
        <div style={{ 
          padding: '8px 16px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          gap: '8px',
          backgroundColor: 'var(--panel-bg)'
        }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: viewMode === 'list' ? 'var(--accent-light)' : 'transparent',
              color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            רשימה כרונולוגית
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: viewMode === 'heatmap' ? 'var(--accent-light)' : 'transparent',
              color: viewMode === 'heatmap' ? 'var(--accent-color)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            מפת חום שנתית
          </button>
        </div>

        {/* Slider Section */}
        {viewMode === 'list' && !loading && !error && dateRange.list.length > 1 && (
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{formatSliderDate(dateRange.min)}</span>
              <span style={{ fontWeight: 600 }}>{formatSliderDate(sliderValue)}</span>
              <span>{formatSliderDate(dateRange.max)}</span>
            </div>
            <input
              type="range"
              min={dateRange.min}
              max={dateRange.max}
              value={sliderValue}
              onChange={handleSliderChange}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: 'var(--accent-color)',
                height: '4px'
              }}
            />
          </div>
        )}

        {/* Timeline Entries List */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px' }}>
          {loading && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>טוען רשומות...</div>}
          {error && <div style={{ padding: '12px', color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}
          
          {!loading && !error && viewMode === 'list' && filteredEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>לא נמצאו רשומות.</div>
          )}

          {!loading && !error && viewMode === 'list' && filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedEntryId;
            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '1px solid var(--accent-color)' : '1px solid transparent',
                  backgroundColor: isSelected ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  transition: 'all 0.15s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {entry.frontmatter.date}
                  </span>
                  {entry.frontmatter.mood && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      רגש: {entry.frontmatter.mood}
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {entry.content ? entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : '') : 'רשומה ללא כותרת'}
                </div>
                {entry.frontmatter.topics && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {entry.frontmatter.topics.slice(0, 3).map((topic, idx) => (
                      <span 
                        key={idx} 
                        style={{ 
                          fontSize: '0.65rem', 
                          padding: '2px 6px', 
                          borderRadius: '10px', 
                          backgroundColor: isSelected ? '#ffffff' : 'var(--accent-light)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && !error && viewMode === 'heatmap' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', direction: 'rtl', padding: '4px' }}>
              {heatmapMonths.map((m) => {
                const cells = [];
                const weekdays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
                
                // Add empty padding days for offset
                for (let i = 0; i < m.firstDayOfWeek; i++) {
                  cells.push(<div key={`empty-${i}`} style={{ aspectRatio: '1/1' }} />);
                }
                
                // Add actual days
                for (let day = 1; day <= m.daysInMonth; day++) {
                  const dateStr = formatDateString(m.year, m.month, day);
                  const entry = entriesByDate[dateStr];
                  const isSelected = entry && entry.id === selectedEntryId;
                  
                  // Check if entry matches search query (if any)
                  let isMatchingSearch = true;
                  if (searchQuery.trim() && entry) {
                    const query = searchQuery.toLowerCase().trim();
                    const contentMatch = (entry.content || '').toLowerCase().includes(query);
                    const topicsMatch = entry.frontmatter.topics && 
                      entry.frontmatter.topics.some(topic => topic.toLowerCase().includes(query));
                    const moodMatch = entry.frontmatter.mood && 
                      entry.frontmatter.mood.toLowerCase().includes(query);
                    isMatchingSearch = contentMatch || topicsMatch || moodMatch;
                  }
                  
                  cells.push(
                    <div
                      key={`day-${day}`}
                      onClick={() => entry && onSelectEntry(entry.id)}
                      title={entry ? `${dateStr} - רגש: ${entry.frontmatter.mood || 'לא מוגדר'}\n${entry.content.substring(0, 80)}...` : dateStr}
                      style={{
                        aspectRatio: '1/1',
                        borderRadius: '4px',
                        backgroundColor: entry 
                          ? (isMatchingSearch ? getMoodColor(entry.frontmatter.mood) : 'rgba(148, 163, 184, 0.15)') 
                          : 'rgba(148, 163, 184, 0.05)',
                        border: isSelected 
                          ? '2px solid var(--text-primary)' 
                          : entry 
                            ? '1px solid rgba(0,0,0,0.05)' 
                            : '1px solid transparent',
                        cursor: entry ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: entry ? '700' : '400',
                        color: entry ? '#ffffff' : 'var(--text-muted)',
                        position: 'relative',
                        opacity: searchQuery.trim() && entry && !isMatchingSearch ? 0.3 : 1,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {day}
                      {entry && (
                        <span style={{
                          position: 'absolute',
                          bottom: '2px',
                          width: '3px',
                          height: '3px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff'
                        }} />
                      )}
                    </div>
                  );
                }
                
                return (
                  <div key={`${m.year}-${m.month}`} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textAlign: 'right' }}>
                      {m.name}
                    </div>
                    {/* Weekday headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px', textAlign: 'center' }}>
                      {weekdays.map((w, idx) => (
                        <div key={idx} style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>{w}</div>
                      ))}
                    </div>
                    {/* Days grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                      {cells}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* 2. Left Column: Reader Pane */}
      <main className="reader-pane">
        {selectedEntry ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
            {/* Header / Date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {selectedEntry.frontmatter.date}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedEntry.frontmatter.topics && selectedEntry.frontmatter.topics.map((topic, i) => (
                  <span 
                    key={i} 
                    style={{ 
                      fontSize: '0.75rem', 
                      backgroundColor: 'var(--panel-bg)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-sm)', 
                      padding: '4px 8px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Entry Content Body */}
            <article style={{ 
              fontSize: '1rem', 
              lineHeight: '1.75', 
              color: 'var(--text-secondary)', 
              whiteSpace: 'pre-wrap', 
              fontFamily: 'var(--font-sans)'
            }}>
              {selectedEntry.content}
            </article>

            {/* Open Threads / Actions */}
            {selectedEntry.frontmatter.open_threads && selectedEntry.frontmatter.open_threads.length > 0 && (
              <div style={{ 
                marginTop: '16px', 
                backgroundColor: 'var(--panel-bg)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-lg)', 
                padding: '16px' 
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  נושאים פתוחים / משימות:
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {selectedEntry.frontmatter.open_threads.map((thread, idx) => (
                    <li key={idx} style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      {thread}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <BookOpen size={48} style={{ color: 'var(--border-color)' }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>בחר רשומה מציר הזמן כדי לצפות בפרטים ובקשרים שלה</div>
          </div>
        )}
      </main>
    </div>
  );
}
