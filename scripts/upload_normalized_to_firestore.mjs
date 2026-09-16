import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDAPtxu-nJO7VDdI7OwJY7e7QFl6hrzLY0",
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = process.env.USER_UID || "K9j4Nx0WK7NKYJs6iDUz35LXFai1";

async function uploadNormalizedGraph() {
  const filePath = path.join(__dirname, '..', 'graphify-out', 'normalized_graph_v2.json');
  console.log(`Reading normalized graph from: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const nodes = JSON.parse(rawData);
  console.log(`Total nodes to upload: ${nodes.length}`);

  const BATCH_SIZE = 400;
  let batch = writeBatch(db);
  let opCount = 0;
  let totalUploaded = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodeId = node.id;
    if (!nodeId) continue;

    const safeNodeId = nodeId.replace(/\//g, '%2F');
    const nodeRef = doc(db, `users/${uid}/knowledge_graph_nodes`, safeNodeId);

    // Prepare clean node document without raw documentReference objects
    const cleanNode = {
      id: node.id,
      label: node.label || node.id,
      type: node.type || "Insight",
      val: node.val || 1,
      relatedEdges: node.relatedEdges || [],
      updatedAt: new Date().toISOString()
    };

    if (node.description) cleanNode.description = node.description;
    if (node.essence) cleanNode.essence = node.essence;
    if (node.domain) cleanNode.domain = node.domain;

    batch.set(nodeRef, cleanNode, { merge: true });
    opCount++;

    if (opCount === BATCH_SIZE || i === nodes.length - 1) {
      console.log(`Committing batch of ${opCount} nodes (${totalUploaded + opCount}/${nodes.length})...`);
      await batch.commit();
      totalUploaded += opCount;
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  console.log(`\n🎉 Successfully uploaded all ${totalUploaded} normalized nodes to Firestore at users/${uid}/knowledge_graph_nodes!`);
  process.exit(0);
}

uploadNormalizedGraph().catch((err) => {
  console.error("Error uploading to Firestore:", err);
  process.exit(1);
});
