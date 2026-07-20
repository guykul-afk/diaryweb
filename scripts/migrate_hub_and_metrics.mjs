import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';

// Load .env (assuming dotenv is used in production)
const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mindcloud-8ccc6",
  apiKey: process.env.VITE_FIREBASE_API_KEY
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const UID = process.env.FIREBASE_UID; // UID injected via env

async function migrateGraph() {
  console.log("Starting Migration: Backup, Hub Removal, HealthMetrics Extraction");
  if (!UID) throw new Error("FIREBASE_UID is missing");

  const nodesRef = collection(db, 'users', UID, 'knowledge_graph_nodes');
  const snapshot = await getDocs(nodesRef);
  const nodes = [];
  snapshot.forEach(d => nodes.push({ id: d.id, ref: d.ref, ...d.data() }));

  // 1. BACKUP
  fs.writeFileSync('graph_backup.json', JSON.stringify(nodes, null, 2));
  console.log(`Backed up ${nodes.length} nodes to graph_backup.json`);

  const batch = writeBatch(db);

  // 2. EXTRACT HEALTH METRICS
  let healthCount = 0;
  for (const node of nodes) {
    if (node.id.startsWith("health_")) {
      const metricRef = doc(db, 'users', UID, 'health_metrics', node.id);
      batch.set(metricRef, { ...node, ref: null }); // strip the ref before saving
      batch.delete(node.ref);
      healthCount++;
    }
  }
  console.log(`Extracted ${healthCount} HealthMetrics to time-series collection.`);

  // 3. HUB CONVERSION ("גיא")
  const guyNode = nodes.find(n => n.id === "גיא" || n.label === "גיא");
  if (guyNode) {
    let convertedStances = 0;
    const edges = guyNode.relatedEdges || [];
    
    for (const edge of edges) {
      // Logic: map verbs to stances
      const verbToStance = {
        "רוצה": "שאיפה", "שואף_ל": "שאיפה",
        "מתכנן": "תכנון",
        "נמנע_מ": "הימנעות", "מפחד_מ": "הימנעות",
        "הדחיק": "הדחקה"
      };
      
      const stanceVal = verbToStance[edge.relation] || "פעולה"; // fallback
      
      // Update the target node with StanceHistory
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode && !targetNode.id.startsWith("health_")) {
        const historyEntry = {
          stance: stanceVal,
          intensity: 100, // default if not extracted
          since: new Date().toISOString(), // Fallback, should parse from entry
          source_entry_id: "migration"
        };
        targetNode.stances = targetNode.stances || [];
        targetNode.stances.push(historyEntry);
        
        batch.set(targetNode.ref, { stances: targetNode.stances }, { merge: true });
        convertedStances++;
      }
    }
    
    // Remove the Hub node
    batch.delete(guyNode.ref);
    console.log(`Converted ${convertedStances} edges to stances. Removed Hub node ('גיא').`);
  }

  await batch.commit();
  console.log("Migration Step 1 (Hub & Metrics) complete.");
}

migrateGraph().catch(console.error);
