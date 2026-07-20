import * as dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function count() {
  const uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1";
  
  // Read backup
  const backupData = JSON.parse(fs.readFileSync('scratch/knowledge_graph_backup.json', 'utf8'));
  
  // Fetch current
  console.log("Fetching current nodes from Firestore...");
  const knowledgeGraphRef = collection(db, `users/${uid}/knowledge_graph_nodes`);
  const snapshot = await getDocs(knowledgeGraphRef);
  const currentNodes = [];
  snapshot.forEach(doc => {
    currentNodes.push({ id: doc.id, ...doc.data() });
  });

  const getStats = (list) => {
    const total = list.length;
    const system = list.filter(n => n.id.startsWith('Health_') || n.id.startsWith('graph_insight_') || n.id.startsWith('investigator_')).length;
    const archetype = list.filter(n => n.id.startsWith('ארכיטיפ_') || n.id.startsWith('סגנון_')).length;
    const psychological = total - system - archetype;
    
    // Count total edges
    let totalEdges = 0;
    list.forEach(n => {
      if (n.relatedEdges) {
        totalEdges += n.relatedEdges.length;
      }
    });
    
    return { total, system, archetype, psychological, totalEdges };
  };

  const backupStats = getStats(backupData);
  const currentStats = getStats(currentNodes);

  console.log("\n--- STATS COMPARISON ---");
  console.log(`Total Nodes: ${backupStats.total} -> ${currentStats.total} (Diff: ${currentStats.total - backupStats.total})`);
  console.log(`Psychological Nodes: ${backupStats.psychological} -> ${currentStats.psychological} (Diff: ${currentStats.psychological - backupStats.psychological})`);
  console.log(`System Nodes (Health, Insights): ${backupStats.system} -> ${currentStats.system} (Diff: ${currentStats.system - backupStats.system})`);
  console.log(`Archetypes/Styles Nodes: ${backupStats.archetype} -> ${currentStats.archetype} (Diff: ${currentStats.archetype - backupStats.archetype})`);
  console.log(`Total Edges (Connections): ${backupStats.totalEdges} -> ${currentStats.totalEdges} (Diff: ${currentStats.totalEdges - backupStats.totalEdges})`);

  process.exit(0);
}

count().catch(console.error);
