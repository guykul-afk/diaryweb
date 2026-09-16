#!/usr/bin/env node

/**
 * record-lesson.js
 * CLI helper for recording experiences/lessons to .wikiskill and syncing with global QA skills.
 * 
 * Usage:
 *   node scripts/record-lesson.js --title=Issue Title --category=UI|Build|Firestore|Auth|Engine --failure=Details --solution=Fix --lesson=Rule
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const parsed = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, ...vals] = arg.slice(2).split('=');
    parsed[key] = vals.join('=');
  }
}

const {
  title = 'Untitled Issue',
  category = 'General',
  failure = 'Not specified',
  solution = 'Not specified',
  lesson = 'Not specified'
} = parsed;

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const monthYear = ${String(now.getMonth() + 1).padStart(2, '0')}-;

// 1. Create Log Entry in .wikiskill/logs/
const logDir = path.join(projectRoot, '.wikiskill', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFileName = log_.md;
const logFilePath = path.join(logDir, logFileName);
const logContent = # Log: 
- **Date**: 
- **Category**: 
- **Trigger**: Recorded via record-lesson.js

## What Failed / Rework Needed


## Solution


## Lesson Learned

;

fs.writeFileSync(logFilePath, logContent, 'utf8');
console.log([WikiSkill] Created log entry: .wikiskill/logs/);

// 2. Append to .wikiskill/wiki.md
const wikiPath = path.join(projectRoot, '.wikiskill', 'wiki.md');
if (fs.existsSync(wikiPath)) {
  let wikiContent = fs.readFileSync(wikiPath, 'utf8');
  const bullet = * ** | [] :** \n;
  
  if (wikiContent.includes('* טרם נרשמו לקחים חדשים בפרויקט זה.')) {
    wikiContent = wikiContent.replace('* טרם נרשמו לקחים חדשים בפרויקט זה. תיעוד יתבצע באופן אוטומטי בהתרחש אחד מ-4 הטריגרים.\n', '');
  }

  if (wikiContent.includes('## לקחים מצטברים (Cumulative Lessons)')) {
    wikiContent = wikiContent.replace('## לקחים מצטברים (Cumulative Lessons)', ## לקחים מצטברים (Cumulative Lessons)\n);
  } else {
    wikiContent += \n## לקחים מצטברים (Cumulative Lessons)\n;
  }
  fs.writeFileSync(wikiPath, wikiContent, 'utf8');
  console.log([WikiSkill] Appended lesson to .wikiskill/wiki.md);
}

// 3. Sync to continuous-qa-learning/SKILL.md if accessible
const globalQaPath = path.resolve('C:/Users/guyku/.gemini/config/skills/continuous-qa-learning/SKILL.md');
if (fs.existsSync(globalQaPath)) {
  let qaContent = fs.readFileSync(globalQaPath, 'utf8');
  const qaBullet = * ** | [] :** \n;
  if (qaContent.includes('## 3. יומן לקחים מביקורות קודמות')) {
    qaContent = qaContent.replace('## 3. יומן לקחים מביקורות קודמות\n', ## 3. יומן לקחים מביקורות קודמות\n);
    fs.writeFileSync(globalQaPath, qaContent, 'utf8');
    console.log([WikiSkill] Synced lesson to global continuous-qa-learning/SKILL.md);
  }
}

console.log('[WikiSkill] Successfully completed recording.');
