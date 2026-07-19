import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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

// Levenshtein distance
function levenshteinDistance(a, b) {
  const matrix = [];
  let i, j;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  for (i = 0; i <= b.length; i++) matrix[i] = [i];
  for (j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a, b) {
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : (maxLen - dist) / maxLen;
}

async function mergeEntities() {
  const uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1";
  console.log(`Starting deduplication merge for UID: ${uid}`);

  const knowledgeGraphRef = collection(db, `users/${uid}/knowledge_graph_nodes`);
  const snapshot = await getDocs(knowledgeGraphRef);

  const nodes = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    nodes.push({ ...data, _docId: doc.id, id: data.id || doc.id });
  });

  const validNodes = nodes.filter(n => {
    const id = n.id;
    return !id.startsWith('Health_') && 
           !id.startsWith('graph_insight_') && 
           !id.startsWith('investigator_') && 
           !id.startsWith('ארכיטיפ_') && 
           !id.startsWith('סגנון_');
  });

  console.log(`Analyzing ${validNodes.length} valid psychological entities out of ${nodes.length} total nodes...`);

  // Simple clustering
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < validNodes.length; i++) {
    if (visited.has(validNodes[i].id)) continue;
    
    const currentCluster = [validNodes[i]];
    visited.add(validNodes[i].id);

    for (let j = i + 1; j < validNodes.length; j++) {
      if (visited.has(validNodes[j].id)) continue;
      
      const a = validNodes[i].label || validNodes[i].id;
      const b = validNodes[j].label || validNodes[j].id;
      
      let isMatch = false;
      
      // Substring match
      if ((a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b))) {
        isMatch = true;
      } else if (similarity(a, b) > 0.8) {
        // Levenshtein similarity
        isMatch = true;
      }
      
      if (isMatch) {
        currentCluster.push(validNodes[j]);
        visited.add(validNodes[j].id);
      }
    }
    
    if (currentCluster.length > 1) {
      clusters.push(currentCluster);
    }
  }

  console.log(`Found ${clusters.length} clusters with duplicates to merge.`);

  let totalMerged = 0;
  
  // Use sequential updates instead of batch to avoid max batch limit issues
  for (const cluster of clusters) {
    // Sort to find the shortest string to use as the primary node
    cluster.sort((a, b) => {
      const aLen = (a.label || a.id).length;
      const bLen = (b.label || b.id).length;
      return aLen - bLen;
    });

    const primaryNode = cluster[0];
    const duplicateNodes = cluster.slice(1);
    
    console.log(`\nMerging into: ${primaryNode.label || primaryNode.id}`);
    
    let updatedPrimary = { ...primaryNode };
    if (!updatedPrimary.aliases) updatedPrimary.aliases = [];
    if (!updatedPrimary.relatedEdges) updatedPrimary.relatedEdges = [];
    
    for (const dup of duplicateNodes) {
      console.log(`  - Deleting duplicate: ${dup.label || dup.id}`);
      
      // Merge aliases
      updatedPrimary.aliases.push(dup.label || dup.id);
      if (dup.aliases) {
        updatedPrimary.aliases.push(...dup.aliases);
      }
      
      // Merge edges
      if (dup.relatedEdges) {
        for (const edge of dup.relatedEdges) {
          // Check if edge already exists
          const exists = updatedPrimary.relatedEdges.some(e => 
            e.source === edge.source && 
            e.target === edge.target && 
            e.relation === edge.relation
          );
          if (!exists) {
            // Remap source/target if they pointed to the duplicate
            let newEdge = { ...edge };
            if (newEdge.source === dup.id) newEdge.source = primaryNode.id;
            if (newEdge.target === dup.id) newEdge.target = primaryNode.id;
            updatedPrimary.relatedEdges.push(newEdge);
          }
        }
      }
      
      // Delete the duplicate doc
      const dupRef = doc(db, `users/${uid}/knowledge_graph_nodes`, dup._docId);
      await deleteDoc(dupRef);
      totalMerged++;
    }
    
    // Deduplicate aliases array
    updatedPrimary.aliases = [...new Set(updatedPrimary.aliases)];
    
    // Update the primary doc
    const primaryRef = doc(db, `users/${uid}/knowledge_graph_nodes`, primaryNode._docId);
    await setDoc(primaryRef, updatedPrimary, { merge: true });
  }

  console.log(`\nDone! Merged and deleted ${totalMerged} duplicate nodes.`);
  process.exit(0);
}

mergeEntities().catch(console.error);
