/**
 * src/utils/semanticGraphEnricher.js
 * Utility module for enriching graph nodes and edges with semantic categories,
 * sentiments, edge types, directions, and summaries.
 * Synchronous and safe for both Browser/React and Node.js environments.
 */

export const CATEGORIES = {
  HEALTH: 'בריאות ופיזיולוגיה',
  RELATIONSHIPS: 'משפחה וקשרים',
  EMOTIONS: 'רגשות ומצבי רוח',
  PROJECTS: 'פרויקטים ועבודה',
  CONCEPTS: 'מושגים ותיאוריות',
  INSIGHTS: 'תובנות ודפוסים'
};

export const CATEGORY_COLORS = {
  'בריאות ופיזיולוגיה': {
    main: '#10b981', // Emerald Green
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.38)',
    label: 'בריאות ופיזיולוגיה'
  },
  'משפחה וקשרים': {
    main: '#8b5cf6', // Violet
    bg: 'rgba(139, 92, 246, 0.14)',
    border: 'rgba(139, 92, 246, 0.38)',
    label: 'משפחה וקשרים'
  },
  'רגשות ומצבי רוח': {
    main: '#f43f5e', // Rose / Pink
    bg: 'rgba(244, 63, 94, 0.14)',
    border: 'rgba(244, 63, 94, 0.38)',
    label: 'רגשות ומצבי רוח'
  },
  'תובנות ודפוסים': {
    main: '#f59e0b', // Amber / Gold
    bg: 'rgba(245, 158, 11, 0.18)',
    border: 'rgba(245, 158, 11, 0.45)',
    label: 'תובנות ודפוסים'
  },
  'תובנות (Insights)': {
    main: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.18)',
    border: 'rgba(245, 158, 11, 0.45)',
    label: 'תובנות'
  },
  'מטרות ואירועים': {
    main: '#06b6d4', // Cyan
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.38)',
    label: 'מטרות ואירועים'
  },
  'פרויקטים ועבודה': {
    main: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.38)',
    label: 'פרויקטים ועבודה'
  },
  'מושגים ותיאוריות': {
    main: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.30)',
    label: 'מושגים ותיאוריות'
  },
  'כללי ומושגים': {
    main: '#64748b', // Slate
    bg: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.30)',
    label: 'כללי ומושגים'
  }
};

export const RELATIONSHIP_COLORS = {
  MITIGATES: '#22c55e',       // Green / Positive
  CAUSES: '#ef4444',          // Red / Negative
  ASSOCIATED_WITH: '#38bdf8'   // Cyan/Blue / Neutral
};

export const RELATIONSHIP_LABELS = {
  MITIGATES: 'מפחית / משפר (MITIGATES)',
  CAUSES: 'גורם / מעורר (CAUSES)',
  ASSOCIATED_WITH: 'משפיע / קשור (ASSOCIATED_WITH)'
};

export const SENTIMENTS = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral'
};

export const EDGE_TYPES = {
  CAUSES: 'CAUSES',
  MITIGATES: 'MITIGATES',
  ASSOCIATED_WITH: 'ASSOCIATED_WITH'
};

export const DIRECTIONS = {
  FORWARD: 'forward',
  BACKWARD: 'backward',
  UNDIRECTED: 'undirected'
};

const CATEGORY_KEYWORDS = {
  [CATEGORIES.HEALTH]: [
    'בריאות', 'פיזיולוגיה', 'שינה', 'תזונה', 'ספורט', 'כושר', 'אימון', 'דופק', 'משקל', 'גוף',
    'צעדים', 'תרופה', 'ויטמין', 'ריצה', 'הליכה', 'קלוריות', 'דיאטה', 'מאמץ', 'עייפות', 'חולי',
    'כאב', 'דם', 'הורמון', 'קורטיזול', 'דופמין', 'סרוטונין', 'תנועה', 'אכילה', 'מזון', 'בריאות_ותזונה',
    'health', 'sleep', 'body', 'fitness', 'workout', 'nutrition', 'sport', 'exercise', 'diet', 'weight', 'heart'
  ],
  [CATEGORIES.RELATIONSHIPS]: [
    'משפחה', 'זוגיות', 'קשרים', 'חברים', 'יחסים', 'הורות', 'אהבה', 'ילדים', 'נישואין', 'חברות',
    'אשה', 'אשת', 'בעל', 'אבא', 'אמא', 'אח', 'אחות', 'בן זוג', 'בת זוג', 'היקשרות', 'תקשורת',
    'קהילה', 'הורים', 'ילד', 'בנות', 'בנים', 'ידידות', 'רומנטיקה', 'משפחתי', 'זוגי', 'זוגיות_ומשפחה',
    'חברים_וקהילה', 'social', 'family', 'relationship', 'love', 'parent', 'attachment', 'friendship', 'marriage'
  ],
  [CATEGORIES.EMOTIONS]: [
    'רגשות', 'רגש', 'מצב רוח', 'חרדה', 'לחץ', 'פחד', 'דיכאון', 'שמחה', 'עצב', 'אשמה', 'בושה',
    'כעס', 'רווחה', 'סבל', 'תסכול', 'תקווה', 'התלהבות', 'קבלה', 'מלנכוליה', 'התרגשות', 'קנאה',
    'שלווה', 'אושר', 'דאגה', 'בדידות', 'שחיקה', 'פגיעות', 'הצפה', 'מצוקה', 'מועקה', 'עולם_פנימי',
    'anxiety', 'stress', 'emotion', 'mood', 'depression', 'joy', 'fear', 'guilt', 'shame', 'sadness', 'anger'
  ],
  [CATEGORIES.PROJECTS]: [
    'פרויקט', 'פרויקטים', 'עבודה', 'קריירה', 'משימות', 'משימה', 'עסק', 'לימודים', 'פיתוח', 'תכנון',
    'ניהול', 'קוד', 'הישגים', 'מקצוע', 'יזמות', 'סטארטאפ', 'פרודוקטיביות', 'זמן', 'כסף', 'תקציב',
    'עומס', 'יעדים', 'מטרות', 'חברה', 'ארגון', 'משרד', 'שעות עבודה', 'עבודה_וקריירה', 'פיננסים',
    'project', 'work', 'career', 'task', 'productivity', 'code', 'business', 'job', 'developer', 'startup'
  ],
  [CATEGORIES.INSIGHTS]: [
    'תובנה', 'תובנות', 'הבנה', 'מסקנה', 'לקח', 'למידה', 'מוסר השכל', 'חוק',
    'insight', 'insights', 'takeaway', 'realization'
  ],
  [CATEGORIES.CONCEPTS]: [
    'תיאוריה', 'מושג', 'פילוסופיה', 'פילוסוף', 'מודל', 'רעיון', 'ספרות', 'שירה', 'שיר', 'גישה',
    'אסתטיקה', 'אתיקה', 'פסיכולוגיה', 'סוציולוגיה', 'כתיבה', 'תרבות', 'אמנות', 'שיווי משקל',
    'מחשבה', 'הגות', 'הוגה', 'רוחניות', 'משמעות', 'תודעה', 'רוחניות_ומשמעות', 'למידה_והתפתחות',
    'concept', 'theory', 'model', 'philosophy', 'psychology', 'literature', 'art', 'existential'
  ]
};

const NEGATIVE_KEYWORDS = [
  'חרדה', 'לחץ', 'עייפות', 'דיכאון', 'עצב', 'כעס', 'אשמה', 'בושה', 'תסכול', 'פחד', 'סבל',
  'מחלה', 'ניכור', 'אובדן', 'כישלון', 'בדידות', 'ספק', 'כאב', 'קושי', 'מלנכוליה', 'קונפליקט',
  'מתח', 'שחיקה', 'דאגה', 'מצוקה', 'מועקה', 'הצפה', 'שעמום', 'מגלומניה', 'אבל', 'פגיעה',
  'התפוררות', 'מכשול', 'בעיה', 'anxiety', 'stress', 'depression', 'fatigue', 'pain', 'fear',
  'guilt', 'loneliness', 'conflict', 'burnout', 'doubt', 'grief', 'suffering', 'sadness', 'anger', 'shame'
];

const POSITIVE_KEYWORDS = [
  'שמחה', 'אנרגיה', 'ספורט', 'כושר', 'בריאות', 'אהבה', 'אושר', 'שלווה', 'רווחה', 'תקווה',
  'התלהבות', 'קבלה', 'הצלחה', 'סיפוק', 'הודיה', 'חברות', 'צמיחה', 'חוסן', 'גמישות', 'אומץ',
  'חיובי', 'שגשוג', 'איזון', 'משמעות', 'חיבור', 'מידות טובות', 'שחרור', 'פגיעות חיובית',
  'חיוניות', 'הגשמה', 'הנאה', 'שקט', 'חופש', 'ריפוי', 'joy', 'energy', 'sport', 'fitness',
  'health', 'love', 'happiness', 'peace', 'hope', 'gratitude', 'growth', 'resilience', 'courage',
  'success', 'balance', 'healing', 'fulfillment'
];

const CAUSES_RELATIONS = [
  'מוביל_ל', 'מוביל ל', 'גורם_ל', 'גורם ל', 'מובילה_ל', 'מובילים_ל', 'מביא ל', 'מביא_ל',
  'מייצר', 'יוצר', 'מפתח', 'מזניק', 'מניע', 'מגביר', 'גורר', 'מביאה ל', 'מביאים ל', 'מוליד',
  'מנבא_את', 'מנבא את', 'leads_to', 'causes', 'triggers', 'creates', 'generates', 'drives', 'results_in'
];

const MITIGATES_RELATIONS = [
  'מפחית', 'מפחיתה', 'משפר', 'משפרת', 'מרגיע', 'מרגיעה', 'מונע', 'מונעת', 'מקל', 'מקלת',
  'פתרון', 'מרפא', 'פותר', 'מצמצם', 'מצמצמת', 'ממתן', 'ממתנת', 'מוריד', 'שואף להוריד',
  'רוצה להוריד', 'רוצה לרדת', 'שואף_לאזן', 'הפחית', 'mitigates', 'reduces', 'improves',
  'relieves', 'prevents', 'cures', 'eases', 'soothes'
];

const BACKWARD_RELATIONS = [
  'נובע_מ', 'נגזר_מ', 'תוצאה_של', 'caused_by', 'derived_from', 'originates_from'
];

const UNDIRECTED_RELATIONS = [
  'קשור_ל', 'קשור ל', 'שייך_ל', 'שייכת_ל', 'מתנגש_עם', 'נפגש_עם', 'מכיר_את', 'מהווה',
  'חבר_של', 'associated_with', 'related_to', 'belongs_to', 'part_of', 'is_a'
];

/**
 * Classifies a node into one of the main parent categories.
 */
export function classifyParentCategory(node) {
  if (node.parent_category && Object.values(CATEGORIES).includes(node.parent_category)) {
    return node.parent_category;
  }

  const type = (node.type || '').toLowerCase();
  const nodeId = (node.id || '').toLowerCase();

  if (type === 'insight' || nodeId.startsWith('insight')) {
    return CATEGORIES.INSIGHTS;
  }
  if (type === 'health' || type === 'metric' || type === 'biological') {
    return CATEGORIES.HEALTH;
  }
  if (type === 'emotion' || type === 'mood') {
    return CATEGORIES.EMOTIONS;
  }
  if (type === 'person' || type === 'relationship' || type === 'family') {
    return CATEGORIES.RELATIONSHIPS;
  }
  if (type === 'project' || type === 'work' || type === 'task') {
    return CATEGORIES.PROJECTS;
  }

  const label = String(node.label || node.title || node.name || '');
  const tags = Array.isArray(node.tags) ? node.tags.join(' ') : String(node.tags || node.category || '');
  const content = String(node.content || node.description || '').slice(0, 500);

  const scores = {};
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[catName] = 0;
    for (const kw of keywords) {
      const lowerKw = kw.toLowerCase();
      if (label.toLowerCase().includes(lowerKw) || nodeId.includes(lowerKw)) {
        scores[catName] += 3;
      }
      if (tags.toLowerCase().includes(lowerKw)) {
        scores[catName] += 2;
      }
      if (content.toLowerCase().includes(lowerKw)) {
        scores[catName] += 1;
      }
    }
  }

  let bestCat = CATEGORIES.CONCEPTS;
  let maxScore = 0;
  for (const [catName, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCat = catName;
    }
  }

  return bestCat;
}

/**
 * Determines node sentiment: 'positive', 'negative', or 'neutral'
 */
export function determineSentiment(node) {
  if (node.sentiment && Object.values(SENTIMENTS).includes(node.sentiment)) {
    return node.sentiment;
  }

  const label = String(node.label || node.title || node.name || node.id || '').toLowerCase();
  const tags = Array.isArray(node.tags) ? node.tags.join(' ') : String(node.tags || '');
  const content = String(node.content || node.description || '').slice(0, 500).toLowerCase();

  let posScore = 0;
  let negScore = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    const lkw = kw.toLowerCase();
    if (label.includes(lkw)) posScore += 2;
    if (tags.toLowerCase().includes(lkw)) posScore += 2;
    if (content.includes(lkw)) posScore += 1;
  }

  for (const kw of NEGATIVE_KEYWORDS) {
    const lkw = kw.toLowerCase();
    if (label.includes(lkw)) negScore += 2;
    if (tags.toLowerCase().includes(lkw)) negScore += 2;
    if (content.includes(lkw)) negScore += 1;
  }

  if (posScore > negScore) return SENTIMENTS.POSITIVE;
  if (negScore > posScore) return SENTIMENTS.NEGATIVE;
  return SENTIMENTS.NEUTRAL;
}

/**
 * Classifies edge relationship into 'CAUSES', 'MITIGATES', or 'ASSOCIATED_WITH'
 */
export function classifyEdgeType(edge) {
  if (edge.edge_type && Object.values(EDGE_TYPES).includes(edge.edge_type)) {
    return edge.edge_type;
  }

  const rel = String(edge.relation || edge.relationship || edge.label || edge.type || '').toLowerCase();

  for (const kw of CAUSES_RELATIONS) {
    if (rel.includes(kw.toLowerCase())) {
      return EDGE_TYPES.CAUSES;
    }
  }

  for (const kw of MITIGATES_RELATIONS) {
    if (rel.includes(kw.toLowerCase())) {
      return EDGE_TYPES.MITIGATES;
    }
  }

  return EDGE_TYPES.ASSOCIATED_WITH;
}

/**
 * Determines edge direction: 'forward', 'backward', or 'undirected'
 */
export function determineDirection(edge, edgeType) {
  if (edge.direction && Object.values(DIRECTIONS).includes(edge.direction)) {
    return edge.direction;
  }

  const rel = String(edge.relation || edge.relationship || edge.label || edge.type || '').toLowerCase();

  for (const kw of BACKWARD_RELATIONS) {
    if (rel.includes(kw.toLowerCase())) {
      return DIRECTIONS.BACKWARD;
    }
  }

  if (edgeType === EDGE_TYPES.CAUSES || edgeType === EDGE_TYPES.MITIGATES) {
    return DIRECTIONS.FORWARD;
  }

  for (const kw of UNDIRECTED_RELATIONS) {
    if (rel.includes(kw.toLowerCase())) {
      return DIRECTIONS.UNDIRECTED;
    }
  }

  return DIRECTIONS.UNDIRECTED;
}

function cleanRelationText(rel) {
  if (!rel) return 'קשור ל';
  return String(rel).replace(/_/g, ' ');
}

/**
 * Generates a concise Hebrew tooltip summary explaining the link
 */
export function generateEdgeSummary(edge, sourceNode, targetNode, edgeType) {
  if (edge.summary && typeof edge.summary === 'string' && edge.summary.trim() !== '') {
    return edge.summary;
  }

  const sourceLabel = sourceNode?.label || sourceNode?.title || sourceNode?.name || (typeof edge.source === 'string' ? edge.source : edge.source?.id) || 'צומת מקור';
  const targetLabel = targetNode?.label || targetNode?.title || targetNode?.name || (typeof edge.target === 'string' ? edge.target : edge.target?.id) || 'צומת יעד';

  const rel = String(edge.relation || edge.relationship || edge.label || edge.type || '');
  const cleanRel = cleanRelationText(rel);

  if (rel === 'שייך_ל' || rel === 'שייכת_ל') {
    return `${sourceLabel} שייך לקטגוריה/נושא ${targetLabel}`;
  }
  if (rel === 'מוביל_ל' || rel === 'מובילה_ל' || rel === 'גורם_ל') {
    return `${sourceLabel} מוביל באופן ישיר ל-${targetLabel}`;
  }
  if (rel === 'מפחית' || rel === 'מפחיתה') {
    return `${sourceLabel} מפחית את ${targetLabel}`;
  }
  if (rel === 'משפר' || rel === 'משפרת') {
    return `${sourceLabel} משפר את ${targetLabel}`;
  }
  if (rel === 'מתנגש_עם') {
    return `${sourceLabel} עומד בסתירה או מתנגש עם ${targetLabel}`;
  }
  if (rel === 'חווה_את') {
    return `${sourceLabel} חווה את ${targetLabel}`;
  }
  if (rel === 'מתחייב_ל') {
    return `${sourceLabel} מתחייב ל-${targetLabel}`;
  }
  if (rel === 'חולם_על') {
    return `${sourceLabel} חולם ושואף ל-${targetLabel}`;
  }
  if (rel === 'עובד_על') {
    return `${sourceLabel} עובד ומתרגל את ${targetLabel}`;
  }
  if (rel === 'מנבא_את') {
    return `${sourceLabel} מנבא את ${targetLabel}`;
  }
  if (rel === 'קשור_ל') {
    return `${sourceLabel} קשור בזיקה ל-${targetLabel}`;
  }

  if (edgeType === EDGE_TYPES.CAUSES) {
    return `${sourceLabel} משפיע וגורם ל-${targetLabel} (${cleanRel})`;
  }
  if (edgeType === EDGE_TYPES.MITIGATES) {
    return `${sourceLabel} משפר/מפחית את ${targetLabel} (${cleanRel})`;
  }

  return `${sourceLabel} ${cleanRel} ${targetLabel}`;
}

/**
 * Main enrichment function.
 * Accepts either:
 *  - enrichGraphData(nodesArray, edgesArray)
 *  - enrichGraphData({ nodes: [...], edges: [...] })
 *  - enrichGraphData({ nodes: [...], links: [...] })
 *
 * @param {Array|Object} nodesArg - Array of nodes or graph object
 * @param {Array} [edgesArg] - Array of edges/links if first param is nodes array
 * @returns {{ nodes: Array, edges: Array, links: Array }} Enriched nodes and edges object
 */
export function enrichGraphData(nodesArg, edgesArg) {
  let rawNodes = [];
  let rawEdges = [];

  if (Array.isArray(nodesArg)) {
    rawNodes = nodesArg;
    rawEdges = Array.isArray(edgesArg) ? edgesArg : [];
  } else if (nodesArg && typeof nodesArg === 'object') {
    rawNodes = Array.isArray(nodesArg.nodes) ? nodesArg.nodes : [];
    rawEdges = Array.isArray(nodesArg.edges) 
      ? nodesArg.edges 
      : (Array.isArray(nodesArg.links) ? nodesArg.links : []);
  }

  const nodeMap = new Map();
  const enrichedNodes = rawNodes.map(node => {
    if (!node || typeof node !== 'object') return node;

    const parent_category = classifyParentCategory(node);
    const sentiment = determineSentiment(node);
    const isInsight = 
      node.type === 'Insight' || 
      node.category === 'תובנות' || 
      node.type === 'תובנה' ||
      parent_category === 'תובנות ודפוסים' ||
      parent_category === 'תובנות (Insights)';

    const categoryColor = CATEGORY_COLORS[parent_category]?.main || '#64748b';

    const enrichedNode = {
      ...node,
      parent_category,
      sentiment,
      isInsight,
      val: isInsight ? 20 : (node.val || node.weight ? Math.max(6, Math.min(14, node.val || node.weight * 2)) : 8),
      color: categoryColor,
      date: node.date || node.created_at || node.timestamp || node.date_str || null
    };

    if (node.id !== undefined && node.id !== null) {
      nodeMap.set(String(node.id), enrichedNode);
    }
    return enrichedNode;
  });

  const enrichedEdges = rawEdges.map(edge => {
    if (!edge || typeof edge !== 'object') return edge;

    const sourceId = typeof edge.source === 'object' && edge.source !== null ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' && edge.target !== null ? edge.target.id : edge.target;

    const sourceNode = sourceId !== undefined && sourceId !== null ? nodeMap.get(String(sourceId)) : null;
    const targetNode = targetId !== undefined && targetId !== null ? nodeMap.get(String(targetId)) : null;

    const edge_type = classifyEdgeType(edge);
    const direction = determineDirection(edge, edge_type);
    const summary = generateEdgeSummary(edge, sourceNode, targetNode, edge_type);
    const relationshipType = edge_type || 'ASSOCIATED_WITH';
    const edgeColor = RELATIONSHIP_COLORS[relationshipType] || '#38bdf8';

    return {
      ...edge,
      edge_type,
      relationshipType,
      color: edgeColor,
      direction,
      summary
    };
  });

  return {
    nodes: enrichedNodes,
    edges: enrichedEdges,
    links: enrichedEdges, // Alias for D3 / ForceGraph compatibility
    _enriched: true
  };
}

export default enrichGraphData;
