import React, { useState, useMemo, useCallback } from 'react';
import { 
  Compass, 
  Target, 
  Zap, 
  Brain, 
  Heart, 
  Users, 
  Globe, 
  Calendar, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  TrendingUp, 
  ShieldCheck, 
  ExternalLink, 
  Network, 
  BookOpen, 
  ChevronRight, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  BarChart2, 
  X,
  Briefcase,
  DollarSign,
  Activity
} from 'lucide-react';

/**
 * 5 Canonical Life Domains for OKF Macro Hub
 */
export const LIFE_DOMAINS = {
  WORK: {
    id: 'work',
    label: 'עבודה וקריירה',
    english: 'Work & Career',
    icon: Briefcase,
    color: '#0284c7', // Sky Blue
    bg: '#f0f9ff',
    border: '#bae6fd',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    description: 'פרויקטים, תכנון משימות, ממשקים עסקיים, ניהול צוותים ומטרות מקצועיות.',
    matches: ['work', 'project', 'עבודה', 'קריירה', 'עסק', 'פרויקט', 'חברה', 'משימות', 'ניהול', 'תפקיד', 'שכר דירה ותשלומים', 'פרויקט קטרוני', 'בעיות חניון', 'התקדמות תוכניות']
  },
  FAMILY: {
    id: 'family',
    label: 'משפחה וזוגיות',
    english: 'Family & Relationships',
    icon: Users,
    color: '#8b5cf6', // Violet
    bg: '#f5f3ff',
    border: '#ddd6fe',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    description: 'מערכות יחסים קרובות, זוגיות, הורות, עוגנים משפחתיים ודינמיקה בינאישית.',
    matches: ['family', 'relationships', 'משפחה', 'זוגיות', 'טלי', 'ילדים', 'הורים', 'קשר', 'יחסים', 'רווחת ילדים', 'אנשים ועוגנים']
  },
  HEALTH: {
    id: 'health',
    label: 'בריאות וגוף',
    english: 'Health & Body',
    icon: Activity,
    color: '#10b981', // Emerald
    bg: '#ecfdf5',
    border: '#a7f3d0',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    description: 'כושר גופני, ריצה, שינה, מדדי HRV, לחץ דם, תזונה ורווחה גופנית.',
    matches: ['health', 'בריאות', 'גוף', 'ספורט', 'ריצה', 'חצי מרתון', 'כושר', 'משקל', 'לחץ דם', 'בדיקות דם', 'דופק', 'שינה', 'hrv', 'אימונים', 'דחיקת חזה']
  },
  FINANCE: {
    id: 'finance',
    label: 'כספים ונדל"ן',
    english: 'Finance & Real Estate',
    icon: DollarSign,
    color: '#f59e0b', // Amber
    bg: '#fffbeb',
    border: '#fde68a',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    description: 'עסקאות נדל"ן, שווי חברה, השקעות, תזרים, תכנון פיננסי ופרויקטים עתידיים.',
    matches: ['finance', 'כספים', 'נדלן', 'נדל"ן', 'דירות', 'שכר דירה', 'השקעות', 'רווח', 'שווי', 'תשלומים', 'הכנסה', 'שווי חברה']
  },
  GROWTH: {
    id: 'growth',
    label: 'התפתחות וערכים',
    english: 'Growth & Values',
    icon: Sparkles,
    color: '#ec4899', // Pink / Rose
    bg: '#fdf2f8',
    border: '#fbcfe8',
    badgeBg: '#fce7f3',
    badgeText: '#be185d',
    description: 'דפוסי חשיבה, ביקורת עצמית, פרפקציוניזם, קבלת החלטות, ערכים ומשמעת פנימית.',
    matches: ['personal', 'growth', 'התפתחות', 'ערכים', 'ביקורת עצמית', 'פרפקציוניזם', 'דחיינות', 'חרדה', 'תובנות', 'רגשות', 'משמעת עצמית', 'תעדוף משימות', 'התקדמות', 'דפוסים והרגלים']
  }
};

const RELATION_HEBREW = {
  'משפיע_על': { label: 'משפיע על', color: '#6366f1' },
  'מחזק': { label: 'מחזק את', color: '#10b981' },
  'מחליש': { label: 'מחליש את', color: '#ef4444' },
  'שואף_ל': { label: 'שואף ל', color: '#059669' },
  'חלק_מ': { label: 'חלק מ', color: '#8b5cf6' },
  'סותר': { label: 'עומד בסתירה ל', color: '#dc2626' },
  'חווה': { label: 'חווה את', color: '#ec4899' },
  'מפעיל': { label: 'מפעיל / מניע את', color: '#f59e0b' },
  'שייך_ל': { label: 'שייך ל', color: '#64748b' },
  'דומה_ל': { label: 'דומה ל', color: '#0284c7' },
  'מתועד_ב': { label: 'מתועד ב', color: '#64748b' },
  'קשור_ל': { label: 'קשור ל', color: '#94a3b8' }
};

/**
 * Checks whether an entity name is an isolated noise mention (e.g. "2 קילוגרם", "4-5_פעמים_בשבוע")
 */
function isNoisyMention(name) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  // Filter out standalone measurements like "2 קילוגרם", "4-5_פעמים_בשבוע", "10 קילו", "85 קילו יציבים"
  if (/^\d+(\.\d+)?(-|\+)?\d*(_|\s)*(קילו|ק"ג|קילוגרם|פעמים|שבועות|דירות|דקות|ימים|שעות|גרם)/i.test(trimmed)) {
    return true;
  }
  // Pure numbers or single characters
  if (/^\d+$/.test(trimmed) || trimmed.length <= 1) return true;
  // Specific noise patterns
  if (['2 קילוגרם', '4-5_פעמים_בשבוע', '2-3 קילו', '10 דקות יומיות', '60+ דירות', '85 קילו יציבים', '90 קילו', '100 קילו'].includes(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Determine life domain for a node based on its properties, metadata, edges, and topics
 */
function classifyNodeDomain(node) {
  const textToScan = [
    node.id,
    node.name,
    node.label,
    node.parent_category,
    node.domain,
    node.type,
    node.content,
    ...(Array.isArray(node.topics) ? node.topics : []),
    ...(Array.isArray(node.relatedEdges) ? node.relatedEdges.map(e => `${e.domain || ''} ${e.relation || ''} ${e.target || ''}`) : [])
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [key, domain] of Object.entries(LIFE_DOMAINS)) {
    for (const matchTerm of domain.matches) {
      if (textToScan.includes(matchTerm.toLowerCase())) {
        return domain.id;
      }
    }
  }
  return 'growth'; // Default fallback
}

/**
 * Extract authentic verbatim quotes for a given node from its metadata, edges, or raw diary entries
 */
function extractQuotesForNode(node, entries = []) {
  const quotes = [];
  const seenTexts = new Set();

  const addQuote = (text, date, entryId, sourceHint) => {
    if (!text || typeof text !== 'string') return;
    const clean = text.trim();
    if (clean.length < 8 || seenTexts.has(clean)) return;
    seenTexts.add(clean);
    quotes.push({
      text: clean,
      date: date || null,
      entryId: entryId || null,
      sourceHint: sourceHint || 'יומן רשומות'
    });
  };

  // 1. Direct quotes on node
  if (Array.isArray(node.sourceQuotes)) {
    node.sourceQuotes.forEach(q => {
      if (typeof q === 'string') addQuote(q, node.date, node.entryId, 'ציטוט מקור מיומן');
      else if (q && typeof q === 'object') addQuote(q.quote || q.text, q.date || node.date, q.entryId || node.entryId, 'ציטוט מקור מיומן');
    });
  }

  // 2. Direct quotes on relatedEdges
  if (Array.isArray(node.relatedEdges)) {
    node.relatedEdges.forEach(edge => {
      const edgeDate = edge.date || (edge.timestamp ? new Date(edge.timestamp).toISOString().split('T')[0] : null);
      if (Array.isArray(edge.sourceQuotes)) {
        edge.sourceQuotes.forEach(q => {
          const t = typeof q === 'string' ? q : q?.quote || q?.text;
          addQuote(t, edgeDate, edge.entryId, 'קשר סיבתי בגרף');
        });
      } else if (edge.evidence?.quote) {
        addQuote(edge.evidence.quote, edge.evidence.entryDate || edgeDate, edge.evidence.entryId, 'טענה אונטולוגית');
      }
    });
  }

  // 3. Fallback: Search diary entries for verbatim occurrences
  const nodeLabel = (node.label || node.name || node.id || '').trim();
  if (nodeLabel && Array.isArray(entries) && entries.length > 0) {
    const qLower = nodeLabel.toLowerCase();

    for (const entry of entries) {
      const content = entry.content || '';
      if (!content) continue;

      const entryDate = entry.date || entry.frontmatter?.date || (entry.rawTimestamp ? new Date(entry.rawTimestamp).toISOString().split('T')[0] : null);
      const idx = content.toLowerCase().indexOf(qLower);

      if (idx !== -1) {
        // Find sentence boundaries around the mention
        const start = Math.max(0, content.lastIndexOf('.', idx) + 1);
        let end = content.indexOf('.', idx + qLower.length);
        if (end === -1) end = Math.min(content.length, idx + 140);
        else end = end + 1;

        const sentence = content.substring(start, end).trim();
        if (sentence.length >= 10) {
          addQuote(sentence, entryDate, entry.id, 'רשומה מותאמת ביומן');
        }
      }
      if (quotes.length >= 6) break;
    }
  }

  return quotes;
}

/**
 * Extract stances for a node
 */
function extractStancesForNode(node) {
  const stances = [];
  if (Array.isArray(node.stances) && node.stances.length > 0) {
    node.stances.forEach(s => {
      stances.push(typeof s === 'string' ? s : (s.stance || s.label || JSON.stringify(s)));
    });
  }

  // Derive from edges if empty
  if (stances.length === 0 && Array.isArray(node.relatedEdges)) {
    const stanceSet = new Set();
    node.relatedEdges.forEach(e => {
      if (Array.isArray(e.stances)) {
        e.stances.forEach(s => stanceSet.add(typeof s === 'string' ? s : s.stance));
      }
      if (e.relation === 'מתחייב_ל' || e.relation === 'COMMITTED_TO') stanceSet.add('מחויבות');
      if (e.relation === 'חולם_על' || e.relation === 'שואף_ל') stanceSet.add('שאיפה');
      if (e.relation === 'סותר' || e.relation === 'CONTRADICTS') stanceSet.add('סתירה פנימית');
      if (e.relation === 'מחזק' || e.relation === 'MITIGATES') stanceSet.add('מחזק');
      if (e.relation === 'מחליש' || e.sentiment === -1 || e.sentimentScore < -0.2) stanceSet.add('אתגר רגשי');
    });
    stanceSet.forEach(s => stances.push(s));
  }

  if (stances.length === 0) {
    stances.push('דפוס ידע פעיל');
  }
  return stances;
}

export default function DomainInsightExplorer({ 
  diaryData, 
  graphNodes: propGraphNodes, 
  entries: propEntries = [], 
  onNavigateToEntry, 
  onOpenTraceability, 
  onSelectNodeInGraph, 
  onSelectConcept 
}) {
  // Resolve nodes & links from either direct props or diaryData context
  const nodes = useMemo(() => {
    if (propGraphNodes && propGraphNodes.length > 0) return propGraphNodes;
    if (diaryData?.filteredNodes && diaryData.filteredNodes.length > 0) return diaryData.filteredNodes;
    if (diaryData?.rawGraphData?.nodes && diaryData.rawGraphData.nodes.length > 0) return diaryData.rawGraphData.nodes;
    return [];
  }, [propGraphNodes, diaryData]);

  const links = useMemo(() => {
    if (diaryData?.filteredLinks && diaryData.filteredLinks.length > 0) return diaryData.filteredLinks;
    if (diaryData?.rawGraphData?.links && diaryData.rawGraphData.links.length > 0) return diaryData.rawGraphData.links;
    return [];
  }, [diaryData]);

  const entries = useMemo(() => {
    if (propEntries && propEntries.length > 0) return propEntries;
    if (diaryData?.entries && diaryData.entries.length > 0) return diaryData.entries;
    return [];
  }, [propEntries, diaryData]);

  const [activeDomainId, setActiveDomainId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNoise, setShowNoise] = useState(false);

  // Calculate Pattern Salience, Domain Buckets & Degrees
  const { enrichedNodes, domainBuckets, noiseNodes, nodeDegrees } = useMemo(() => {
    const degrees = {};
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      degrees[s] = (degrees[s] || 0) + 1;
      degrees[t] = (degrees[t] || 0) + 1;
    });

    const buckets = {
      work: [],
      family: [],
      health: [],
      finance: [],
      growth: []
    };
    const noise = [];

    const enriched = nodes.map(node => {
      const nodeName = node.label || node.name || node.id || '';
      const isNoise = isNoisyMention(nodeName);

      // Frequency calculation
      const edgeCount = Array.isArray(node.relatedEdges) ? node.relatedEdges.length : 0;
      const deg = degrees[node.id] || 0;
      const rawFreq = node.occurrencesCount || node.frequency || node.val || Math.max(edgeCount, deg, 1);
      const frequency = typeof rawFreq === 'number' ? Math.max(1, Math.round(rawFreq)) : 1;

      // SpanDays calculation
      let spanDays = 0;
      const dates = [];
      if (node.date) dates.push(new Date(node.date).getTime());
      if (node.firstSeen && node.lastSeen) {
        dates.push(new Date(node.firstSeen).getTime());
        dates.push(new Date(node.lastSeen).getTime());
      }
      if (Array.isArray(node.relatedEdges)) {
        node.relatedEdges.forEach(e => {
          if (e.timestamp) dates.push(e.timestamp);
          if (e.date) dates.push(new Date(e.date).getTime());
        });
      }
      if (dates.length >= 2) {
        const minT = Math.min(...dates);
        const maxT = Math.max(...dates);
        spanDays = Math.max(0, Math.round((maxT - minT) / (1000 * 60 * 60 * 24)));
      }

      // Confidence weight calculation
      let confidenceWeight = 0.85;
      if (typeof node.epistemicConfidence === 'number') {
        confidenceWeight = node.epistemicConfidence;
      } else if (node.confidence === 'Fact') {
        confidenceWeight = 1.0;
      } else if (node.confidence === 'Inference') {
        confidenceWeight = 0.8;
      } else if (node.confidence === 'Opinion') {
        confidenceWeight = 0.6;
      }

      // Pattern Salience Formula: Frequency * ln(1 + SpanDays + 1) * ConfidenceWeight
      const patternSalience = Number(
        (frequency * Math.log(1 + spanDays + 1) * confidenceWeight).toFixed(2)
      );

      const domain = classifyNodeDomain(node);

      const enrichedItem = {
        ...node,
        frequency,
        spanDays,
        confidenceWeight,
        patternSalience,
        assignedDomain: domain,
        degree: deg,
        isNoise
      };

      if (isNoise) {
        noise.push(enrichedItem);
      } else {
        if (buckets[domain]) {
          buckets[domain].push(enrichedItem);
        } else {
          buckets.growth.push(enrichedItem);
        }
      }

      return enrichedItem;
    });

    // Sort every bucket by Pattern Salience descending
    Object.keys(buckets).forEach(dKey => {
      buckets[dKey].sort((a, b) => b.patternSalience - a.patternSalience);
    });
    noise.sort((a, b) => b.patternSalience - a.patternSalience);

    return {
      enrichedNodes: enriched,
      domainBuckets: buckets,
      noiseNodes: noise,
      nodeDegrees: degrees
    };
  }, [nodes, links]);

  // Handle concept selection
  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
    if (onSelectConcept) onSelectConcept(node);
  }, [onSelectConcept]);

  // Causal network for selected node
  const selectedCausalNetwork = useMemo(() => {
    if (!selectedNode) return null;
    const cid = selectedNode.id;
    const incoming = [];
    const outgoing = [];

    // From global links
    links.forEach(link => {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      const rel = link.relation || link.label || 'קשור_ל';

      if (t === cid) {
        const found = enrichedNodes.find(n => n.id === s);
        if (found) incoming.push({ node: found, relation: rel });
      } else if (s === cid) {
        const found = enrichedNodes.find(n => n.id === t);
        if (found) outgoing.push({ node: found, relation: rel });
      }
    });

    // From node.relatedEdges if links was empty
    if (incoming.length === 0 && outgoing.length === 0 && Array.isArray(selectedNode.relatedEdges)) {
      selectedNode.relatedEdges.forEach(e => {
        const rel = e.relation || 'קשור_ל';
        if (e.target && e.target !== cid) {
          const found = enrichedNodes.find(n => n.id === e.target) || { id: e.target, label: e.target };
          outgoing.push({ node: found, relation: rel });
        } else if (e.source && e.source !== cid) {
          const found = enrichedNodes.find(n => n.id === e.source) || { id: e.source, label: e.source };
          incoming.push({ node: found, relation: rel });
        }
      });
    }

    return { node: selectedNode, incoming, outgoing };
  }, [selectedNode, links, enrichedNodes]);

  // Quotes and stances for selected node
  const selectedNodeQuotes = useMemo(() => {
    if (!selectedNode) return [];
    return extractQuotesForNode(selectedNode, entries);
  }, [selectedNode, entries]);

  const selectedNodeStances = useMemo(() => {
    if (!selectedNode) return [];
    return extractStancesForNode(selectedNode);
  }, [selectedNode]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return enrichedNodes
      .filter(n => (n.label || n.name || n.id).toLowerCase().includes(q))
      .sort((a, b) => b.patternSalience - a.patternSalience)
      .slice(0, 10);
  }, [enrichedNodes, searchQuery]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      direction: 'rtl',
      overflowY: 'auto'
    }}>
      {/* Top Header & Search */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}>
            <Compass size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                סייר תחומי חיים ודפוסים
              </h1>
              <span style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.18)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Macro Hub & Salience
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              מבט-על נקי על 5 תחומי החיים עם דירוג בולטות (Pattern Salience), ציטוטים אמיתיים ושרשרת ראיות.
            </p>
          </div>
        </div>

        {/* Global Search & Noise Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowNoise(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '9px',
              background: showNoise ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${showNoise ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
              color: showNoise ? '#fbbf24' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="הצג מופעים נקודתיים/רעש שסוננו (כגון '2 קילוגרם', '4-5 פעמים בשבוע')"
          >
            <Filter size={14} />
            <span>רעש שסונן ({noiseNodes.length})</span>
          </button>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="חפש דפוס, מושג או יעד..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 36px 8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                left: 0,
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                marginTop: '6px',
                zIndex: 40,
                maxHeight: '280px',
                overflowY: 'auto'
              }}>
                {searchResults.map(res => {
                  const domMeta = Object.values(LIFE_DOMAINS).find(d => d.id === res.assignedDomain) || LIFE_DOMAINS.GROWTH;
                  return (
                    <div
                      key={res.id}
                      onClick={() => {
                        handleSelectNode(res);
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff' }}>
                          {res.label || res.name || res.id}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          ציון בולטות: <strong>{res.patternSalience}</strong> | {res.frequency} מופעים
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: domMeta.badgeBg,
                        color: domMeta.badgeText,
                        fontWeight: 700
                      }}>
                        {domMeta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Selected Entity Detailed Evidence & Causal Drawer */}
        {selectedNode && (
          <div style={{
            background: '#111827',
            borderRadius: '18px',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            padding: '24px',
            marginBottom: '32px',
            position: 'relative',
            animation: 'fadeIn 0.2s ease'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                position: 'absolute',
                top: '18px',
                left: '20px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <X size={14} /> סגור פירוט
            </button>

            {/* Top Concept Info Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
                padding: '6px 12px',
                borderRadius: '10px',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Sparkles size={20} />
                <span>{selectedNode.label || selectedNode.name || selectedNode.id}</span>
              </div>

              {/* Salience Badge */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#f59e0b',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <TrendingUp size={15} />
                <span>ציון בולטות: {selectedNode.patternSalience || 0}</span>
                <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 500 }}>
                  ({selectedNode.frequency || 1} מופעים לאורך {selectedNode.spanDays || 0} ימים)
                </span>
              </div>

              {/* Domain Badge */}
              {(() => {
                const dom = Object.values(LIFE_DOMAINS).find(d => d.id === selectedNode.assignedDomain) || LIFE_DOMAINS.GROWTH;
                return (
                  <span style={{
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: dom.badgeBg,
                    color: dom.badgeText,
                    fontWeight: 700
                  }}>
                    {dom.label}
                  </span>
                );
              })()}

              {/* Stance Badges */}
              {selectedNodeStances.map((stance, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#c7d2fe',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    fontWeight: 600
                  }}
                >
                   עמדה: {stance}
                </span>
              ))}
            </div>

            {/* Action Buttons: Network Switch + Traceability */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
              {onSelectNodeInGraph && (
                <button
                  onClick={() => onSelectNodeInGraph(selectedNode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#38bdf8',
                    color: '#090d16',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(56, 189, 248, 0.4)'
                  }}
                >
                  <Network size={16} />
                  <span>🕸️ הצג ברשת הסמנטית</span>
                </button>
              )}

              {onOpenTraceability && (
                <button
                  onClick={() => onOpenTraceability(selectedNode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>🔍 שרשרת ראיות (Traceability)</span>
                </button>
              )}
            </div>

            {/* 2-Column Grid: Left = Real Verbatim Quotes, Right = Direct Causal Connections */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Authentic Quotes Column */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700 }}>
                  <BookOpen size={18} />
                  <span>ציטוטים אותנטיים מתוך יומן הרשומות ({selectedNodeQuotes.length})</span>
                </div>

                {selectedNodeQuotes.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
                    לא נמצאו ציטוטים ישירים עבור מושג זה. המושג חולץ על בסיס קשרים בגרף.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto' }}>
                    {selectedNodeQuotes.map((q, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(30, 41, 59, 0.6)',
                          borderRight: '3px solid #38bdf8',
                          borderRadius: '8px',
                          padding: '10px 14px'
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                          "{q.text}"
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.72rem', color: '#94a3b8' }}>
                          <span>📅 {q.date || 'תאריך מתועד'}</span>
                          {q.entryId && onNavigateToEntry && (
                            <button
                              onClick={() => onNavigateToEntry(q.entryId)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <span>צפה ברשומה המלאה</span>
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Causal Connections Column */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#a855f7', fontSize: '0.9rem', fontWeight: 700 }}>
                  <TrendingUp size={18} />
                  <span>קשרים סיבתיים ישירים (גורמים ותוצאות)</span>
                </div>

                {selectedCausalNetwork && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Incoming */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                        ⬅️ גורמים שמשפיעים או מפעילים ({selectedCausalNetwork.incoming.length}):
                      </div>
                      {selectedCausalNetwork.incoming.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>אין גורמים מתועדים</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selectedCausalNetwork.incoming.slice(0, 5).map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectNode(item.node)}
                              style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                fontSize: '0.78rem',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <span>{item.node.label || item.node.name || item.node.id}</span>
                              <span style={{ fontSize: '0.68rem', color: '#a855f7' }}>({item.relation})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Outgoing */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                        ➡️ תוצאות, השפעות ויעדים מונעים ({selectedCausalNetwork.outgoing.length}):
                      </div>
                      {selectedCausalNetwork.outgoing.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>אין תוצאות מתועדות</div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selectedCausalNetwork.outgoing.slice(0, 5).map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectNode(item.node)}
                              style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                fontSize: '0.78rem',
                                color: '#e2e8f0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <span>{item.node.label || item.node.name || item.node.id}</span>
                              <span style={{ fontSize: '0.68rem', color: '#38bdf8' }}>({item.relation})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* 5 Macro Life Domain Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {Object.entries(LIFE_DOMAINS).map(([key, domain]) => {
            const Icon = domain.icon;
            const domainNodes = domainBuckets[domain.id] || [];
            const isExpanded = activeDomainId === domain.id;

            return (
              <div
                key={domain.id}
                style={{
                  background: '#111827',
                  borderRadius: '16px',
                  border: `1px solid ${isExpanded ? domain.color : 'rgba(255, 255, 255, 0.08)'}`,
                  boxShadow: isExpanded ? `0 8px 30px ${domain.color}25` : '0 4px 14px rgba(0, 0, 0, 0.25)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Header Banner */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: domain.bg,
                      color: domain.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                        {domain.label}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {domain.english}
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: domain.badgeBg,
                    color: domain.badgeText
                  }}>
                    {domainNodes.length} דפוסים
                  </span>
                </div>

                {/* Domain Description */}
                <div style={{ padding: '12px 20px 8px 20px', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {domain.description}
                </div>

                {/* Top Ranked Patterns (Salience Ranking) */}
                <div style={{ padding: '10px 20px 16px 20px', flex: 1 }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>דפוסים מובילים לפי בולטות (Salience):</span>
                    <span>ציון בולטות</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {domainNodes.slice(0, isExpanded ? 30 : 6).map(node => (
                      <button
                        key={node.id}
                        onClick={() => handleSelectNode(node)}
                        style={{
                          fontSize: '0.82rem',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          background: selectedNode?.id === node.id ? domain.badgeBg : 'rgba(30, 41, 59, 0.5)',
                          color: selectedNode?.id === node.id ? domain.badgeText : '#e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = domain.color;
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                          e.currentTarget.style.background = selectedNode?.id === node.id ? domain.badgeBg : 'rgba(30, 41, 59, 0.5)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{node.label || node.name || node.id}</span>
                          {node.frequency > 1 && (
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              ({node.frequency} מופעים)
                            </span>
                          )}
                        </div>

                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: domain.color,
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}>
                          {node.patternSalience}
                        </span>
                      </button>
                    ))}
                  </div>

                  {domainNodes.length > 6 && (
                    <button
                      onClick={() => setActiveDomainId(isExpanded ? null : domain.id)}
                      style={{
                        marginTop: '12px',
                        fontSize: '0.78rem',
                        color: domain.color,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0
                      }}
                    >
                      {isExpanded ? 'הצג פחות ▲' : `הצג את כל ${domainNodes.length} הדפוסים ▼`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible Noise Section */}
        {showNoise && (
          <div style={{
            marginTop: '32px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '16px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', marginBottom: '10px' }}>
              <AlertCircle size={18} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                מופעים נקודתיים ורעש שסוננו מהסייר הראשי ({noiseNodes.length})
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
              מופעים כגון כמויות בדידות, יחידות מידה או תדירויות חד-פעמיות שאינם מייצגים דפוס חיים ארוך טווח:
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {noiseNodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleSelectNode(n)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  <span>{n.label || n.name || n.id}</span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginRight: '4px' }}>
                    (בולטות: {n.patternSalience})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
