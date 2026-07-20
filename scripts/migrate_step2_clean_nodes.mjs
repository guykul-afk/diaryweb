import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mindcloud-8ccc6",
  apiKey: process.env.VITE_FIREBASE_API_KEY
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const UID = process.env.FIREBASE_UID;

async function runStep2() {
  console.log("Starting Step 2: Recalculate Degrees, Prep Degree-1 Nodes, Edge Mapping, Insights Split");
  if (!UID) throw new Error("FIREBASE_UID is missing");

  const nodesRef = collection(db, 'users', UID, 'knowledge_graph_nodes');
  const snapshot = await getDocs(nodesRef);
  const nodes = [];
  snapshot.forEach(d => nodes.push({ id: d.id, ref: d.ref, ...d.data() }));

  // 1. Calculate degrees
  const degrees = {};
  nodes.forEach(n => degrees[n.id] = 0);
  
  nodes.forEach(n => {
    (n.relatedEdges || []).forEach(e => {
      if (degrees[e.source] !== undefined) degrees[e.source]++;
      if (degrees[e.target] !== undefined) degrees[e.target]++;
    });
  });

  const lowDegreeNodes = nodes.filter(n => degrees[n.id] <= 1);
  fs.writeFileSync('nodes_to_clean.json', JSON.stringify(lowDegreeNodes, null, 2));
  console.log(`Saved ${lowDegreeNodes.length} degree <= 1 nodes to nodes_to_clean.json for LLM review.`);

  // 2. Map Edges
  const validEdges = new Set([
    'חלק_מ', 'סותר', 'מתועד_ב', 'דומה_ל', 'קשור_ל', 'שואף_ל', 
    'שייך_ל', 'חווה', 'מפעיל', 'משפיע_על', 'מחזק', 'מחליש'
  ]);
  
  const edgeMapping = {};
  nodes.forEach(n => {
    (n.relatedEdges || []).forEach(e => {
      if (!validEdges.has(e.relation)) {
        if (!edgeMapping[e.relation]) edgeMapping[e.relation] = 0;
        edgeMapping[e.relation]++;
      }
    });
  });
  
  fs.writeFileSync('edges_to_map.json', JSON.stringify(edgeMapping, null, 2));
  console.log(`Saved ${Object.keys(edgeMapping).length} invalid edge types to edges_to_map.json for LLM review.`);

  // 3. Insight Split
  const insights = nodes.filter(n => n.type === 'Insight');
  const batch = writeBatch(db);
  let insightCount = 0;

  for (const n of insights) {
    if (n.content && n.content.length > 200) {
      // Create separate document
      const insightRef = doc(collection(db, 'users', UID, 'insights'));
      batch.set(insightRef, { full_text: n.content, original_node_id: n.id });
      
      // Trim content
      const summary = n.content.substring(0, 150) + '...';
      batch.set(n.ref, { content: summary, insight_ref: insightRef.id }, { merge: true });
      insightCount++;
    }
  }

  await batch.commit();
  console.log(`Split ${insightCount} Insights into separate collection.`);
}

runStep2().catch(console.error);
