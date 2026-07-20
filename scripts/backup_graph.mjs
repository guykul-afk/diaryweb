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

async function backup() {
  const uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1";
  console.log(`Starting backup for UID: ${uid}`);

  const knowledgeGraphRef = collection(db, `users/${uid}/knowledge_graph_nodes`);
  const snapshot = await getDocs(knowledgeGraphRef);

  const nodes = [];
  snapshot.forEach(doc => {
    nodes.push({ id: doc.id, ...doc.data() });
  });

  fs.writeFileSync('scratch/knowledge_graph_backup.json', JSON.stringify(nodes, null, 2));
  console.log(`Successfully backed up ${nodes.length} nodes to scratch/knowledge_graph_backup.json`);
  process.exit(0);
}

backup().catch(console.error);
