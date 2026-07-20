import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mindcloud-8ccc6",
  apiKey: process.env.VITE_FIREBASE_API_KEY
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const UID = process.env.FIREBASE_UID;

async function cleanEdges() {
  console.log("Starting cleanup of remaining 'גיא' edges...");
  if (!UID) throw new Error("FIREBASE_UID is missing");

  const nodesRef = collection(db, 'users', UID, 'knowledge_graph_nodes');
  const snapshot = await getDocs(nodesRef);
  const nodes = [];
  snapshot.forEach(d => nodes.push({ id: d.id, ref: d.ref, ...d.data() }));

  let batch = writeBatch(db);
  let batchCount = 0;
  let totalUpdated = 0;

  for (const node of nodes) {
    const edges = node.relatedEdges || [];
    const filteredEdges = edges.filter(e => e.source !== 'גיא' && e.target !== 'גיא');
    
    if (edges.length !== filteredEdges.length) {
      batch.update(node.ref, { relatedEdges: filteredEdges });
      batchCount++;
      totalUpdated++;

      if (batchCount >= 400) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} updates...`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} updates...`);
  }

  console.log(`Cleanup complete! Removed 'גיא' edges from ${totalUpdated} nodes.`);
}

cleanEdges().catch(console.error);
