import React, { useEffect, useState, useMemo } from 'react';
import { 
  Calendar, 
  Tag, 
  RefreshCw, 
  Search, 
  BookOpen, 
  Activity, 
  Heart, 
  Moon, 
  Zap, 
  Sparkles,
  Quote,
  Flame,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { fetchFirebaseEntries, fetchFirebaseGraph, fetchTheoreticalConcepts } from './firebase';
import { 
  extractHealthMetricsMap, 
  computePersonalRollingBaselines, 
  detectSomaticDissonance 
} from './utils/somaticCausalityEngine';
import LocalGraph from './LocalGraph';

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

const findBestConceptMatch = (refId, concepts) => {
  if (!refId) return null;
  const ref = refId.toLowerCase().trim();
  
  // 1. Exact match
  let match = concepts.find(c => c.id.toLowerCase() === ref);
  if (match) return match;
  
  // 2. Contains match
  match = concepts.find(c => {
    const cid = c.id.toLowerCase();
    return cid.includes(ref) || ref.includes(cid);
  });
  if (match) return match;
  
  // 3. Match by cleaning up prefixes
  const clean = (str) => str.replace(/knowledge_base_/g, '').replace(/_/g, ' ').replace(/[a-zA-Z]/g, '').trim();
  const cleanRef = clean(ref);
  if (cleanRef) {
    match = concepts.find(c => {
      const cleanCid = clean(c.id);
      return cleanCid && (cleanCid.includes(cleanRef) || cleanRef.includes(cleanCid));
    });
  }
  
  return match || null;
};

const cleanConceptId = (ref) => {
  if (!ref) return '';
  let name = ref.replace(/^knowledge_base_(personality_|productivity_|motivation_|relationships_)?/i, '');
  name = name.replace(/\.md$/i, '');
  name = name.replace(/_/g, ' ');
  return name.trim();
};

export default function FeedView({ dataSource, uid, selectedEntryId, onSelectEntry, isaData, onNavigateToTab }) {
  const [entries, setEntries] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [concepts, setConcepts] = useState([]);
  const [activeConceptDetail, setActiveConceptDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sliderValue, setSliderValue] = useState(0);

  // Quick Filter Chips: 'all', 'quotes', 'dissonance', 'high_strain'
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');

  // Multi-Year Heatmap period selector: 'last12', 'all', or a year string (e.g. '2026', '2025')
  const [heatmapPeriod, setHeatmapPeriod] = useState('last12');

  // Map of entries by YYYY-MM-DD
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      if (e.frontmatter?.date) {
        map[e.frontmatter.date] = e;
      }
    });
    return map;
  }, [entries]);

  // Extract health metrics from graph nodes
  const healthMetricsByDate = useMemo(() => {
    return extractHealthMetricsMap(graphData.nodes || []);
  }, [graphData]);

  // Compute Personal Rolling Baselines & Z-Scores
  const baselinesData = useMemo(() => {
    return computePersonalRollingBaselines(healthMetricsByDate, 30);
  }, [healthMetricsByDate]);

  // Detect Somatic Dissonance
  const dissonanceEvents = useMemo(() => {
    return detectSomaticDissonance(entries, baselinesData);
  }, [entries, baselinesData]);

  const dissonanceMap = useMemo(() => {
    const map = {};
    dissonanceEvents.forEach(evt => {
      map[evt.date] = evt;
    });
    return map;
  }, [dissonanceEvents]);

  // Available years from entries
  const availableYears = useMemo(() => {
    const years = new Set();
    entries.forEach(e => {
      const d = e.frontmatter?.date;
      if (d && /^\d{4}/.test(d)) {
        years.add(d.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [entries]);

  // Heatmap Months generation based on selected period
  const heatmapMonths = useMemo(() => {
    const months = [];
    const now = new Date();

    if (heatmapPeriod === 'last12') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        months.push({
          year,
          month,
          daysInMonth,
          firstDayOfWeek,
          name: d.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })
        });
      }
    } else if (heatmapPeriod === 'all') {
      // Span all available years
      const sortedYears = [...availableYears].sort();
      if (sortedYears.length > 0) {
        const startYear = parseInt(sortedYears[0], 10);
        const endYear = parseInt(sortedYears[sortedYears.length - 1], 10);
        for (let y = startYear; y <= endYear; y++) {
          for (let m = 0; m < 12; m++) {
            const d = new Date(y, m, 1);
            if (y === now.getFullYear() && m > now.getMonth()) break;
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const firstDayOfWeek = new Date(y, m, 1).getDay();
            months.push({
              year: y,
              month: m,
              daysInMonth,
              firstDayOfWeek,
              name: d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })
            });
          }
        }
      }
    } else {
      // Specific single year
      const y = parseInt(heatmapPeriod, 10);
      if (!isNaN(y)) {
        for (let m = 0; m < 12; m++) {
          const d = new Date(y, m, 1);
          if (y === now.getFullYear() && m > now.getMonth()) break;
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const firstDayOfWeek = new Date(y, m, 1).getDay();
          months.push({
            year: y,
            month: m,
            daysInMonth,
            firstDayOfWeek,
            name: d.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })
          });
        }
      }
    }
    return months;
  }, [heatmapPeriod, availableYears]);

  // High-contrast color scale for mood polarity
  const getMoodColor = (mood) => {
    if (!mood) return 'rgba(148, 163, 184, 0.15)';
    const m = mood.toLowerCase();
    
    // Emerald: Positive & Uplifting
    if (m.includes('שמח') || m.includes('טוב') || m.includes('אהב') || m.includes('רוגע') || m.includes('חיובי') || m.includes('joy') || m.includes('happy') || m.includes('calm') || m.includes('love') || m.includes('peace') || m.includes('בטוח') || m.includes('מעולה') || m.includes('סיפוק')) {
      return '#10b981';
    }
    // Amber: Mixed / Reflective
    if (m.includes('הרהור') || m.includes('מעורב') || m.includes('מחשבה') || m.includes('געגוע') || m.includes('סקרנות') || m.includes('שאלה') || m.includes('ציפייה') || m.includes('neutral') || m.includes('בינוני')) {
      return '#f59e0b';
    }
    // Rose: Stressed / Negative
    if (m.includes('לחץ') || m.includes('חרד') || m.includes('עצב') || m.includes('עומס') || m.includes('מתח') || m.includes('תסכול') || m.includes('כעס') || m.includes('פחד') || m.includes('דאגה') || m.includes('בדידות') || m.includes('stress') || m.includes('sad') || m.includes('anxiety') || m.includes('fear') || m.includes('overwhelmed')) {
      return '#f43f5e';
    }
    // Indigo: Neutral / Task-focused
    return '#6366f1';
  };

  const formatDateString = (year, month, day) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Helper to extract formative quotes from an entry
  const extractQuoteFromEntry = (content) => {
    if (!content) return null;
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('>') || trimmed.toLowerCase().includes('ציטוט:') || (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 15)) {
        return trimmed.replace(/^>\s*/, '').replace(/^ציטוט:\s*/i, '').replace(/^["']|["']$/g, '').trim();
      }
    }
    return null;
  };

  const fetchEntriesAndGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!uid) {
        throw new Error('חיבור לפיירבייס לא אותחל עדיין. אנא המתן...');
      }
      const [entriesData, graphDataRes, theoreticalRes] = await Promise.all([
        fetchFirebaseEntries(uid),
        fetchFirebaseGraph(uid),
        fetchTheoreticalConcepts()
      ]);
      setEntries(entriesData);
      setGraphData(graphDataRes);
      setConcepts(theoreticalRes.nodes || []);

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

  const selectedEntry = useMemo(() => {
    return entries.find(e => e.id === selectedEntryId) || null;
  }, [entries, selectedEntryId]);

  // Timeline slider range
  const dateRange = useMemo(() => {
    if (entries.length === 0) return { min: 0, max: 0, list: [] };
    const list = entries
      .map(e => ({
        id: e.id,
        dateStr: e.frontmatter?.date,
        time: new Date(e.frontmatter?.date).getTime()
      }))
      .filter(e => !isNaN(e.time))
      .sort((a, b) => a.time - b.time);
      
    if (list.length === 0) return { min: 0, max: 0, list: [] };
    return {
      min: list[0].time,
      max: list[list.length - 1].time,
      list
    };
  }, [entries]);

  useEffect(() => {
    if (dateRange.list.length > 0) {
      setSliderValue(dateRange.max);
    }
  }, [dateRange]);

  const handleSliderChange = (e) => {
    const targetTime = parseInt(e.target.value);
    setSliderValue(targetTime);
    if (dateRange.list.length === 0) return;
    
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

  // Quick Filter counts
  const filterCounts = useMemo(() => {
    let quotesCount = 0;
    let highStrainCount = 0;

    entries.forEach(entry => {
      const content = (entry.content || '').toLowerCase();
      const title = (entry.frontmatter?.title || '').toLowerCase();
      if (content.includes('ציטוט') || title.includes('ציטוט') || content.includes('\n>') || (entry.frontmatter?.quotes && entry.frontmatter.quotes.length > 0)) {
        quotesCount++;
      }

      const base = baselinesData.byDate?.[entry.frontmatter?.date];
      if (base?.zScores) {
        const zHrv = base.zScores.hrv;
        const zRhr = base.zScores.resting_hr;
        if ((zHrv !== null && zHrv <= -1.0) || (zRhr !== null && zRhr >= 1.0)) {
          highStrainCount++;
        }
      }
    });

    return {
      all: entries.length,
      quotes: quotesCount,
      dissonance: dissonanceEvents.length,
      highStrain: highStrainCount
    };
  }, [entries, baselinesData, dissonanceEvents]);

  // Client-side filtering by Quick Filter Chips & Text Search
  const filteredEntries = useMemo(() => {
    let list = entries;

    // Apply Quick Filter Chip
    if (activeQuickFilter === 'quotes') {
      list = list.filter(entry => {
        const content = (entry.content || '').toLowerCase();
        const title = (entry.frontmatter?.title || '').toLowerCase();
        return content.includes('ציטוט') || title.includes('ציטוט') || content.includes('\n>') || (entry.frontmatter?.quotes && entry.frontmatter.quotes.length > 0);
      });
    } else if (activeQuickFilter === 'dissonance') {
      const dissDates = new Set(dissonanceEvents.map(d => d.date));
      list = list.filter(entry => dissDates.has(entry.frontmatter?.date));
    } else if (activeQuickFilter === 'high_strain') {
      list = list.filter(entry => {
        const base = baselinesData.byDate?.[entry.frontmatter?.date];
        if (!base?.zScores) return false;
        const zHrv = base.zScores.hrv;
        const zRhr = base.zScores.resting_hr;
        return (zHrv !== null && zHrv <= -1.0) || (zRhr !== null && zRhr >= 1.0);
      });
    }

    // Apply Text Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(entry => {
        const contentMatch = (entry.content || '').toLowerCase().includes(query);
        const topicsMatch = entry.frontmatter?.topics && 
          entry.frontmatter.topics.some(topic => topic.toLowerCase().includes(query));
        const moodMatch = entry.frontmatter?.mood && 
          entry.frontmatter.mood.toLowerCase().includes(query);
        const triplesMatch = entry.frontmatter?.triples && 
          entry.frontmatter.triples.some(t => {
            const s = (t.subject || t.s || '').toLowerCase();
            const o = (t.object || t.o || '').toLowerCase();
            const r = (t.relation || t.r || '').toLowerCase();
            return s.includes(query) || o.includes(query) || r.includes(query);
          });
        
        let isaTagMatch = false;
        if (isaData && isaData[entry.frontmatter?.date]) {
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
    }

    return list;
  }, [entries, activeQuickFilter, searchQuery, isaData, dissonanceEvents, baselinesData]);

  // Habit-Triggered Prompts from ISA Data
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
      
      {/* 1. Main Reader Pane */}
      <main className="reader-pane" style={{ overflowY: 'auto', flexGrow: 1, padding: '24px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '780px', width: '100%', margin: '0 auto' }}>
          
          {/* Multi-Year Activity Heatmap with Period Selector */}
          <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--accent-color)' }} />
                  מפת פעילות יומן ופולריות רגשית
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {entries.length} רשומות מתועדות | בחר שנה או תקופה לתצוגה
                </span>
              </div>

              {/* Multi-Year Period Selector Buttons */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-color)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setHeatmapPeriod('last12')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: heatmapPeriod === 'last12' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: heatmapPeriod === 'last12' ? 'var(--accent-color)' : 'transparent',
                    color: heatmapPeriod === 'last12' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  12 חודשים אחרונים
                </button>
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    onClick={() => setHeatmapPeriod(yr)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: heatmapPeriod === yr ? 700 : 500,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: heatmapPeriod === yr ? 'var(--accent-color)' : 'transparent',
                      color: heatmapPeriod === yr ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {yr}
                  </button>
                ))}
                <button
                  onClick={() => setHeatmapPeriod('all')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: heatmapPeriod === 'all' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: heatmapPeriod === 'all' ? 'var(--accent-color)' : 'transparent',
                    color: heatmapPeriod === 'all' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  הכל
                </button>
              </div>
            </div>

            {/* High-Contrast Legend */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} /> חיובי ומרומם (Emerald)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} /> מעורב / רפלקטיבי (Amber)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f43f5e' }} /> עומס / מתח / עצב (Rose)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#6366f1' }} /> ענייני / משימתי (Indigo)
              </span>
            </div>

            {/* Render Heatmap Months Grid */}
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '6px' }}>
              {heatmapMonths.map((mObj, mi) => (
                <div key={mi} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '85px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {mObj.name}
                  </span>
                  
                  {/* Days grid: 7 rows (Sunday to Saturday) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateRows: 'repeat(7, 12px)',
                    gridAutoFlow: 'column',
                    gap: '3px'
                  }}>
                    {Array.from({ length: mObj.firstDayOfWeek }).map((_, bi) => (
                      <div key={`blank-${bi}`} style={{ width: '12px', height: '12px' }} />
                    ))}

                    {Array.from({ length: mObj.daysInMonth }).map((_, di) => {
                      const dayNum = di + 1;
                      const dateStr = formatDateString(mObj.year, mObj.month, dayNum);
                      const entry = entriesByDate[dateStr];
                      const hasEntry = !!entry;
                      const mood = entry?.frontmatter?.mood;
                      const cellColor = hasEntry ? getMoodColor(mood) : 'rgba(148, 163, 184, 0.12)';
                      const isSelected = entry && entry.id === selectedEntryId;

                      return (
                        <div
                          key={`day-${dayNum}`}
                          onClick={() => {
                            if (entry) {
                              onSelectEntry(entry.id);
                            }
                          }}
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '2px',
                            background: cellColor,
                            cursor: hasEntry ? 'pointer' : 'default',
                            outline: isSelected ? '2px solid var(--accent-color)' : 'none',
                            transform: isSelected ? 'scale(1.2)' : 'none',
                            transition: 'all 0.1s ease'
                          }}
                          title={hasEntry ? `${dateStr} (${getHebrewDayOfWeek(dateStr)}): ${mood || 'רשומה ללא הגדרת רגש'}` : dateStr}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Filter Chips Bar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} /> סינון מהיר:
            </span>

            {[
              { id: 'all', label: 'הכל', count: filterCounts.all, color: '#3b82f6' },
              { id: 'quotes', label: '💬 רשומות עם ציטוטים מכוננים', count: filterCounts.quotes, color: '#f59e0b' },
              { id: 'dissonance', label: '⚡ דיסוננס גוף–נפש', count: filterCounts.dissonance, color: '#8b5cf6' },
              { id: 'high_strain', label: '🔥 עומס פיזיולוגי גבוה', count: filterCounts.highStrain, color: '#ef4444' }
            ].map(chip => {
              const isActive = activeQuickFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveQuickFilter(chip.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    border: isActive ? `1px solid ${chip.color}` : '1px solid var(--border-color)',
                    background: isActive ? `${chip.color}20` : 'var(--bg-color)',
                    color: isActive ? (chip.color === '#f59e0b' ? '#d97706' : chip.color) : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{chip.label}</span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '1px 6px', 
                    borderRadius: '10px', 
                    background: isActive ? chip.color : 'rgba(255,255,255,0.08)',
                    color: isActive ? '#fff' : 'var(--text-muted)'
                  }}>
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

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

          {/* Entries Feed Cards */}
          {filteredEntries.map(entry => {
            const isSelected = entry.id === selectedEntryId;
            const dateStr = entry.frontmatter?.date;
            const baseData = baselinesData.byDate?.[dateStr];
            const zScores = baseData?.zScores;
            const dissEvent = dissonanceMap[dateStr];
            const quoteSnippet = extractQuoteFromEntry(entry.content);

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
                        {dateStr} ({getHebrewDayOfWeek(dateStr)})
                      </span>
                      {entry.frontmatter?.mood && (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: '#fff', 
                          backgroundColor: getMoodColor(entry.frontmatter.mood), 
                          padding: '2px 8px', 
                          borderRadius: '10px',
                          fontWeight: 600
                        }}>
                          רגש: {entry.frontmatter.mood}
                        </span>
                      )}
                      {entry.frontmatter?.tkb_reference && (
                        <button 
                          onClick={() => {
                            const match = findBestConceptMatch(entry.frontmatter.tkb_reference, concepts);
                            setActiveConceptDetail(match || { id: entry.frontmatter.tkb_reference, title: cleanConceptId(entry.frontmatter.tkb_reference) });
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--accent-color)',
                            backgroundColor: 'rgba(255, 126, 64, 0.1)',
                            border: '1px solid rgba(255, 126, 64, 0.25)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontFamily: 'inherit'
                          }}
                        >
                          <BookOpen size={12} />
                          מושג: {cleanConceptId(entry.frontmatter.tkb_reference)}
                        </button>
                      )}
                    </div>

                    {/* Hashtags */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(() => {
                        const isaTags = [];
                        if (isaData && isaData[dateStr]) {
                          const dayData = isaData[dateStr];
                          if (dayData.sleep === 'bad') isaTags.push('שינה_גרועה');
                          if (dayData.sleep === 'good') isaTags.push('שינה_מעולה');
                          if (dayData.sportsSets === 'good' || dayData.cardio === 'good') isaTags.push('יום_אימון');
                          if (dayData.efficacy === 'good') isaTags.push('פרודוקטיביות_שיא');
                          if (dayData.social === 'good') isaTags.push('חברתי');
                        }
                        const allTopics = [...(entry.frontmatter?.topics || []), ...isaTags];
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

                  {/* Left Side: Biometrics with Calibrated Rolling Z-Scores */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    alignItems: 'flex-end', 
                    flex: '1 1 320px', 
                    maxWidth: '480px', 
                    borderRight: '1px solid var(--border-color)', 
                    paddingRight: '16px' 
                  }}>
                    {/* Google Health Metrics with Personal Rolling Z-Score Anomaly Badges */}
                    {healthMetricsByDate && healthMetricsByDate[dateStr] && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        
                        {/* HRV Badge with Z-score Anomaly */}
                        {healthMetricsByDate[dateStr].hrv && (() => {
                          const val = healthMetricsByDate[dateStr].hrv;
                          const z = zScores?.hrv;
                          const isHigh = z !== null && z !== undefined && z >= 0.8;
                          const isLow = z !== null && z !== undefined && z <= -0.8;
                          
                          let bg = '#ede9fe';
                          let textCol = '#8b5cf6';
                          let borderCol = '#ddd6fe';
                          let label = `HRV: ${val}`;

                          if (isHigh) {
                            bg = '#d1fae5';
                            textCol = '#047857';
                            borderCol = '#a7f3d0';
                            label = `HRV ${val} (↑ ${z}σ התאוששות)`;
                          } else if (isLow) {
                            bg = '#fee2e2';
                            textCol = '#b91c1c';
                            borderCol = '#fca5a5';
                            label = `HRV ${val} (↓ ${Math.abs(z)}σ עומס)`;
                          }

                          return (
                            <span 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '0.75rem', 
                                padding: '2px 8px', 
                                borderRadius: '10px', 
                                backgroundColor: bg, 
                                color: textCol, 
                                border: `1px solid ${borderCol}`,
                                fontWeight: (isHigh || isLow) ? 700 : 500
                              }}
                              title={z !== null ? `Z-Score ביחס לבייסליין 30 יום שלך: ${z}σ` : ''}
                            >
                              <Zap size={12} /> {label}
                            </span>
                          );
                        })()}

                        {/* Resting HR Badge with Z-score Anomaly */}
                        {healthMetricsByDate[dateStr].resting_hr && (() => {
                          const val = healthMetricsByDate[dateStr].resting_hr;
                          const z = zScores?.resting_hr;
                          const isHigh = z !== null && z !== undefined && z >= 0.8;
                          const isLow = z !== null && z !== undefined && z <= -0.8;

                          let bg = '#fee2e2';
                          let textCol = '#ef4444';
                          let borderCol = '#fca5a5';
                          let label = `מנוחה: ${val}`;

                          if (isLow) {
                            bg = '#d1fae5';
                            textCol = '#047857';
                            borderCol = '#a7f3d0';
                            label = `מנוחה ${val} (↓ ${Math.abs(z)}σ רגיעה)`;
                          } else if (isHigh) {
                            bg = '#fee2e2';
                            textCol = '#b91c1c';
                            borderCol = '#fca5a5';
                            label = `מנוחה ${val} (↑ ${z}σ דופק מוגבר)`;
                          }

                          return (
                            <span 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '0.75rem', 
                                padding: '2px 8px', 
                                borderRadius: '10px', 
                                backgroundColor: bg, 
                                color: textCol, 
                                border: `1px solid ${borderCol}`,
                                fontWeight: (isHigh || isLow) ? 700 : 500
                              }}
                              title={z !== null ? `Z-Score ביחס לבייסליין 30 יום שלך: ${z}σ` : ''}
                            >
                              <Heart size={12} /> {label}
                            </span>
                          );
                        })()}

                        {/* Sleep Score Badge with Z-score Anomaly */}
                        {healthMetricsByDate[dateStr].sleep_score && (() => {
                          const val = healthMetricsByDate[dateStr].sleep_score;
                          const z = zScores?.sleep_score;
                          const isHigh = z !== null && z !== undefined && z >= 0.8;
                          const isLow = z !== null && z !== undefined && z <= -0.8;

                          let bg = '#e0e7ff';
                          let textCol = '#6366f1';
                          let borderCol = '#c7d2fe';
                          let label = `שינה: ${val}`;

                          if (isHigh) {
                            bg = '#d1fae5';
                            textCol = '#047857';
                            borderCol = '#a7f3d0';
                            label = `שינה ${val} (↑ ${z}σ איכותית)`;
                          } else if (isLow) {
                            bg = '#fee2e2';
                            textCol = '#b91c1c';
                            borderCol = '#fca5a5';
                            label = `שינה ${val} (↓ ${Math.abs(z)}σ ירודה)`;
                          }

                          return (
                            <span 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '0.75rem', 
                                padding: '2px 8px', 
                                borderRadius: '10px', 
                                backgroundColor: bg, 
                                color: textCol, 
                                border: `1px solid ${borderCol}`,
                                fontWeight: (isHigh || isLow) ? 700 : 500
                              }}
                              title={z !== null ? `Z-Score ביחס לבייסליין 30 יום שלך: ${z}σ` : ''}
                            >
                              <Moon size={12} /> {label}
                            </span>
                          );
                        })()}

                        {/* Steps Badge */}
                        {healthMetricsByDate[dateStr].steps && (
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '10px', 
                            ...getStepsBadgeStyle(healthMetricsByDate[dateStr].steps) 
                          }}>
                            <Activity size={12} /> צעדים: {parseInt(healthMetricsByDate[dateStr].steps, 10).toLocaleString()}
                          </span>
                        )}

                      </div>
                    )}

                    {/* Composite Physiological Status Indicator */}
                    {baseData && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        color: baseData.statusColor, 
                        background: `${baseData.statusColor}15`, 
                        padding: '2px 8px', 
                        borderRadius: '6px',
                        border: `1px solid ${baseData.statusColor}30`
                      }}>
                        מצב פיזיולוגי: {baseData.statusLabelHe}
                      </span>
                    )}
                  </div>
                </div>

                {/* Somatic Dissonance Banner if detected for this entry */}
                {dissEvent && (
                  <div style={{
                    background: `${dissEvent.typeBadgeColor}12`,
                    border: `1px solid ${dissEvent.typeBadgeColor}35`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Zap size={16} style={{ color: dissEvent.typeBadgeColor, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', color: dissEvent.typeBadgeColor }}>
                      <strong>{dissEvent.typeLabelHe}:</strong> {dissEvent.explanationHe}
                    </span>
                  </div>
                )}

                {/* Formative Quote Highlight */}
                {quoteSnippet && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderRight: '4px solid #f59e0b',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                      <Quote size={13} /> ציטוט מכונן מתוך הרשומה
                    </div>
                    <div style={{ fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      "{quoteSnippet}"
                    </div>
                  </div>
                )}

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

                {/* Open Threads / Action Items */}
                {entry.frontmatter?.open_threads && entry.frontmatter.open_threads.length > 0 && (
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
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>לא נמצאו רשומות העונות על הסינון.</div>
          )}

          {!loading && !error && filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedEntryId;
            const dateStr = entry.frontmatter?.date;
            const baseData = baselinesData.byDate?.[dateStr];
            const hasHighStrain = baseData?.zScores?.hrv <= -1.0 || baseData?.zScores?.resting_hr >= 1.0;
            const hasDissonance = !!dissonanceMap[dateStr];

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
                    {dateStr}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {hasDissonance && (
                      <span title="דיסוננס גוף-נפש" style={{ color: '#8b5cf6', fontSize: '0.7rem' }}>⚡</span>
                    )}
                    {hasHighStrain && (
                      <span title="עומס פיזיולוגי גבוה" style={{ color: '#ef4444', fontSize: '0.7rem' }}>🔥</span>
                    )}
                    {entry.frontmatter?.mood && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {entry.frontmatter.mood}
                      </span>
                    )}
                  </div>
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

                {/* Topics & tags */}
                {(() => {
                  const isaTags = [];
                  if (isaData && isaData[dateStr]) {
                    const dayData = isaData[dateStr];
                    if (dayData.sleep === 'bad') isaTags.push('שינה_גרועה');
                    if (dayData.sleep === 'good') isaTags.push('שינה_מעולה');
                    if (dayData.sportsSets === 'good' || dayData.cardio === 'good') isaTags.push('יום_אימון');
                    if (dayData.efficacy === 'good') isaTags.push('פרודוקטיביות_שיא');
                    if (dayData.social === 'good') isaTags.push('חברתי');
                  }
                  const allTopics = [...(entry.frontmatter?.topics || []), ...isaTags];
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

      {/* Concept Detail Modal */}
      {activeConceptDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          direction: 'rtl'
        }} onClick={() => setActiveConceptDetail(null)}>
          <div style={{
            width: '90%',
            maxWidth: '520px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {activeConceptDetail.title || activeConceptDetail.label || activeConceptDetail.id}
              </h3>
              <button 
                onClick={() => setActiveConceptDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto', 
              fontSize: '0.85rem', 
              lineHeight: '1.6', 
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid #334155',
              borderBottom: '1px solid #334155',
              padding: '12px 0',
              textAlign: 'right'
            }}>
              {activeConceptDetail.content ? 
                activeConceptDetail.content.replace(/^```yaml[\s\S]*?```/g, '').replace(/^[#-\s*]+/g, '').trim() 
                : 'אין תוכן מפורט זמין עבור מושג זה.'
              }
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px' }}>
              <button 
                onClick={() => {
                  setActiveConceptDetail(null);
                  if (onNavigateToTab) {
                    onNavigateToTab('knowledge');
                  }
                }}
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                צפה בגרף הידע האקדמי
              </button>
              <button 
                onClick={() => setActiveConceptDetail(null)}
                style={{
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
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
