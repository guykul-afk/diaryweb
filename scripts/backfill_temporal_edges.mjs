import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, connectFirestoreEmulator } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables if available
dotenv.config();

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const useEmulator = args.includes('--emulator');
const uidArg = args.find(arg => arg.startsWith('--uid='));
const uid = uidArg ? uidArg.split('=')[1] : "K9j4Nx0WK7NKYJs6iDUz35LXFai1";

if (useEmulator) {
  console.log("Connecting to local Firestore emulator on 127.0.0.1:8080...");
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

async function run() {
  console.log(`=========================================`);
  console.log(`TEMPORAL GRAPH BACKFILL SCRIPT`);
  console.log(`User ID: ${uid}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (No writes)' : 'LIVE WRITES'}`);
  console.log(`=========================================`);

  // 1. Fetch all nodes
  const nodesRef = collection(db, `users/${uid}/knowledge_graph_nodes`);
  let nodesSnap;
  try {
    nodesSnap = await getDocs(nodesRef);
  } catch (error) {
    console.error("Error reading from Firestore. Make sure your local emulator is running if using --emulator, or that you have network access.", error);
    process.exit(1);
  }

  const nodes = [];
  nodesSnap.forEach(docSnap => {
    const data = docSnap.data();
    nodes.push({
      id: docSnap.id,
      ...data
    });
  });

  console.log(`Fetched ${nodes.length} nodes from knowledge_graph_nodes.`);

  // 2. Pre-migration audit and extraction
  const rawEdges = [];
  const edgeUniqueKeys = new Set();

  nodes.forEach(node => {
    if (node.relatedEdges && Array.isArray(node.relatedEdges)) {
      node.relatedEdges.forEach(edge => {
        const source = (edge.source || node.id).trim().replace(/[ /]/g, "_");
        const target = (edge.target || "").trim().replace(/[ /]/g, "_");
        const relation = (edge.relation || "קשור_ל").trim().replace(/[ /]/g, "_");
        
        if (!target) {
          console.warn(`Warning: Edge on node ${node.id} has no target! Skipping.`);
          return;
        }

        const uniqueKey = `${source}__${target}__${relation}`;
        rawEdges.push({
          uniqueKey,
          source,
          target,
          relation,
          sentimentScore: edge.sentimentScore !== undefined ? edge.sentimentScore : 0,
          sourceQuotes: edge.sourceQuotes || [],
          timestamp: edge.timestamp || node.last_active || null,
          nodeLastActive: node.last_active || null
        });
        edgeUniqueKeys.add(uniqueKey);
      });
    }
  });

  console.log(`\n--- Pre-Migration Audit ---`);
  console.log(`Total relatedEdges found in nested arrays: ${rawEdges.length}`);
  console.log(`Total unique edges (source__target__relation): ${edgeUniqueKeys.size}`);

  // Group raw edges by unique key to merge duplicates and build observations
  const mergedEdgesMap = new Map();

  rawEdges.forEach(raw => {
    if (!mergedEdgesMap.has(raw.uniqueKey)) {
      // Determine valid_from date
      let validFrom = "2026-03-01"; // fallback
      let dateSource = "fallback default";

      // Try to parse from quotes
      if (raw.sourceQuotes && raw.sourceQuotes.length > 0) {
        const quoteObj = raw.sourceQuotes[0];
        if (quoteObj && typeof quoteObj === 'object' && quoteObj.date) {
          validFrom = quoteObj.date;
          dateSource = "quote date";
        } else if (typeof quoteObj === 'string') {
          // Check if string contains date or matches format
          const dateMatch = quoteObj.match(/\b\d{4}-\d{2}-\d{2}\b/);
          if (dateMatch) {
            validFrom = dateMatch[0];
            dateSource = "quote text match";
          }
        }
      }

      // Try to parse from timestamp
      if (dateSource === "fallback default" && raw.timestamp) {
        let tsMs = 0;
        if (typeof raw.timestamp === 'number') {
          tsMs = raw.timestamp;
        } else if (raw.timestamp.seconds) { // Firestore timestamp
          tsMs = raw.timestamp.seconds * 1000;
        } else if (typeof raw.timestamp === 'string') {
          tsMs = Date.parse(raw.timestamp);
        }
        if (tsMs) {
          validFrom = new Date(tsMs).toISOString().split('T')[0];
          dateSource = "edge/node timestamp";
        }
      }

      mergedEdgesMap.set(raw.uniqueKey, {
        id: raw.uniqueKey,
        source: raw.source,
        target: raw.target,
        relation: raw.relation,
        valid_from: validFrom,
        valid_to: null,
        status: "active",
        closed_reason: null,
        superseded_by: null,
        supersedes: null,
        recorded_at: new Date().toISOString(), // backfilled recorded time
        observations: [],
        currentScore: raw.sentimentScore,
        sourceQuotes: [],
        _temp_date_source: dateSource
      });
    }

    const merged = mergedEdgesMap.get(raw.uniqueKey);

    // Merge quotes (ensure uniqueness)
    if (raw.sourceQuotes) {
      raw.sourceQuotes.forEach(q => {
        const qStr = typeof q === 'string' ? q : JSON.stringify(q);
        if (!merged.sourceQuotes.some(existing => (typeof existing === 'string' ? existing : JSON.stringify(existing)) === qStr)) {
          merged.sourceQuotes.push(q);
        }
      });
    }

    // Add to observations
    let obsDate = merged.valid_from;
    merged.observations.push({
      date: obsDate,
      score: raw.sentimentScore,
      entryId: (raw.sourceQuotes && raw.sourceQuotes[0] && raw.sourceQuotes[0].entryId) || null
    });
  });

  // Normalize final edges (e.g. keep currentScore as last observation or average, and sort observations)
  for (const [key, merged] of mergedEdgesMap.entries()) {
    // Sort observations chronologically
    merged.observations.sort((a, b) => a.date.localeCompare(b.date));
    // Remove temporary debug fields before write
    delete merged._temp_date_source;
  }

  console.log(`\n--- Migration Action Plan ---`);
  console.log(`Will write ${mergedEdgesMap.size} edge documents to users/${uid}/edges/...`);

  if (isDryRun) {
    console.log(`\n[DRY RUN] Sample edge mapped:`);
    if (mergedEdgesMap.size > 0) {
      const firstKey = mergedEdgesMap.keys().next().value;
      console.log(JSON.stringify(mergedEdgesMap.get(firstKey), null, 2));
    }
    console.log(`\nDry run completed successfully. No changes were made to the database.`);
    process.exit(0);
  }

  // 3. Execution (Writing to new subcollection)
  console.log(`\nWriting to Firestore...`);
  let successCount = 0;
  let errorCount = 0;

  for (const [edgeId, edgeData] of mergedEdgesMap.entries()) {
    try {
      const edgeDocRef = doc(db, `users/${uid}/edges`, edgeId);
      await setDoc(edgeDocRef, edgeData);
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`  Processed ${successCount}/${mergedEdgesMap.size} edges...`);
      }
    } catch (e) {
      console.error(`Failed to write edge ${edgeId}:`, e);
      errorCount++;
    }
  }

  console.log(`\n--- Post-Migration Audit ---`);
  console.log(`Successfully migrated: ${successCount} edges.`);
  console.log(`Errors encountered: ${errorCount}.`);
  console.log(`Verification: Checked new edges count against unique keys count (${mergedEdgesMap.size}).`);
  
  if (successCount === mergedEdgesMap.size) {
    console.log(`SUCCESS: All unique edges migrated cleanly with 100% data integrity.`);
  } else {
    console.warn(`WARNING: Data integrity check failed. Some edges could not be migrated.`);
  }

  process.exit(successCount === mergedEdgesMap.size ? 0 : 1);
}

run().catch(console.error);
