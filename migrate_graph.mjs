import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: "AIzaSyDAPtxu-nJO7VDdI7OwJY7e7QFl6hrzLY0",
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runMigration() {
  const uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1"; // Using the known UID
  console.log(`Starting migration for UID: ${uid}`);

  const entitiesRef = collection(db, `users/${uid}/entities`);
  const knowledgeGraphRef = collection(db, `users/${uid}/knowledge_graph_nodes`);

  const entitiesSnapshot = await getDocs(entitiesRef);
  console.log(`Found ${entitiesSnapshot.size} entities in Mobile's graph.`);

  let migratedCount = 0;
  for (const entityDoc of entitiesSnapshot.docs) {
    const data = entityDoc.data();
    const nodeId = data.id || entityDoc.id;
    
    const safeNodeId = nodeId.replace(/\//g, '%2F');
    const targetDocRef = doc(knowledgeGraphRef, safeNodeId);
    const targetDocSnap = await getDoc(targetDocRef);
    
    if (targetDocSnap.exists()) {
      // Merge logic
      const targetData = targetDocSnap.data();
      const existingEdges = targetData.relatedEdges || [];
      const newEdges = data.relatedEdges || [];
      
      // Filter out duplicate edges
      const mergedEdges = [...existingEdges];
      for (const newEdge of newEdges) {
        const exists = existingEdges.some(e => 
          e.source === newEdge.source && 
          e.target === newEdge.target && 
          e.relation === newEdge.relation
        );
        if (!exists) {
          mergedEdges.push(newEdge);
        }
      }
      
      await setDoc(targetDocRef, {
        ...targetData,
        val: Math.max(targetData.val || 1, data.val || 1),
        relatedEdges: mergedEdges
      }, { merge: true });
    } else {
      // Create new node in knowledge_graph_nodes
      await setDoc(targetDocRef, data);
    }
    migratedCount++;
    if (migratedCount % 50 === 0) {
      console.log(`Migrated ${migratedCount}/${entitiesSnapshot.size} entities...`);
    }
  }

  console.log(`Migration complete! Successfully merged ${migratedCount} entities into knowledge_graph_nodes.`);
  process.exit(0);
}

runMigration().catch(console.error);
