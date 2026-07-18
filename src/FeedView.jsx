import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, Tag, RefreshCw, Search, BookOpen, Activity, Heart, Moon, Zap, Sparkles } from 'lucide-react';
import { fetchFirebaseEntries, fetchFirebaseGraph } from './firebase';
import LocalGraph from './LocalGraph';
import RecommendedReadingsCard from './components/RecommendedReadingsCard';

const getHebrewDayOfWeek = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
  return days[date.getDay()];
};

const getSleepBadgeStyle = (score) => {
  const val = parseFloat(score);
  if (isNaN(val)) return { color: '#6366f1', backgroundColor: '#e0e7ff', border: '1px solid #c7d2fe' };
  if (val > 85) return { color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
  if (val >= 70) return { color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a' };
  return { color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
};

const getStepsBadgeStyle = (steps) => {
  const val = parseFloat(steps);
  if (isNaN(val)) return { color: '#10b981', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
  if (val > 15000) return { color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
  if (val >= 10000) return { color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a' };
  return { color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
};

const getRestingHrBadgeStyle = (hr) => {
  const val = parseFloat(hr);
  if (isNaN(val)) return { color: '#ef4444', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
  if (val < 55) return { color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
  if (val <= 58) return { color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a' };
  return { color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
};

const getHrvBadgeStyle = (hrv) => {
  const val = parseFloat(hrv);
  if (isNaN(val)) return { color: '#8b5cf6', backgroundColor: '#ede9fe', border: '1px solid #ddd6fe' };
  if (val > 34) return { color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
  if (val >= 29) return { color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a' };
  return { color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
};

export default function FeedView({ dataSource, uid, selectedEntryId, onSelectEntry, isaData }) {
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

  // Map of HealthMetrics by YYYY-MM-DD
  const healthMetricsByDate = useMemo(() => {
    const map = {};
    if (graphData && graphData.nodes) {
      graphData.nodes.forEach(node => {
        if (node.type === 'HealthMetric') {
            const dateStr = node.date || (node.id && node.id.replace('Health_', '').replace(/_/g, '-'));
            if (dateStr && node.metrics) {
              map[dateStr] = node.metrics;
            }
        }
      });
    }
    return map;
  }, [graphData]);

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
      
      let isaTagMatch = false;
      if (isaData && isaData[entry.frontmatter.date]) {
        const dayData = isaData[entry.frontmatter.date];
        const tags = [];
        if (dayData.sleep === 'bad') tags.push('שינה_גרועה');
        if (dayData.sleep === 'good') tags.push('שינה_מעולה');
        if (dayData.sportsSets === 'good' || dayData.cardio === 'good') tags.push('יום_אימון');
        if (dayData.efficacy === 'good') tags.push('פרודוקטיביות_שיא');
        if (dayData.social === 'good') tags.push('חברתי');
        isaTagMatch = tags.some(t => t.toLowerCase().includes(query));
      }
        
      return contentMatch || topicsMatch || moodMatch || triplesMatch || isaTagMatch;
    });
  }, [entries, searchQuery, isaData]);

  const writingPrompts = useMemo(() => {
    if (!isaData) return [];
    const dates = Object.keys(isaData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    if (dates.length === 0) return [];
    
    const recentDates = dates.slice(0, 3);
    const prompts = [];
    const lowCount = { sleep: 0, efficacy: 0, work: 0, social: 0, family: 0, nutrition: 0 };
    
    recentDates.forEach(date => {
      const dayData = isaData[date];
      if (dayData) {
        if (dayData.sleep === 'bad') lowCount.sleep++;
        if (dayData.efficacy === 'bad') lowCount.efficacy++;
        if (dayData.work === 'bad') lowCount.work++;
        if (dayData.social === 'bad') lowCount.social++;
        if (dayData.family === 'bad') lowCount.family++;
        if (dayData.nutrition === 'bad') lowCount.nutrition++;
      }
    });
    
    if (lowCount.sleep >= 1) {
      prompts.push({
        type: 'sleep',
        text: 'השינה שלך הייתה פחות טובה בימים האחרונים. כתוב על רמת האנרגיה שלך וכיצד היא משפיעה על יומך.',
        color: '#6366f1'
      });
    }
    if (lowCount.efficacy >= 1) {
      prompts.push({
        type: 'efficacy',
        text: 'חווית ירידה בתחושת החוללות והמסוגלות העצמית לאחרונה. מה לדעתך חוסם אותך, ואיזו פעולה קטנה תוכל לעשות היום כדי להחזיר שליטה?',
        color: '#f59e0b'
      });
    }
    if (lowCount.work >= 1) {
      prompts.push({
        type: 'work',
        text: 'הרגשת קושי או חוסר שביעות רצון בעבודה בימים האחרונים. מהם האתגרים המרכזיים שאתה חווה כרגע במישור המקצועי?',
        color: '#3b82f6'
      });
    }
    if (lowCount.social >= 1 || lowCount.family >= 1) {
      prompts.push({
        type: 'social',
        text: 'דירוג הקשרים החברתיים או המשפחתיים שלך היה נמוך לאחרונה. האם יש משהו שיושב עליך בקשר למערכות היחסים שלך?',
        color: '#ec4899'
      });
    }
    if (lowCount.nutrition >= 1) {
      prompts.push({
        type: 'nutrition',
        text: 'דירוג התזונה שלך היה נמוך לאחרונה. איך ההרגשה הפיזית שלך משפיעה על מצב הרוח והפרודוקטיביות?',
        color: '#10b981'
      });
    }
    return prompts;
  }, [isaData]);

  return (
    <div style={{ display: 'flex', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
      
      <main className="reader-pane" style={{ overflowY: 'auto', flexGrow: 1, padding: '24px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
          
          {/* Recommended Readings & Quotes Card */}
          <RecommendedReadingsCard uid={uid} onNavigateToNewEntry={onSelectEntry} />

          {/* Habit-Triggered Prompts */}
          {writingPrompts.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
                המלצות כתיבה מבוססות מדדי בריאות ופעילות
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                מזהה ירידה במדדי איכות החיים שלך בימים האחרונים. הנה כמה נושאים שתוכל לכתוב עליהם ביומן:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {writingPrompts.map((prompt, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      fontSize: '0.85rem', 
                      lineHeight: '1.5',
                      color: 'var(--text-secondary)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRight: `3px solid ${prompt.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{prompt.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {/* Header Container */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  borderBottom: '1px solid var(--border-color)', 
                  paddingBottom: '16px', 
                  gap: '20px', 
                  flexWrap: 'wrap'
                }}>
                  
                  {/* Right Side: Date, Mood, Hashtags */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    flex: '1 1 250px',
                    alignItems: 'flex-start'
                  }}>
                    {/* Date & Mood */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {entry.frontmatter.date} ({getHebrewDayOfWeek(entry.frontmatter.date)})
                      </span>
                      {entry.frontmatter.mood && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--accent-light)', padding: '2px 8px', borderRadius: '10px' }}>
                          רגש: {entry.frontmatter.mood}
                        </span>
                      )}
                    </div>

                    {/* Hashtags (Right aligned) */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(() => {
                        const isaTags = [];
                        if (isaData && isaData[entry.frontmatter.date]) {
                          const dayData = isaData[entry.frontmatter.date];
                          if (dayData.sleep === 'bad') isaTags.push('שינה_גרועה');
                          if (dayData.sleep === 'good') isaTags.push('שינה_מעולה');
                          if (dayData.sportsSets === 'good' || dayData.cardio === 'good') isaTags.push('יום_אימון');
                          if (dayData.efficacy === 'good') isaTags.push('פרודוקטיביות_שיא');
                          if (dayData.social === 'good') isaTags.push('חברתי');
                        }
                        const allTopics = [...(entry.frontmatter.topics || []), ...isaTags];
                        return allTopics.map((topic, i) => (
                          <span 
                            key={i} 
                            style={{ 
                              fontSize: '0.7rem', 
                              backgroundColor: topic.startsWith('שינה_') || topic === 'יום_אימון' || topic === 'פרודוקטיביות_שיא' || topic === 'חברתי' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)', 
                              border: topic.startsWith('שינה_') || topic === 'יום_אימון' || topic === 'פרודוקטיביות_שיא' || topic === 'חברתי' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-color)', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '2px 6px',
                              color: topic.startsWith('שינה_') || topic === 'יום_אימון' || topic === 'פרודוקטיביות_שיא' || topic === 'חברתי' ? '#10b981' : 'var(--text-secondary)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            #{topic}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Left Side: Dedicated Separate Area for Health & ISA Metrics */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px', 
                    alignItems: 'flex-end', 
                    flex: '1 1 320px',
                    maxWidth: '480px',
                    borderRight: '1px solid var(--border-color)', 
                    paddingRight: '16px'
                  }}>
                    {/* Google Health Metrics */}
                    {healthMetricsByDate && healthMetricsByDate[entry.frontmatter.date] && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {healthMetricsByDate[entry.frontmatter.date].sleep_score && (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '10px',
                            ...getSleepBadgeStyle(healthMetricsByDate[entry.frontmatter.date].sleep_score)
                          }}>
                            <Moon size={12} /> שינה: {healthMetricsByDate[entry.frontmatter.date].sleep_score}
                          </span>
                        )}
                        {healthMetricsByDate[entry.frontmatter.date].steps && (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '10px',
                            ...getStepsBadgeStyle(healthMetricsByDate[entry.frontmatter.date].steps)
                          }}>
                            <Activity size={12} /> צעדים: {healthMetricsByDate[entry.frontmatter.date].steps}
                          </span>
                        )}
                        {healthMetricsByDate[entry.frontmatter.date].resting_hr && (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '10px',
                            ...getRestingHrBadgeStyle(healthMetricsByDate[entry.frontmatter.date].resting_hr)
                          }}>
                            <Heart size={12} /> מנוחה: {healthMetricsByDate[entry.frontmatter.date].resting_hr}
                          </span>
                        )}
                        {healthMetricsByDate[entry.frontmatter.date].hrv && (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '10px',
                            ...getHrvBadgeStyle(healthMetricsByDate[entry.frontmatter.date].hrv)
                          }}>
                            <Zap size={12} /> HRV: {healthMetricsByDate[entry.frontmatter.date].hrv}
                          </span>
                        )}
                      </div>
                    )}

                    {/* ISA Metrics */}
                    {isaData && isaData[entry.frontmatter.date] && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {/* Weighted ISA Score */}
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold', 
                          color: '#fff', 
                          backgroundColor: '#059669', 
                          padding: '2px 8px', 
                          borderRadius: '10px'
                        }} title="ציון ISA יומי משוקלל">
                          ציון ISA: {(() => {
                            const dayData = isaData[entry.frontmatter.date];
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
                            return Math.round((score / 110) * 100);
                          })()}%
                        </span>

                        {/* All 11 ISA Metrics sorted by Score */}
                        {(() => {
                          const dayData = isaData[entry.frontmatter.date];
                          const isaLabels = {
                            sportsSets: "ספורט",
                            cardio: "אירובי",
                            meditation: "מדיטציה",
                            journal: "יומן",
                            book: "ספר",
                            efficacy: "חוללות",
                            nutrition: "תזונה",
                            sleep: "שינה",
                            work: "עבודה",
                            family: "משפחה",
                            social: "חברה"
                          };

                          const keys = Object.keys(isaLabels);
                          const sortedKeys = [...keys].sort((a, b) => {
                            const scoreVal = (k) => {
                              const val = dayData[k];
                              if (val === 'good') return 3;
                              if (val === 'medium') return 2;
                              if (val === 'bad') return 1;
                              return 0; // Not selected
                            };
                            return scoreVal(b) - scoreVal(a);
                          });

                          return sortedKeys.map(key => {
                            const val = dayData[key];
                            const label = isaLabels[key];
                            
                            let badgeStyle = {};
                            let prefix = '';
                            let statusText = '';

                            if (val === 'good') {
                              badgeStyle = { color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #a7f3d0' };
                              prefix = '✓';
                              statusText = 'טוב';
                            } else if (val === 'medium') {
                              badgeStyle = { color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fde68a' };
                              prefix = '~';
                              statusText = 'בינוני';
                            } else if (val === 'bad') {
                              badgeStyle = { color: '#b91c1c', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' };
                              prefix = '✗';
                              statusText = 'גרוע';
                            } else {
                              badgeStyle = { color: '#6b7280', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' };
                              prefix = '○';
                              statusText = 'לא נבחר';
                            }

                            return (
                              <span 
                                key={key} 
                                style={{ 
                                  fontSize: '0.7rem', 
                                  padding: '1px 6px', 
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  whiteSpace: 'nowrap',
                                  ...badgeStyle
                                }}
                                title={`${label}: ${statusText}`}
                              >
                                {prefix} {label}
                              </span>
                            );
                          });
                        })()}
                      </div>
                    )}
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
                {(() => {
                  const isaTags = [];
                  if (isaData && isaData[entry.frontmatter.date]) {
                    const dayData = isaData[entry.frontmatter.date];
                    if (dayData.sleep === 'bad') isaTags.push('שינה_גרועה');
                    if (dayData.sleep === 'good') isaTags.push('שינה_מעולה');
                    if (dayData.sportsSets === 'good' || dayData.cardio === 'good') isaTags.push('יום_אימון');
                    if (dayData.efficacy === 'good') isaTags.push('פרודוקטיביות_שיא');
                    if (dayData.social === 'good') isaTags.push('חברתי');
                  }
                  const allTopics = [...(entry.frontmatter.topics || []), ...isaTags];
                  if (allTopics.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {allTopics.slice(0, 3).map((topic, idx) => (
                        <span 
                          key={idx} 
                          style={{ 
                            fontSize: '0.65rem', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: topic.startsWith('שינה_') || topic === 'יום_אימון' || topic === 'פרודוקטיביות_שיא' || topic === 'חברתי' ? 'rgba(16, 185, 129, 0.15)' : (isSelected ? '#ffffff' : 'var(--accent-light)'),
                            color: topic.startsWith('שינה_') || topic === 'יום_אימון' || topic === 'פרודוקטיביות_שיא' || topic === 'חברתי' ? '#10b981' : 'var(--text-muted)'
                          }}
                        >
                          #{topic}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
