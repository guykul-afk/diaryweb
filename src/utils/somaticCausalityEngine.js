/**
 * Somatic Causality & Biometric Analytics Engine
 * Part of OKF Knowledge Viewer (v2.0)
 * 
 * Pure, zero-dependency, mathematically rigorous engine for:
 * 1. Health metric extraction & canonicalization
 * 2. Personal rolling baselines (μ, σ) and normalized Z-scores
 * 3. Lagged somatic causality analysis (t-1, t, t+1, t+2)
 * 4. Somatic dissonance detection (cognitive mood vs physiological reality)
 * 5. Stance trajectories & aspiration-action gap analysis
 */

/**
 * Robust UTC-safe date offset helper
 * Avoids daylight-saving-time skew on YYYY-MM-DD
 */
export function offsetDate(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  
  const dateObj = new Date(Date.UTC(y, m, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + days);
  return dateObj.toISOString().split('T')[0];
}

/**
 * Calculates calendar day distance between two YYYY-MM-DD strings
 */
export function getDaysBetween(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 0;
  const d1 = new Date(dateStrA);
  const d2 = new Date(dateStrB);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  return Math.round(Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Helper to compute arithmetic mean
 */
function calcMean(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((acc, val) => acc + val, 0);
  return sum / arr.length;
}

/**
 * Helper to compute sample standard deviation with safe fallback
 */
function calcStdDev(arr, meanVal) {
  if (!arr || arr.length < 2) return 0;
  const m = meanVal !== undefined ? meanVal : calcMean(arr);
  const sumSq = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0);
  return Math.sqrt(sumSq / (arr.length - 1));
}

/**
 * 1. extractHealthMetricsMap(graphNodes)
 * Extracts all HealthMetric nodes into a map keyed by YYYY-MM-DD
 */
export function extractHealthMetricsMap(graphNodes) {
  const map = {};
  if (!Array.isArray(graphNodes)) return map;

  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  graphNodes.forEach(node => {
    if (!node) return;
    const isHealthNode = 
      node.type === 'HealthMetric' ||
      (typeof node.id === 'string' && node.id.startsWith('Health_')) ||
      node.metadata?.metrics ||
      node.metrics;

    if (!isHealthNode) return;

    // Resolve date
    let dateStr = node.date || node.frontmatter?.date;
    if (!dateStr && typeof node.id === 'string') {
      const match = node.id.match(/\d{4}[-_]\d{2}[-_]\d{2}/);
      if (match) {
        dateStr = match[0].replace(/_/g, '-');
      }
    }

    if (!dateStr || typeof dateStr !== 'string') return;
    dateStr = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

    // Resolve metrics from different possible nested keys
    const raw = node.metrics || node.metadata?.metrics || node;

    const hrv = parseNum(raw.hrv ?? raw.hrv_ms ?? raw.heart_rate_variability);
    const resting_hr = parseNum(raw.resting_hr ?? raw.resting_heart_rate ?? raw.rhr ?? raw.restingHeartRate);
    const sleep_score = parseNum(raw.sleep_score ?? raw.sleepScore ?? raw.sleep_efficiency);
    const steps = parseNum(raw.steps ?? raw.step_count ?? raw.stepCount);
    const active_minutes = parseNum(raw.active_minutes ?? raw.activeMinutes ?? raw.exercise_minutes);

    // Only add if at least one metric is valid
    if (hrv !== null || resting_hr !== null || sleep_score !== null || steps !== null) {
      map[dateStr] = {
        date: dateStr,
        hrv,
        resting_hr,
        sleep_score,
        steps,
        active_minutes
      };
    }
  });

  return map;
}

/**
 * 2. computePersonalRollingBaselines(healthMetricsByDate, windowDays = 30)
 * Computes rolling mean, rolling std, and daily Z-scores for each date
 */
export function computePersonalRollingBaselines(healthMetricsByDate, windowDays = 30) {
  const result = {
    byDate: {},
    datesSorted: [],
    globalBaselines: {
      hrv: { mean: 0, std: 1, count: 0 },
      resting_hr: { mean: 0, std: 1, count: 0 },
      sleep_score: { mean: 0, std: 1, count: 0 },
      steps: { mean: 0, std: 1, count: 0 }
    }
  };

  if (!healthMetricsByDate || typeof healthMetricsByDate !== 'object') {
    return result;
  }

  // Extract and sort dates chronologically
  const dates = Object.keys(healthMetricsByDate)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (dates.length === 0) return result;
  result.datesSorted = dates;

  // Compute global baselines as fallback anchor
  const globalArrays = { hrv: [], resting_hr: [], sleep_score: [], steps: [] };
  dates.forEach(d => {
    const m = healthMetricsByDate[d];
    if (m.hrv !== null && m.hrv !== undefined) globalArrays.hrv.push(m.hrv);
    if (m.resting_hr !== null && m.resting_hr !== undefined) globalArrays.resting_hr.push(m.resting_hr);
    if (m.sleep_score !== null && m.sleep_score !== undefined) globalArrays.sleep_score.push(m.sleep_score);
    if (m.steps !== null && m.steps !== undefined) globalArrays.steps.push(m.steps);
  });

  const SAFE_STD_FLOORS = {
    hrv: 1.5,
    resting_hr: 1.0,
    sleep_score: 2.0,
    steps: 500.0
  };

  const computeSummary = (arr, key) => {
    const m = calcMean(arr);
    const s = Math.max(calcStdDev(arr, m), SAFE_STD_FLOORS[key] || 1.0);
    return { mean: m, std: s, count: arr.length };
  };

  result.globalBaselines = {
    hrv: computeSummary(globalArrays.hrv, 'hrv'),
    resting_hr: computeSummary(globalArrays.resting_hr, 'resting_hr'),
    sleep_score: computeSummary(globalArrays.sleep_score, 'sleep_score'),
    steps: computeSummary(globalArrays.steps, 'steps')
  };

  // For each date, compute rolling stats over preceding windowDays
  dates.forEach((dateStr, idx) => {
    const currentMetrics = healthMetricsByDate[dateStr];
    const currentDateMs = new Date(dateStr).getTime();
    const windowStartMs = currentDateMs - (windowDays * 24 * 60 * 60 * 1000);

    // Collect historical samples prior to or on this date within window
    const windowSamples = { hrv: [], resting_hr: [], sleep_score: [], steps: [] };
    for (let i = 0; i <= idx; i++) {
      const pastDate = dates[i];
      const pastMs = new Date(pastDate).getTime();
      if (pastMs >= windowStartMs && pastMs <= currentDateMs) {
        const pm = healthMetricsByDate[pastDate];
        if (pm.hrv !== null) windowSamples.hrv.push(pm.hrv);
        if (pm.resting_hr !== null) windowSamples.resting_hr.push(pm.resting_hr);
        if (pm.sleep_score !== null) windowSamples.sleep_score.push(pm.sleep_score);
        if (pm.steps !== null) windowSamples.steps.push(pm.steps);
      }
    }

    const rollingMean = {};
    const rollingStd = {};
    const zScores = { hrv: null, resting_hr: null, sleep_score: null, steps: null };

    ['hrv', 'resting_hr', 'sleep_score', 'steps'].forEach(key => {
      const samples = windowSamples[key];
      const global = result.globalBaselines[key];
      let mu = global.mean;
      let sigma = global.std;

      // Use rolling if we have at least 5 window samples
      if (samples.length >= 5) {
        mu = calcMean(samples);
        sigma = Math.max(calcStdDev(samples, mu), SAFE_STD_FLOORS[key] || 1.0);
      } else if (samples.length > 1) {
        // Blended with global baseline for smooth warmup
        const localMu = calcMean(samples);
        const weight = samples.length / 5;
        mu = (localMu * weight) + (global.mean * (1 - weight));
        sigma = Math.max(calcStdDev(samples, mu), SAFE_STD_FLOORS[key] || 1.0);
      }

      rollingMean[key] = parseFloat(mu.toFixed(2));
      rollingStd[key] = parseFloat(sigma.toFixed(2));

      const rawVal = currentMetrics[key];
      if (rawVal !== null && rawVal !== undefined) {
        const z = (rawVal - mu) / sigma;
        zScores[key] = parseFloat(z.toFixed(2));
      }
    });

    // Compute composite physiological load score:
    // HRV drop (negative Z) increases load
    // Resting HR rise (positive Z) increases load
    // Sleep drop (negative Z) increases load
    let loadComponents = [];
    if (zScores.hrv !== null) loadComponents.push(-zScores.hrv);
    if (zScores.resting_hr !== null) loadComponents.push(zScores.resting_hr);
    if (zScores.sleep_score !== null) loadComponents.push(-0.6 * zScores.sleep_score);

    let physiologicalLoadScore = 0;
    if (loadComponents.length > 0) {
      physiologicalLoadScore = parseFloat((loadComponents.reduce((a, b) => a + b, 0) / loadComponents.length).toFixed(2));
    }

    let statusLabelHe = 'איזון פיזיולוגי';
    let statusColor = '#3b82f6'; // Indigo/Blue
    if (physiologicalLoadScore >= 1.2 || (zScores.hrv !== null && zScores.hrv <= -1.2)) {
      statusLabelHe = 'עומס פיזיולוגי חריג';
      statusColor = '#ef4444'; // Rose / Red
    } else if (physiologicalLoadScore >= 0.5) {
      statusLabelHe = 'עומס גופני מתון';
      statusColor = '#f59e0b'; // Amber
    } else if (physiologicalLoadScore <= -0.6 || (zScores.hrv !== null && zScores.hrv >= 1.0)) {
      statusLabelHe = 'התאוששות גבוהה';
      statusColor = '#10b981'; // Emerald
    }

    result.byDate[dateStr] = {
      date: dateStr,
      metrics: currentMetrics,
      rollingMean,
      rollingStd,
      zScores,
      physiologicalLoadScore,
      statusLabelHe,
      statusColor
    };
  });

  return result;
}

/**
 * 3. computeLaggedEntityBiometrics(entries, graphNodes, baselinesResult)
 * Evaluates physiological lag (t-1, t, t+1, t+2) for entities mentioned in entries
 */
export function computeLaggedEntityBiometrics(entries, graphNodes, baselinesResult) {
  if (!entries || !baselinesResult || !baselinesResult.byDate) {
    return [];
  }

  const baselinesByDate = baselinesResult.byDate;

  // Build candidate entity names to search in entries
  const candidateEntities = new Map();

  // 1. Collect entities from graphNodes
  if (Array.isArray(graphNodes)) {
    graphNodes.forEach(n => {
      if (!n || !n.id) return;
      if (n.type === 'HealthMetric') return;
      const label = n.label || n.name || n.id;
      if (!label || label.length < 2) return;
      
      const cleanLabel = String(label).replace(/^knowledge_base_/i, '').replace(/_/g, ' ').trim();
      if (cleanLabel.length < 2) return;

      candidateEntities.set(cleanLabel.toLowerCase(), {
        id: n.id,
        rawName: cleanLabel,
        type: n.type || 'Concept',
        category: n.category || 'General'
      });
    });
  }

  // Helper to extract mention set from an entry
  const extractEntryEntities = (entry) => {
    const matched = new Set();
    const content = (entry.content || entry.text || '').toLowerCase();
    
    // Check topics from frontmatter
    const topics = entry.frontmatter?.topics || entry.topics || [];
    topics.forEach(t => {
      if (typeof t === 'string' && t.trim()) {
        const clean = t.replace(/^#/, '').replace(/_/g, ' ').trim();
        if (clean.length >= 2) matched.add(clean);
      }
    });

    // Check candidate graph entities
    candidateEntities.forEach((info, key) => {
      if (key.length >= 3 && content.includes(key)) {
        matched.add(info.rawName);
      }
    });

    return Array.from(matched);
  };

  // Map entity -> list of entries with dates and quotes
  const entityOccurrences = new Map();

  entries.forEach(entry => {
    const dateStr = entry.frontmatter?.date || entry.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

    const entitiesInEntry = extractEntryEntities(entry);
    const content = entry.content || entry.text || '';

    entitiesInEntry.forEach(entityName => {
      if (!entityOccurrences.has(entityName)) {
        entityOccurrences.set(entityName, []);
      }

      // Extract a representative quote snippet
      let snippet = '';
      if (content) {
        const idx = content.toLowerCase().indexOf(entityName.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(content.length, idx + entityName.length + 80);
          snippet = (start > 0 ? '...' : '') + content.substring(start, end).replace(/\n+/g, ' ').trim() + (end < content.length ? '...' : '');
        } else {
          snippet = content.substring(0, 100).replace(/\n+/g, ' ').trim() + '...';
        }
      }

      entityOccurrences.get(entityName).push({
        entryId: entry.id,
        date: dateStr,
        snippet
      });
    });
  });

  // Calculate lagged biometrics for entities with at least 2 occurrences
  const results = [];

  entityOccurrences.forEach((occurrences, entityName) => {
    if (occurrences.length < 2) return;

    // Filter occurrences that have at least same-day or lagged biometrics
    const validOccurrences = occurrences.filter(occ => {
      const t = occ.date;
      return baselinesByDate[t] || baselinesByDate[offsetDate(t, 1)] || baselinesByDate[offsetDate(t, -1)];
    });

    if (validOccurrences.length < 2) return;

    const lags = [-1, 0, 1, 2];
    const lagStats = {
      '-1': { zHrv: [], zRhr: [], zSleep: [] },
      '0': { zHrv: [], zRhr: [], zSleep: [] },
      '1': { zHrv: [], zRhr: [], zSleep: [] },
      '2': { zHrv: [], zRhr: [], zSleep: [] }
    };

    validOccurrences.forEach(occ => {
      lags.forEach(lag => {
        const targetDate = offsetDate(occ.date, lag);
        const data = baselinesByDate[targetDate];
        if (data && data.zScores) {
          if (data.zScores.hrv !== null) lagStats[String(lag)].zHrv.push(data.zScores.hrv);
          if (data.zScores.resting_hr !== null) lagStats[String(lag)].zRhr.push(data.zScores.resting_hr);
          if (data.zScores.sleep_score !== null) lagStats[String(lag)].zSleep.push(data.zScores.sleep_score);
        }
      });
    });

    // Calculate average Z-scores per lag
    const lagAverages = {};
    let totalSamplesAcrossLags = 0;

    lags.forEach(lag => {
      const s = lagStats[String(lag)];
      lagAverages[String(lag)] = {
        zHrv: s.zHrv.length > 0 ? parseFloat(calcMean(s.zHrv).toFixed(2)) : null,
        zRhr: s.zRhr.length > 0 ? parseFloat(calcMean(s.zRhr).toFixed(2)) : null,
        zSleep: s.zSleep.length > 0 ? parseFloat(calcMean(s.zSleep).toFixed(2)) : null,
        count: s.zHrv.length
      };
      totalSamplesAcrossLags += s.zHrv.length;
    });

    if (totalSamplesAcrossLags < 3) return;

    // Evaluate delayed effect (t, t+1)
    const t0Hrv = lagAverages['0'].zHrv ?? 0;
    const t1Hrv = lagAverages['1'].zHrv ?? t0Hrv;
    const t0Sleep = lagAverages['0'].zSleep ?? 0;
    const t1Sleep = lagAverages['1'].zSleep ?? t0Sleep;
    const t0Rhr = lagAverages['0'].zRhr ?? 0;
    const t1Rhr = lagAverages['1'].zRhr ?? t0Rhr;

    const avgDelayedHrv = (t0Hrv + t1Hrv) / 2;
    const avgDelayedSleep = (t0Sleep + t1Sleep) / 2;
    const avgDelayedRhr = (t0Rhr + t1Rhr) / 2;

    // Classification
    let classification = 'NEUTRAL';
    let labelHe = 'ניטרלי / מעורב';
    let badgeColor = '#64748b'; // Slate

    if (avgDelayedHrv <= -0.40 || avgDelayedSleep <= -0.45 || avgDelayedRhr >= 0.45) {
      classification = 'SOMATIC_DRAIN';
      labelHe = 'טריגר שוחק (Somatic Drain)';
      badgeColor = '#ef4444'; // Red
    } else if (avgDelayedHrv >= 0.35 || avgDelayedSleep >= 0.40 || avgDelayedRhr <= -0.35) {
      classification = 'SOMATIC_ANCHOR';
      labelHe = 'עוגן מווסת (Somatic Anchor)';
      badgeColor = '#10b981'; // Green
    }

    // Impact magnitude score for sorting
    const impactMagnitude = Math.abs(avgDelayedHrv) + Math.abs(avgDelayedRhr) + Math.abs(avgDelayedSleep);

    results.push({
      entityName,
      occurrenceCount: validOccurrences.length,
      sampleDates: validOccurrences.map(v => v.date).slice(0, 5),
      sampleQuotes: validOccurrences.map(v => v.snippet).filter(Boolean).slice(0, 3),
      lagAverages,
      avgDelayedHrv: parseFloat(avgDelayedHrv.toFixed(2)),
      avgDelayedRhr: parseFloat(avgDelayedRhr.toFixed(2)),
      avgDelayedSleep: parseFloat(avgDelayedSleep.toFixed(2)),
      classification,
      labelHe,
      badgeColor,
      impactMagnitude: parseFloat(impactMagnitude.toFixed(2))
    });
  });

  // Sort by impact magnitude descending
  return results.sort((a, b) => b.impactMagnitude - a.impactMagnitude);
}

/**
 * 4. detectSomaticDissonance(entries, baselinesResult)
 * Discovers dates where subjective text diverges sharply from objective physiological signals
 */
export function detectSomaticDissonance(entries, baselinesResult) {
  if (!entries || !baselinesResult || !baselinesResult.byDate) {
    return [];
  }

  const baselinesByDate = baselinesResult.byDate;
  const dissonanceEvents = [];

  const positiveMoodKeywords = ['שמח', 'טוב', 'רגוע', 'שלווה', 'מעולה', 'חיובי', 'אושר', 'הנאה', 'שקט', 'רגועה', 'בסדר', 'פרודוקטיבי', 'calm', 'happy', 'great', 'fine'];
  const anxiousMoodKeywords = ['חרדה', 'לחץ', 'דאגה', 'תסכול', 'משבר', 'כעס', 'פחד', 'אימה', 'ייאוש', 'ספק', 'מוצף', 'stress', 'anxious', 'fear', 'overwhelmed'];

  entries.forEach(entry => {
    const dateStr = entry.frontmatter?.date || entry.date;
    if (!dateStr) return;

    const base = baselinesByDate[dateStr];
    if (!base || !base.zScores) return;

    const moodStr = String(entry.frontmatter?.mood || entry.mood || '').toLowerCase();
    const content = String(entry.content || entry.text || '').toLowerCase();
    const fullText = `${moodStr} ${content.substring(0, 400)}`;

    const isExplicitlyPositive = positiveMoodKeywords.some(kw => fullText.includes(kw));
    const isExplicitlyAnxious = anxiousMoodKeywords.some(kw => fullText.includes(kw));

    const zHrv = base.zScores.hrv;
    const zRhr = base.zScores.resting_hr;
    const zSleep = base.zScores.sleep_score;
    const loadScore = base.physiologicalLoadScore || 0;

    // Case A: Stress Masking (Positive/Calm text + Acute Physiological Strain)
    // HRV drop <= -1.15 OR RHR rise >= +1.15 OR composite load >= 1.2
    const hasAcuteSomaticStress = (zHrv !== null && zHrv <= -1.15) || 
                                  (zRhr !== null && zRhr >= 1.15) || 
                                  loadScore >= 1.2;

    if (hasAcuteSomaticStress && isExplicitlyPositive && !isExplicitlyAnxious) {
      let snippet = entry.content ? entry.content.substring(0, 160).replace(/\n+/g, ' ').trim() + '...' : '';
      dissonanceEvents.push({
        entryId: entry.id,
        date: dateStr,
        mood: entry.frontmatter?.mood || 'רגוע/חיובי',
        snippet,
        zHrv: zHrv !== null ? zHrv : 'N/A',
        zRhr: zRhr !== null ? zRhr : 'N/A',
        zSleep: zSleep !== null ? zSleep : 'N/A',
        hrvVal: base.metrics?.hrv,
        rhrVal: base.metrics?.resting_hr,
        loadScore,
        dissonanceType: 'STRESS_MASKED',
        typeLabelHe: 'שחיקה סמויה / הדחקה גופנית',
        typeBadgeColor: '#ef4444',
        explanationHe: 'הטקסט ביומן משדר רוגע, שליטה או מצב רוח חיובי, אך הגוף נמצא בעומס אוטונומי חריף (HRV צנח משמעותית או דופק המנוחה זינק).'
      });
      return;
    }

    // Case B: Somatic Resilience (High cognitive anxiety, but physiological baseline is resilient & balanced)
    // HRV >= +0.80 and RHR <= -0.50, or load <= -0.7
    const hasHighSomaticResilience = (zHrv !== null && zHrv >= 0.8) && (zRhr !== null && zRhr <= 0.2);

    if (hasHighSomaticResilience && isExplicitlyAnxious) {
      let snippet = entry.content ? entry.content.substring(0, 160).replace(/\n+/g, ' ').trim() + '...' : '';
      dissonanceEvents.push({
        entryId: entry.id,
        date: dateStr,
        mood: entry.frontmatter?.mood || 'דאגה/עומס מנטלי',
        snippet,
        zHrv: zHrv !== null ? zHrv : 'N/A',
        zRhr: zRhr !== null ? zRhr : 'N/A',
        zSleep: zSleep !== null ? zSleep : 'N/A',
        hrvVal: base.metrics?.hrv,
        rhrVal: base.metrics?.resting_hr,
        loadScore,
        dissonanceType: 'COGNITIVE_OVERREACT',
        typeLabelHe: 'סערה קוגניטיבית מול חוסן גופני',
        typeBadgeColor: '#8b5cf6', // Violet
        explanationHe: 'דיווחת על חרדה, ספקות או מתח מחשבתי כבד, אך מדדי הלב והמערכת האוטונומית שידרו יציבות ועמידות גופנית גבוהה.'
      });
    }
  });

  // Sort newest first
  return dissonanceEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * 5. analyzeStanceTrajectories(graphNodes, entries)
 * Evaluates Aspiration vs Action gaps and classifies entities into:
 * - ACTION_MOMENTUM (תנופה וביצוע בפועל)
 * - ASPIRATION_TRAP (מלכודת שאיפה כרונית)
 * - AVOIDANCE_CONFLICT (לולאת הימנעות וקונפליקט)
 */
export function analyzeStanceTrajectories(graphNodes, entries) {
  if (!Array.isArray(graphNodes) || graphNodes.length === 0) {
    return {
      all: [],
      byCategory: {
        ACTION_MOMENTUM: [],
        ASPIRATION_TRAP: [],
        AVOIDANCE_CONFLICT: []
      }
    };
  }

  // Keywords that designate stance shifts
  const ACTION_KEYWORDS = ['פעולה', 'ביצוע', 'השלים', 'הפחית', 'מתקדם', 'יישם', 'עשה', 'סיים', 'הצליח', 'action', 'done', 'execute', 'progress'];
  const ASPIRATION_KEYWORDS = ['רוצה', 'שואף', 'חולם_על', 'מתכנן', 'צריך', 'מנסה', 'מקווה', 'להתחיל', 'aspires', 'wants', 'plan', 'should', 'need'];
  const AVOIDANCE_KEYWORDS = ['מתנגש_עם', 'חושש_מ', 'דוחה', 'הימנעות', 'קונפליקט', 'פחד', 'בריחה', 'מעכב', 'תקיעות', 'avoid', 'fear', 'conflict', 'delay'];

  // Map entries for date lookups & quotes
  const entryDateMap = new Map();
  if (Array.isArray(entries)) {
    entries.forEach(e => {
      if (e.frontmatter?.date) entryDateMap.set(e.id, e.frontmatter.date);
    });
  }

  const results = [];

  graphNodes.forEach(node => {
    if (!node || !node.id) return;
    if (node.type === 'HealthMetric') return;

    const label = node.label || node.name || node.id;
    if (!label || label.length < 2) return;

    const cleanLabel = String(label).replace(/^knowledge_base_/i, '').replace(/_/g, ' ').trim();
    if (cleanLabel.length < 2) return;

    // Calculate dates & time span
    const firstSeen = node.firstSeen || node.created_at || (node.sourceQuotes && node.sourceQuotes[0]?.date) || '2024-01-01';
    const lastSeen = node.lastSeen || node.updated_at || (node.sourceQuotes && node.sourceQuotes[node.sourceQuotes.length - 1]?.date) || firstSeen;
    const spanDays = Math.max(1, getDaysBetween(firstSeen, lastSeen));

    const frequency = node.frequency || node.weight || (node.sourceQuotes?.length || 1);
    const confidence = node.confidence || (node.metadata?.confidence ? parseFloat(node.metadata.confidence) : 0.85);

    // Mathematical formula for Pattern Salience:
    // PatternSalience(e) = Frequency(e) * ln(1 + SpanDays(e) + 1) * ConfidenceWeight(e)
    const salience = parseFloat((frequency * Math.log(2 + spanDays) * confidence).toFixed(2));

    // Stance & edge analysis
    let actionScore = 0;
    let aspirationScore = 0;
    let avoidanceScore = 0;

    // Examine relatedEdges / links
    const edges = node.relatedEdges || node.links || [];
    edges.forEach(edge => {
      const rel = String(edge.relation || edge.label || '').toLowerCase();
      if (ACTION_KEYWORDS.some(kw => rel.includes(kw))) actionScore += 2;
      if (ASPIRATION_KEYWORDS.some(kw => rel.includes(kw))) aspirationScore += 2;
      if (AVOIDANCE_KEYWORDS.some(kw => rel.includes(kw))) avoidanceScore += 2;
    });

    // Examine node content / description
    const textPool = `${node.content || ''} ${node.description || ''} ${cleanLabel}`.toLowerCase();
    ACTION_KEYWORDS.forEach(kw => { if (textPool.includes(kw)) actionScore += 1; });
    ASPIRATION_KEYWORDS.forEach(kw => { if (textPool.includes(kw)) aspirationScore += 1; });
    AVOIDANCE_KEYWORDS.forEach(kw => { if (textPool.includes(kw)) avoidanceScore += 1; });

    // Examine source quotes
    const quotes = [];
    if (Array.isArray(node.sourceQuotes)) {
      node.sourceQuotes.forEach(sq => {
        const text = sq.quote || sq.text || '';
        if (text) {
          quotes.push(text.trim());
          const ltext = text.toLowerCase();
          ACTION_KEYWORDS.forEach(kw => { if (ltext.includes(kw)) actionScore += 1; });
          ASPIRATION_KEYWORDS.forEach(kw => { if (ltext.includes(kw)) aspirationScore += 1; });
          AVOIDANCE_KEYWORDS.forEach(kw => { if (ltext.includes(kw)) avoidanceScore += 1; });
        }
      });
    }

    // Classify category based on scores and duration
    let category = 'ASPIRATION_TRAP';
    let categoryLabelHe = 'מלכודת שאיפה כרונית (נשאר ב"צריך/רוצה")';
    let categoryBadgeColor = '#f59e0b'; // Amber

    if (avoidanceScore > actionScore && avoidanceScore >= aspirationScore) {
      category = 'AVOIDANCE_CONFLICT';
      categoryLabelHe = 'לולאת הימנעות וקונפליקט';
      categoryBadgeColor = '#ef4444'; // Red
    } else if (actionScore >= aspirationScore && actionScore > 0) {
      category = 'ACTION_MOMENTUM';
      categoryLabelHe = 'תנופה וביצוע בפועל';
      categoryBadgeColor = '#10b981'; // Emerald
    } else {
      // Default: Aspiration trap if spanDays is large without sufficient action
      category = 'ASPIRATION_TRAP';
      categoryLabelHe = 'מלכודת שאיפה כרונית (נשאר ב"צריך/רוצה")';
      categoryBadgeColor = '#f59e0b'; // Amber
    }

    results.push({
      id: node.id,
      name: cleanLabel,
      type: node.type || 'Concept',
      salience,
      frequency,
      spanDays,
      firstSeen,
      lastSeen,
      category,
      categoryLabelHe,
      categoryBadgeColor,
      actionScore,
      aspirationScore,
      avoidanceScore,
      quotes: quotes.slice(0, 3)
    });
  });

  // Sort by salience descending
  results.sort((a, b) => b.salience - a.salience);

  const byCategory = {
    ACTION_MOMENTUM: results.filter(r => r.category === 'ACTION_MOMENTUM'),
    ASPIRATION_TRAP: results.filter(r => r.category === 'ASPIRATION_TRAP'),
    AVOIDANCE_CONFLICT: results.filter(r => r.category === 'AVOIDANCE_CONFLICT')
  };

  return {
    all: results,
    byCategory
  };
}
