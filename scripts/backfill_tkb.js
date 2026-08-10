import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Read functions/.env for GEMINI_API_KEY
let geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const funcEnvPath = path.join(rootDir, 'functions', '.env');
if (!geminiApiKey && fs.existsSync(funcEnvPath)) {
  const content = fs.readFileSync(funcEnvPath, 'utf8');
  const match = content.match(/GEMINI_API_KEY=(.+)/);
  if (match) geminiApiKey = match[1].trim();
}

// Read .env for Firebase config
const rootEnvPath = path.join(rootDir, '.env');
let firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
let userUid = process.env.USER_UID || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  const matchKey = content.match(/VITE_FIREBASE_API_KEY=(.+)/);
  if (matchKey && !firebaseApiKey) firebaseApiKey = matchKey[1].trim();
  const matchUid = content.match(/USER_UID=(.+)/);
  if (matchUid && !userUid) userUid = matchUid[1].trim();
}

if (!geminiApiKey) {
  console.error("ERROR: GEMINI_API_KEY not found in environment or functions/.env");
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

async function callGemini(systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      parts: [{ text: userPrompt }]
    }],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return JSON.parse(text);
}

async function getTheoreticalConcepts() {
  const conceptsRef = collection(db, 'theoretical_concepts');
  const snap = await getDocs(conceptsRef);
  const concepts = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const id = decodeURIComponent(data.id || docSnap.id);
    const title = data.label || data.title || id;
    concepts.push({ id, title });
  });
  return concepts;
}

async function run() {
  const args = process.argv.slice(2);
  const targetDocId = args.find(a => a.startsWith('--single='))?.split('=')[1];
  const limitCount = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
  const concurrency = 8;

  console.log("Fetching theoretical concepts...");
  const concepts = await getTheoreticalConcepts();
  console.log(`Found ${concepts.length} theoretical concepts.`);

  const conceptsPromptText = concepts.map(c => `- ${c.title} (ID: ${c.id})`).join('\n');

  const systemPrompt = `You are an expert NLP Entity and Psychological Concept Extractor. Analyze the Hebrew journal entry.
Extract:
'tkb_reference': The ID of the single most relevant theoretical concept from the TKB list below. Choose the concept that best captures the psychological, emotional, philosophical, or behavioral dynamics in the entry. If none are a good fit, return null.

TKB Concepts:
${conceptsPromptText}

Output strictly valid JSON with key "tkb_reference" (string or null). Do not include markdown formatting or explanations.`;

  const entriesRef = collection(db, `users/${userUid}/entries`);
  const snap = await getDocs(entriesRef);
  const docsToProcess = [];

  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (targetDocId) {
      if (docSnap.id === targetDocId || data.id === targetDocId) {
        docsToProcess.push({ docSnap, data });
      }
    } else if (!data.tkb_reference) {
      docsToProcess.push({ docSnap, data });
    }
  });

  const totalToProcess = limitCount > 0 ? docsToProcess.slice(0, limitCount) : docsToProcess;
  console.log(`Found ${docsToProcess.length} entries missing tkb_reference. Processing ${totalToProcess.length} with concurrency ${concurrency}...`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let completedCount = 0;

  async function processEntry(item) {
    const { docSnap, data } = item;
    const text = data.transcript || data.content || '';
    if (!text.trim()) {
      skippedCount++;
      completedCount++;
      return;
    }

    const docId = docSnap.id;
    const userPrompt = `Journal Entry Content:\n${text}\n\nOutput JSON:`;

    try {
      const result = await callGemini(systemPrompt, userPrompt);
      const tkbRef = result?.tkb_reference;

      if (tkbRef && tkbRef !== 'null' && tkbRef !== 'None') {
        const docRef = doc(db, `users/${userUid}/entries/${docId}`);
        await updateDoc(docRef, { tkb_reference: tkbRef });
        updatedCount++;
        console.log(`[${++completedCount}/${totalToProcess.length}] Updated ${docId} => tkb_reference: "${tkbRef}"`);
      } else {
        skippedCount++;
        console.log(`[${++completedCount}/${totalToProcess.length}] Skipped ${docId} (no fitting concept matching null)`);
      }
    } catch (err) {
      errorCount++;
      console.error(`[${++completedCount}/${totalToProcess.length}] Error processing ${docId}:`, err.message);
    }
  }

  // Chunk array for concurrent batching
  for (let i = 0; i < totalToProcess.length; i += concurrency) {
    const batch = totalToProcess.slice(i, i + concurrency);
    await Promise.all(batch.map(item => processEntry(item)));
  }

  console.log(`\n=== BACKFILL COMPLETE ===`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});
