import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load API keys
let firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
const rootEnvPath = path.join(rootDir, '.env');
if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  const matchKey = content.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (matchKey && !firebaseApiKey) firebaseApiKey = matchKey[1].trim();
}

if (!firebaseApiKey) {
  console.error("ERROR: VITE_FIREBASE_API_KEY not found in environment or .env");
  process.exit(1);
}

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: firebaseApiKey,
  authDomain: "mindcloud-8ccc6.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TKB_DIR = path.join(rootDir, 'functions', 'okf', 'tkb');

const DOMAIN_MAP = {
  "inner_self": "עולם_פנימי",
  "meaning": "רוחניות_ומשמעות",
  "relationships": "זוגיות_ומשפחה",
  "health": "בריאות_ותזונה",
  "work": "עבודה_וקריירה",
  "social": "חברים_וקהילה",
  "finance": "פיננסים",
  "learning": "למידה_והתפתחות",
  "leisure": "פנאי_ותחביבים",
  "environment": "סביבה_ומגורים"
};

async function syncTkb() {
  console.log("Reading TKB directory...");
  const files = fs.readdirSync(TKB_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} TKB files to sync.`);
  
  for (const filename of files) {
    const filePath = path.join(TKB_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse using gray-matter
    const { data: fm, content: body } = matter(fileContent);
    const conceptId = filename.replace('.md', '');
    
    // Build related_edges in format expected by src/firebase.js (other:relation:sentiment)
    const relatedEdges = [];
    
    // 1. Domain
    let domains = fm.domain || [];
    if (typeof domains === 'string') {
      if (domains.startsWith('[') && domains.endsWith(']')) {
        domains = domains.slice(1, -1).split(',').map(s => s.trim());
      } else {
        domains = [domains];
      }
    }
    
    domains.forEach(d => {
      // Map English domains to Hebrew if needed
      let hebDomain = d;
      for (const [eng, heb] of Object.entries(DOMAIN_MAP)) {
        if (d === eng) {
          hebDomain = heb;
          break;
        }
      }
      relatedEdges.push(`${encodeURIComponent(hebDomain)}:שייך_ל:0`);
    });
    
    // 2. maps_to_patterns
    let patterns = fm.maps_to_patterns || [];
    if (typeof patterns === 'string') {
      patterns = [patterns];
    }
    patterns.forEach(p => {
      relatedEdges.push(`${encodeURIComponent(p)}:קשור_ל:0`);
    });
    
    // 3. counterpart
    if (fm.counterpart && fm.counterpart !== "") {
      const cpId = fm.counterpart.replace('.md', '');
      relatedEdges.push(`${encodeURIComponent(cpId)}:דומה_ל:0`);
    }
    
    const docRef = doc(db, 'theoretical_concepts', conceptId);
    
    const docPayload = {
      id: conceptId,
      title: fm.title || conceptId,
      label: fm.title || conceptId,
      type: fm.type || 'concept',
      domain: domains[0] || 'עולם_פנימי',
      content: body.trim(),
      tags: fm.tags || [],
      trigger_phrases: fm.trigger_phrases || [],
      core_conflicts: fm.core_conflicts || [],
      source: fm.source || '',
      related_edges: relatedEdges,
      weight: 1,
      source_file: filename,
      thinker: fm.title ? fm.title.split(' - ')[0].trim() : conceptId
    };
    
    await setDoc(docRef, docPayload);
    console.log(`Successfully synced concept: ${conceptId} -> "${fm.title || conceptId}"`);
  }
  
  console.log("TKB synchronization to Firestore complete!");
  process.exit(0);
}

syncTkb().catch(err => {
  console.error("Failed to sync TKB to Firestore:", err);
  process.exit(1);
});
