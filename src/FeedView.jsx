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
      return '#005f9e'; // Medium Blue
    }
    if (m.includes('עצב') || m.includes('בדידות') || m.includes('דאגה') || m.includes('ספק') || m.includes('sad') || m.includes('worr') || m.includes('lonel')) {
      return '#2b78b0'; // Steel Blue
    }
    if (m.includes('לחץ') || m.includes('חרד') || m.includes('עומס') || m.includes('מתח') || m.includes('תסכול') || m.includes('כעס') || m.includes('פחד') || m.includes('stress') || m.includes('anxiety') || m.includes('frust') || m.includes('angr') || m.includes('fear')) {
      return '#00355f'; // Primary Blue
    }
    return '#708a9f'; // Blue-Gray (neutral/other)
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

  // Scroll active entry into view in the main pane
  useEffect(() => {
    if (selectedEntryId) {
      const element = document.getElementById(`entry-card-${selectedEntryId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedEntryId]);

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
      
      <main className="reader-pane" style={{ overflowY: 'auto', flexGrow: 1, padding: '24px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
          {filteredEntries.map(entry => {
            const isSelected = entry.id === selectedEntryId;
            return (
              <div 
                key={entry.id} 
                id={`entry-card-${entry.id}`}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px', 
                  padding: '24px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--panel-bg)',
                  border: isSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                  boxShadow: isSelected ? '0 4px 20px rgba(0, 53, 95, 0.08)' : '0 2px 8px rgba(0,0,0,0.01)',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {/* Header / Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {entry.frontmatter.date}
                    </span>
                    {entry.frontmatter.mood && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--accent-light)', padding: '2px 8px', borderRadius: '10px' }}>
                        רגש: {entry.frontmatter.mood}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    {entry.frontmatter.topics && entry.frontmatter.topics.map((topic, i) => (
                      <span 
                        key={i} 
                        style={{ 
                          fontSize: '0.7rem', 
                          backgroundColor: 'var(--bg-color)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-sm)', 
                          padding: '2px 6px',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Entry Content Body */}
                <article style={{ 
                  fontSize: '0.95rem', 
                  lineHeight: '1.7', 
                  color: 'var(--text-secondary)', 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'var(--font-sans)'
                }}>
                  {entry.content}
                </article>

                {/* Open Threads / Actions */}
                {entry.frontmatter.open_threads && entry.frontmatter.open_threads.length > 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    backgroundColor: 'var(--bg-color)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '12px 16px' 
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      נושאים פתוחים / משימות:
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, padding: 0 }}>
                      {entry.frontmatter.open_threads.map((thread, idx) => (
                        <li key={idx} style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          {thread}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* 2. Left Column: Timeline Pane */}
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

        {/* Slider Section */}
        {!loading && !error && dateRange.list.length > 1 && (
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
          
          {!loading && !error && filteredEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>לא נמצאו רשומות.</div>
          )}

          {!loading && !error && filteredEntries.map((entry) => {
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
        </div>
      </aside>
    </div>
  );
}
