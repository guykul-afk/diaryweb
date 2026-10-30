#!/usr/bin/env node

/**
 * record-lesson.js (Global WikiSkill + Harness² CLI)
 * Records structured execution experiences and transferable lessons (Cue -> Lesson -> Evidence)
 * to both the active project's `.wikiskill/` knowledge base and the global `continuous-qa-learning` skill.
 *
 * Usage:
 *   node "C:\Users\User\.gemini\config\skills\wikiskill\scripts\record-lesson.js" \
 *     --project="C:\Users\User\archknow" \
 *     --dim="INV|DOM" \
 *     --category="Architecture|UI|Build|Firestore|Auth|Engine|BIM" \
 *     --title="Short Descriptive Title" \
 *     --cue="When <shape of situation>..." \
 *     --failure="Exact trajectory moment or failure observed" \
 *     --solution="How the issue was resolved" \
 *     --lesson="Imperative checkable rule naming the component" \
 *     --confidence="high|medium|low"
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const args = process.argv.slice(2);
const parsed = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(2, eqIdx).trim();
      const val = arg.slice(eqIdx + 1).trim();
      parsed[key] = val;
    }
  }
}

const projectRoot = path.resolve(parsed.project || process.cwd());
const dim = (parsed.dim || 'DOM').toUpperCase();
const category = parsed.category || 'General';
const title = parsed.title || 'Untitled Lesson';
const cue = parsed.cue || 'When performing tasks in this domain';
const failure = parsed.failure || 'Not specified';
const solution = parsed.solution || 'Not specified';
const lesson = parsed.lesson || 'Not specified';
const confidence = parsed.confidence || 'high';

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
const isoDate = now.toISOString().slice(0, 10);

// 1. Ensure project .wikiskill/logs directory exists
const wikiskillDir = path.join(projectRoot, '.wikiskill');
const logDir = path.join(wikiskillDir, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const logFileName = `log_${timestamp}.md`;
const logFilePath = path.join(logDir, logFileName);
const logContent = `# Harness² & WikiSkill Experience Log: ${title}
- **Date**: ${now.toISOString()}
- **Dimension**: \`${dim}\` (${dim === 'INV' ? 'Invariant / Agent Machinery' : 'Domain / Practitioner Knowledge'})
- **Category**: \`${category}\`
- **Confidence**: \`${confidence}\`

## Cue (Shape of Situation)
${cue}

## Evidence (Trajectory Failure & Resolution)
- **Observed Failure / Divergence**: ${failure}
- **Applied Fix**: ${solution}

## Transferable Lesson
${lesson}
`;

fs.writeFileSync(logFilePath, logContent.replace(/\r\n/g, '\n'), { encoding: 'utf8' });
console.log(`[WikiSkill+Harness²] Created log entry: ${logFilePath}`);

// 2. Update or initialize project .wikiskill/wiki.md
const wikiPath = path.join(wikiskillDir, 'wiki.md');
const structuredBullet = `* **${isoDate} | [${dim}:${category}] ${title}:** **Cue:** ${cue} → **Lesson:** ${lesson} *(Evidence: ${failure} → ${solution} | Confidence: ${confidence})*\n`;

if (fs.existsSync(wikiPath)) {
  let wikiContent = fs.readFileSync(wikiPath, 'utf8').replace(/\r\n/g, '\n');
  if (wikiContent.includes('## לקחים מצטברים (Cumulative Lessons)')) {
    wikiContent = wikiContent.replace(
      '## לקחים מצטברים (Cumulative Lessons)\n',
      `## לקחים מצטברים (Cumulative Lessons)\n${structuredBullet}`
    );
  } else if (wikiContent.includes('## 2. יומן לקחים וחוקי ברזל שנלמדו (Lessons Learned)')) {
    wikiContent = wikiContent.replace(
      '## 2. יומן לקחים וחוקי ברזל שנלמדו (Lessons Learned)\n',
      `## 2. יומן לקחים וחוקי ברזל שנלמדו (Lessons Learned)\n${structuredBullet}`
    );
  } else {
    wikiContent = wikiContent.trimEnd() + `\n\n${structuredBullet}`;
  }
  fs.writeFileSync(wikiPath, wikiContent, { encoding: 'utf8' });
  console.log(`[WikiSkill+Harness²] Appended lesson to ${wikiPath}`);
} else {
  const initialWiki = `# Project Knowledge Wiki (WikiSkill + Harness²)

מאגר הידע המצטבר, לקחים (Cue → Lesson → Evidence), פתרונות לכשלים ודפוסי עבודה עבור הפרויקט.

## כללי יסוד (Core Guidelines)
1. **חובת תיעוד אוטונומית (4 Triggers):** תיעוד אוטומטי בכל ביצוע חוזר (Rework), כשל סמוי (Silent Failure), תיקון משתמש (User Correction) או פער ארכיטקטורה מול מציאות.
2. **הפרדת ממדים (INV מול DOM):** הבחנה בין כללי הפעלת כלים ומכונה (\`INV\`) לבין מומחיות תחומית (\`DOM\`).
3. **בדיקת White-Box ו-Zero-Trust:** אימות לוגיקה פנימית ותוצרים מרונדרים ולא רק קודי סיום.

## לקחים מצטברים (Cumulative Lessons)
${structuredBullet}`;
  fs.writeFileSync(wikiPath, initialWiki.replace(/\r\n/g, '\n'), { encoding: 'utf8' });
  console.log(`[WikiSkill+Harness²] Initialized and recorded lesson to ${wikiPath}`);
}

// 3. Sync to global continuous-qa-learning/SKILL.md (resolving current user home dynamically)
const candidateQaPaths = [
  path.join(os.homedir(), '.gemini', 'config', 'skills', 'continuous-qa-learning', 'SKILL.md'),
  'C:/Users/User/.gemini/config/skills/continuous-qa-learning/SKILL.md',
  'C:/Users/guyku/.gemini/config/skills/continuous-qa-learning/SKILL.md',
];

for (const qaPath of new Set(candidateQaPaths.map(p => path.resolve(p)))) {
  if (fs.existsSync(qaPath)) {
    let qaContent = fs.readFileSync(qaPath, 'utf8').replace(/\r\n/g, '\n');
    const qaBullet = `* **${monthYear} | [${dim}:${category}] ${title}:** **Cue:** ${cue} → **Lesson:** ${lesson} *(Evidence: ${failure} → ${solution})*\n`;
    if (qaContent.includes('## 3. יומן לקחים מביקורות קודמות\n')) {
      qaContent = qaContent.replace(
        '## 3. יומן לקחים מביקורות קודמות\n',
        `## 3. יומן לקחים מביקורות קודמות\n${qaBullet}`
      );
    } else {
      qaContent = qaContent.trimEnd() + `\n${qaBullet}`;
    }
    fs.writeFileSync(qaPath, qaContent, { encoding: 'utf8' });
    console.log(`[WikiSkill+Harness²] Synced lesson to global QA skill: ${qaPath}`);
    break;
  }
}
