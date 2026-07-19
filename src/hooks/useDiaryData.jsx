import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { fetchFirebaseGraph, fetchFirebaseEntries, fetchTheoreticalConcepts } from '../firebase';

const DiaryDataContext = createContext(null);

export function DiaryDataProvider({ children, uid }) {
  const [rawGraphData, setRawGraphData] = useState({ nodes: [], links: [] });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global Filter / Control states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [minWeight, setMinWeight] = useState(1);
  const [visibleTypes, setVisibleTypes] = useState(['Concept', 'Person', 'Topic', 'Emotion']);
  const [minDegree, setMinDegree] = useState(0);
  const [minLinkWeight, setMinLinkWeight] = useState(1);
  const [limitEntities, setLimitEntities] = useState(30); // Dynamic slider default 30
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  const fetchData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const [graphData, entriesData, theoreticalData] = await Promise.all([
        fetchFirebaseGraph(uid),
        fetchFirebaseEntries(uid),
        fetchTheoreticalConcepts()
      ]);

      // Combine user nodes and theoretical concepts
      const combinedNodes = [...graphData.nodes];
      const combinedLinks = [...graphData.links];

      // Add/enrich theoretical concepts
      theoreticalData.nodes.forEach(tNode => {
        const lowerId = tNode.id.toLowerCase();
        const existing = combinedNodes.find(n => n.id.toLowerCase() === lowerId);
        if (existing) {
          existing.content = existing.content || tNode.content;
          existing.sourceFile = tNode.sourceFile;
          existing.isH1 = tNode.isH1;
          if (existing.type === 'Concept' && tNode.type !== 'Concept') {
            existing.type = tNode.type;
          }
        } else {
          combinedNodes.push(tNode);
        }
      });

      // Combine theoretical links, avoiding duplicates
      const existingLinkKeys = new Set(combinedLinks.map(l => {
        const s = (typeof l.source === 'object' ? l.source.id : l.source).toLowerCase();
        const t = (typeof l.target === 'object' ? l.target.id : l.target).toLowerCase();
        const label = (l.label || '').toLowerCase();
        return `${s}-${t}-${label}`;
      }));

      theoreticalData.links.forEach(tLink => {
        const s = tLink.source.toLowerCase();
        const t = tLink.target.toLowerCase();
        const label = tLink.label.toLowerCase();
        const key1 = `${s}-${t}-${label}`;
        const key2 = `${t}-${s}-${label}`;
        if (!existingLinkKeys.has(key1) && !existingLinkKeys.has(key2)) {
          combinedLinks.push(tLink);
          existingLinkKeys.add(key1);
        }
      });

      setRawGraphData({ nodes: combinedNodes, links: combinedLinks });
      setEntries(entriesData);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setRawGraphData({ nodes: [], links: [] });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchData();
  }, [uid]);

  // Extract unique topics and moods
  const uniqueTopics = useMemo(() => {
    const topics = new Set();
    entries.forEach(e => {
      if (e.frontmatter?.topics) {
        e.frontmatter.topics.forEach(t => topics.add(t));
      }
    });
    return Array.from(topics);
  }, [entries]);

  const uniqueMoods = useMemo(() => {
    const moods = new Set();
    entries.forEach(e => {
      if (e.frontmatter?.mood) moods.add(e.frontmatter.mood);
    });
    return Array.from(moods);
  }, [entries]);

  const allDatesSorted = useMemo(() => {
    const dates = entries
      .map(e => e.frontmatter?.date)
      .filter(d => d && d !== 'תאריך לא ידוע')
      .sort();
    return Array.from(new Set(dates));
  }, [entries]);

  useEffect(() => {
    if (allDatesSorted.length > 0) {
      setSelectedDateIndex(allDatesSorted.length - 1);
    }
  }, [allDatesSorted]);

  // Helper to determine node type
  const getNodeType = useCallback((node) => {
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
    if (uniqueTopics.some(t => t.toLowerCase() === node.id.toLowerCase())) return 'Topic';
    if (uniqueMoods.some(m => m.toLowerCase() === node.id.toLowerCase())) return 'Emotion';

    return 'Concept';
  }, [uniqueTopics, uniqueMoods]);

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

  // Map nodes to entries they appear in
  const conceptMetadataMap = useMemo(() => {
    const map = {};
    rawGraphData.nodes.forEach(node => {
      map[node.id.toLowerCase()] = {
        topics: new Set(),
        moods: new Set(),
        entries: []
      };
    });

    const entryTimeMsList = entries.map(entry => {
      let timeMs = null;
      if (entry.rawTimestamp) {
        timeMs = entry.rawTimestamp.toDate 
          ? entry.rawTimestamp.toDate().getTime() 
          : new Date(entry.rawTimestamp).getTime();
      }
      return { entry, timeMs };
    });

    entries.forEach(entry => {
      const entryText = (entry.content || '').toLowerCase();
      const entryTopics = entry.frontmatter?.topics || [];
      const entryMood = entry.frontmatter?.mood || 'ניטרלי';

      rawGraphData.nodes.forEach(node => {
        const nodeIdLower = node.id.toLowerCase();
        const nodeNameLower = (node.name || node.id).toLowerCase();
        
        const isMentioned = entryText.includes(nodeNameLower) || entryText.includes(nodeIdLower);

        if (isMentioned) {
          entryTopics.forEach(t => map[nodeIdLower]?.topics.add(t));
          map[nodeIdLower]?.moods.add(entryMood);
          if (!map[nodeIdLower]?.entries.some(e => e.id === entry.id)) {
            map[nodeIdLower]?.entries.push({ 
              id: entry.id, 
              date: entry.frontmatter?.date,
              timestamp: entry.rawTimestamp
            });
          }
        }
      });
    });

    rawGraphData.links.forEach(link => {
      if (!link.timestamp) return;
      const linkTime = Number(link.timestamp);
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const matched = entryTimeMsList.find(item => item.timeMs && Math.abs(item.timeMs - linkTime) < 5000);
      if (matched) {
        const entry = matched.entry;
        const entryTopics = entry.frontmatter?.topics || [];
        const entryMood = entry.frontmatter?.mood || 'ניטרלי';

        [sourceId, targetId].forEach(nodeId => {
          if (!nodeId) return;
          const nodeIdLower = nodeId.toLowerCase();
          const nodeMeta = map[nodeIdLower];
          if (nodeMeta) {
            entryTopics.forEach(t => nodeMeta.topics.add(t));
            nodeMeta.moods.add(entryMood);
            if (!nodeMeta.entries.some(e => e.id === entry.id)) {
              nodeMeta.entries.push({ 
                id: entry.id, 
                date: entry.frontmatter?.date,
                timestamp: entry.rawTimestamp
              });
            }
          }
        });
      }
    });

    return map;
  }, [rawGraphData.nodes, rawGraphData.links, entries]);

  // Derived filtered nodes based on criteria
  const filteredNodes = useMemo(() => {
    const maxDateStr = allDatesSorted[selectedDateIndex];

    const baseFiltered = rawGraphData.nodes.filter(node => {
      const type = getNodeType(node);
      if (!visibleTypes.includes(type)) return false;

      const nodeIdLower = node.id.toLowerCase();
      const metadata = conceptMetadataMap[nodeIdLower] || { topics: new Set(), moods: new Set(), entries: [] };

      if (node.weight < minWeight) return false;

      const degree = rawNodeDegrees[node.id] || 0;
      if (degree < minDegree) return false;

      if (allDatesSorted.length > 0 && maxDateStr && selectedDateIndex < allDatesSorted.length - 1) {
        const nodeEntries = metadata.entries || [];
        const hasEntryInVal = nodeEntries.some(e => e.date && e.date <= maxDateStr);
        if (!hasEntryInVal) return false;
      }

      if (selectedTopics.length > 0) {
        const hasMatchingTopic = selectedTopics.some(t => metadata.topics.has(t));
        if (!hasMatchingTopic) return false;
      }

      if (selectedMoods.length > 0) {
        const hasMatchingMood = selectedMoods.some(m => metadata.moods.has(m));
        if (!hasMatchingMood) return false;
      }

      return true;
    });

    // Handle Search filter (include primary and neighbors)
    let finalNodes = baseFiltered;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const primaryMatches = baseFiltered.filter(node => 
        (node.name || node.id).toLowerCase().includes(query) || 
        (node.content && node.content.toLowerCase().includes(query))
      );
      const primaryIds = new Set(primaryMatches.map(n => n.id));
      const finalActiveNodeIds = new Set(primaryIds);

      rawGraphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const baseFilteredNodeIds = new Set(baseFiltered.map(n => n.id));

        if (primaryIds.has(sourceId) && baseFilteredNodeIds.has(targetId)) {
          finalActiveNodeIds.add(targetId);
        }
        if (primaryIds.has(targetId) && baseFilteredNodeIds.has(sourceId)) {
          finalActiveNodeIds.add(sourceId);
        }
      });

      finalNodes = baseFiltered.filter(node => finalActiveNodeIds.has(node.id));
    }

    // Sort by weight/relevance and slice to limitEntities
    return finalNodes
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, limitEntities);
  }, [
    rawGraphData.nodes,
    rawGraphData.links,
    visibleTypes,
    minWeight,
    rawNodeDegrees,
    allDatesSorted,
    selectedDateIndex,
    selectedTopics,
    selectedMoods,
    searchQuery,
    limitEntities,
    conceptMetadataMap,
    getNodeType
  ]);

  // Derived filtered links matching filtered nodes
  const filteredLinks = useMemo(() => {
    const activeNodeIds = new Set(filteredNodes.map(n => n.id));
    return rawGraphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const linkWeight = link.weight || link.val || link.strength || link.value || 1;
      if (linkWeight < minLinkWeight) return false;

      return activeNodeIds.has(sourceId) && activeNodeIds.has(targetId);
    });
  }, [rawGraphData.links, filteredNodes, minLinkWeight]);

  // Storyline / Time-based calculations (Co-occurrence per month)
  const timeBucketsData = useMemo(() => {
    // 1. Group entries by YYYY-MM
    const buckets = {};
    entries.forEach(entry => {
      const dateStr = entry.frontmatter?.date;
      if (!dateStr || dateStr === 'תאריך לא ידוע') return;
      const month = dateStr.substring(0, 7); // "YYYY-MM"
      if (!buckets[month]) buckets[month] = [];
      buckets[month].push(entry);
    });

    const sortedMonths = Object.keys(buckets).sort();

    // 2. Map nodes to their occurrences in each month
    const entityOccurrence = {};
    filteredNodes.forEach(node => {
      entityOccurrence[node.id] = sortedMonths.map(month => {
        const monthEntries = buckets[month] || [];
        const occurrences = monthEntries.filter(entry => {
          const entryText = (entry.content || '').toLowerCase();
          const nodeIdLower = node.id.toLowerCase();
          const nodeNameLower = (node.name || node.id).toLowerCase();
          return entryText.includes(nodeNameLower) || entryText.includes(nodeIdLower);
        });
        return occurrences.length; // Number of mentions in this month
      });
    });

    // 3. Co-occurrence per month
    const coOccurrencePerMonth = sortedMonths.map((month, mIdx) => {
      const matrix = {};
      filteredNodes.forEach(n1 => {
        matrix[n1.id] = {};
        filteredNodes.forEach(n2 => {
          matrix[n1.id][n2.id] = 0;
        });
      });

      const monthEntries = buckets[month] || [];
      monthEntries.forEach(entry => {
        const text = (entry.content || '').toLowerCase();
        // Find all active entities in this entry
        const presentEntities = filteredNodes.filter(n => {
          const idL = n.id.toLowerCase();
          const nameL = (n.name || n.id).toLowerCase();
          return text.includes(idL) || text.includes(nameL);
        });

        // Increment co-occurrence pairs
        for (let i = 0; i < presentEntities.length; i++) {
          for (let j = i; j < presentEntities.length; j++) {
            const e1 = presentEntities[i].id;
            const e2 = presentEntities[j].id;
            matrix[e1][e2]++;
            if (e1 !== e2) {
              matrix[e2][e1]++;
            }
          }
        }
      });

      return matrix;
    });

    return {
      months: sortedMonths,
      occurrences: entityOccurrence,
      coOccurrences: coOccurrencePerMonth
    };
  }, [entries, filteredNodes]);

  return (
    <DiaryDataContext.Provider value={{
      rawGraphData,
      entries,
      loading,
      error,
      fetchData,
      uid,
      // Metadata
      uniqueTopics,
      uniqueMoods,
      allDatesSorted,
      conceptMetadataMap,
      getNodeType,
      rawNodeDegrees,
      // Filters
      searchQuery, setSearchQuery,
      selectedTopics, setSelectedTopics,
      selectedMoods, setSelectedMoods,
      minWeight, setMinWeight,
      visibleTypes, setVisibleTypes,
      minDegree, setMinDegree,
      minLinkWeight, setMinLinkWeight,
      limitEntities, setLimitEntities,
      selectedDateIndex, setSelectedDateIndex,
      // Filtered Results
      filteredNodes,
      filteredLinks,
      // Storyline data
      timeBucketsData
    }}>
      {children}
    </DiaryDataContext.Provider>
  );
}

export function useDiaryData() {
  const context = useContext(DiaryDataContext);
  if (!context) {
    throw new Error('useDiaryData must be used within a DiaryDataProvider');
  }
  return context;
}
