import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, doc, connectFirestoreEmulator, getDocsFromServer, getDocFromServer, updateDoc, setDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

export async function fetchSyncedIsaData(uid) {
  if (!uid) return null;
  const docRef = doc(db, `users/${uid}`);
  const docSnap = await getDocFromServer(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return data.lifeTrackerData || null;
  }
  return null;
}


if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.search.includes('useEmulator=true')) {
  console.log("Connecting to local Firebase Emulators...");
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

// Keep track of the active user session or sign in anonymously if none exists
export function getFirebaseUid() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(auth)
          .then((userCredential) => {
            resolve(userCredential.user.uid);
          })
          .catch((error) => {
            console.error("Firebase Auth Error:", error);
            reject(error);
          });
      }
    });
  });
}

// Trigger personality analysis cloud function
export async function triggerPersonalityAnalysis(uid, isFull = false) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const analyzeFunc = httpsCallable(functions, 'analyze_personality', { timeout: 300000 }); // 5 minutes timeout
  const result = await analyzeFunc({ uid, is_full: isFull });
  return result.data;
}

export async function triggerGraphAnalysis(uid, query = 'אנא נתח את הגרף שלי ומצא קשרים חסרים, קונפליקטים ותבניות מעניינות.') {
  if (!uid) throw new Error("Missing User ID (UID)");
  const analyzeFunc = httpsCallable(functions, 'analyze_knowledge_graph', { timeout: 300000 });
  const result = await analyzeFunc({ uid, query });
  return result.data;
}

export async function verifyPasscode(passcode) {
  const verifyFunc = httpsCallable(functions, 'verify_passcode');
  const result = await verifyFunc({ passcode });
  return result.data;
}

export { db, auth };

// Fetch original insights from users/{uid}/insights/current
export async function fetchOriginalInsights(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const docRef = doc(db, `users/${uid}/insights`, 'current');
  const docSnap = await getDocFromServer(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

// Fetch latest recommended readings from users/{uid}/recommended_readings/latest
export async function fetchRecommendedReadings(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  try {
    const docRef = doc(db, `users/${uid}/recommended_readings`, 'latest');
    const docSnap = await getDocFromServer(docRef);
    if (docSnap.exists()) {
      return docSnap.data()?.readings || [];
    }
  } catch (err) {
    console.error("Failed to fetch recommended readings:", err);
  }
  return [];
}

export async function fetchAllRecommendedReadings(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  try {
    const analysisRef = collection(db, `users/${uid}/personality_analysis`);
    const q = query(analysisRef, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocsFromServer(q);
    
    const allReadings = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.recommended_readings && data.recommended_readings.length > 0) {
        allReadings.push({
          analysisId: doc.id,
          timestamp: data.timestamp,
          readings: data.recommended_readings
        });
      }
    });
    return allReadings;
  } catch (err) {
    console.error("Failed to fetch all recommended readings:", err);
  }
  return [];
}



// Helper to fetch entries from Firebase Firestore
export async function fetchFirebaseEntries(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const entriesRef = collection(db, `users/${uid}/entries`);
  const q = query(entriesRef, orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocsFromServer(q);
  
  const entries = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Convert to a format matching the local file structure so the frontend code works seamlessly
    entries.push({
      id: data.id || doc.id,
      insights: data.insights || [],
      frontmatter: {
        date: data.timestamp ? new Date(data.timestamp).toISOString().split('T')[0] : 'תאריך לא ידוע',
        topics: data.topics || [],
        open_threads: (data.openThreads || data.open_threads || []).map(t => typeof t === 'string' ? t : t.text || ''),
        mood: data.mood || data.sentiment || 'ניטרלי'
      },
      content: data.transcript || data.content || '',
      rawTimestamp: data.timestamp
    });
  });
  return entries;
}

// Helper to fetch personality analysis documents
export async function fetchPersonalityAnalysis(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const analysisRef = collection(db, `users/${uid}/personality_analysis`);
  const q = query(analysisRef, orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocsFromServer(q);
  
  const analyses = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    analyses.push({
      id: doc.id,
      timestamp: data.timestamp,
      executive_summary: data.executive_summary || '',
      reports: data.reports || {},
      metrics: data.metrics || {},
      new_entries_since_last_analysis: data.new_entries_since_last_analysis || 0
    });
  });
  return analyses;
}

// Helper to fetch knowledge graph nodes & links from Firebase Firestore
export async function fetchFirebaseGraph(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const nodesRef = collection(db, `users/${uid}/knowledge_graph_nodes`);
  const querySnapshot = await getDocsFromServer(nodesRef);
  
  const nodes = [];
  const links = [];
  const edgeIds = new Set();
  const nodeIds = new Set();

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const nodeId = data.id || doc.id;
    
    nodes.push({
      id: nodeId,
      name: data.label || nodeId,
      type: data.type || 'Concept',
      weight: data.val || 1,
      content: data.content || '',
      fx: data.fx !== undefined ? data.fx : null,
      fy: data.fy !== undefined ? data.fy : null,
      metrics: data.metrics || null,
      date: data.date || null
    });
    nodeIds.add(nodeId.toLowerCase());

    if (data.relatedEdges) {
      data.relatedEdges.forEach((edge) => {
        const edgeId = `${edge.source}-${edge.target}-${edge.relation}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          links.push({
            source: edge.source,
            target: edge.target,
            label: edge.relation || 'relates',
            sentimentScore: edge.sentimentScore !== undefined ? edge.sentimentScore : 0,
            sourceQuotes: edge.sourceQuotes || [],
            timestamp: edge.timestamp,
            isManual: edge.isManual || false
          });
        }
      });
    }
  });

  // Ensure all link targets/sources exist in nodes list
  links.forEach(link => {
    const targetLower = typeof link.target === 'string' ? link.target.toLowerCase() : link.target.id.toLowerCase();
    const sourceLower = typeof link.source === 'string' ? link.source.toLowerCase() : link.source.id.toLowerCase();

    if (!nodeIds.has(targetLower)) {
      const targetName = typeof link.target === 'string' ? link.target : link.target.id;
      nodes.push({
        id: targetName,
        name: targetName,
        type: 'Concept',
        weight: 1,
        content: '',
        fx: null,
        fy: null
      });
      nodeIds.add(targetLower);
    }
    if (!nodeIds.has(sourceLower)) {
      const sourceName = typeof link.source === 'string' ? link.source : link.source.id;
      nodes.push({
        id: sourceName,
        name: sourceName,
        type: 'Concept',
        weight: 1,
        content: '',
        fx: null,
        fy: null
      });
      nodeIds.add(sourceLower);
    }
  });

  return { nodes, links };
}

// Fetch global theoretical concepts from Firestore
export async function fetchTheoreticalConcepts() {
  const conceptsRef = collection(db, 'theoretical_concepts');
  const querySnapshot = await getDocsFromServer(conceptsRef);
  
  const nodes = [];
  const links = [];
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const nodeId = decodeURIComponent(data.id || doc.id);
    
    nodes.push({
      id: nodeId,
      name: data.label || nodeId,
      type: data.type || 'Concept',
      weight: data.weight || 1,
      content: data.content || '',
      isH1: data.is_h1 || false,
      sourceFile: data.source_file || '',
      thinker: data.thinker || ''
    });
    
    if (data.related_edges) {
      data.related_edges.forEach((edgeStr) => {
        // Format: other:relation:sentiment
        const parts = edgeStr.split(':');
        if (parts.length >= 2) {
          const other = decodeURIComponent(parts[0]);
          const relation = parts[1];
          const sentiment = parts.length >= 3 ? parseFloat(parts[2]) : 0;
          links.push({
            source: nodeId,
            target: other,
            label: relation,
            sentimentScore: sentiment,
            isTheoretical: true
          });
        }
      });
    }
  });
  
  return { nodes, links };
}

import { addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

// Save a chat message to Firestore history
export async function saveChatMessage(uid, role, text) {
  if (!uid) return;
  const colRef = collection(db, 'users', uid, 'qa_chat_history');
  await addDoc(colRef, {
    role,
    text,
    timestamp: serverTimestamp()
  });
}

// Retrieve chat history from Firestore
export async function getChatHistory(uid) {
  if (!uid) return [];
  const colRef = collection(db, 'users', uid, 'qa_chat_history');
  const q = query(colRef, orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    role: doc.data().role,
    text: doc.data().text
  }));
}

// Helper to trigger the diary investigator Q&A cloud function
export async function queryDiaryInsights(uid, query, history = []) {
  if (!uid) throw new Error("Missing User ID (UID)");
  if (!query) throw new Error("Missing query");
  const queryFunc = httpsCallable(functions, 'query_diary_insights', { timeout: 120000 });
  const result = await queryFunc({ uid, query, history });
  return result.data;
}

// Helper to trigger explanation of a relationship/link
export async function explainGraphLink(uid, source, target, relation = '') {
  if (!uid) throw new Error("Missing User ID (UID)");
  if (!source || !target) throw new Error("Missing source or target");
  const explainFunc = httpsCallable(functions, 'explain_graph_link', { timeout: 60000 });
  const result = await explainFunc({ uid, source, target, relation });
  return result.data;
}

// Trigger bulk synchronization of insights to knowledge graph
export async function syncInsightsToGraph(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const syncFunc = httpsCallable(functions, 'sync_insights_to_graph', { timeout: 120000 });
  const result = await syncFunc({ uid });
  return result.data;
}
// Trigger Entity Resolution and Clustering optimization on the knowledge graph
export async function resolveAndClusterEntities(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const resolveFunc = httpsCallable(functions, 'resolve_and_cluster_entities', { timeout: 300000 });
  const result = await resolveFunc({ uid });
  return result.data;
}

// Save a single node's fixed coordinates for spatial memory
export async function saveNodeCoordinates(uid, nodeId, fx, fy) {
  if (!uid || !nodeId) return;
  const nodeDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, nodeId);
  await setDoc(nodeDocRef, { fx, fy }, { merge: true });
}

// Clear fx and fy coordinates for all specified node IDs to release pinning
export async function clearAllNodeCoordinates(uid, nodeIds) {
  if (!uid || !nodeIds || nodeIds.length === 0) return;
  const batch = writeBatch(db);
  nodeIds.forEach(nodeId => {
    const nodeDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, nodeId);
    batch.update(nodeDocRef, { fx: null, fy: null });
  });
  await batch.commit();
}

// Add a manual edge between two nodes
export async function addManualEdge(uid, source, target, relation) {
  if (!uid || !source || !target) return;
  const sourceDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, source);
  const targetDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, target);
  
  // Ensure source exists, and union the relation
  await setDoc(sourceDocRef, {
    id: source,
    label: source,
    type: 'Concept',
    val: 1,
    relatedEdges: arrayUnion({
      source,
      target,
      relation,
      sentimentScore: 0,
      timestamp: Date.now(),
      isManual: true
    })
  }, { merge: true });

  // Ensure target exists
  const targetDocSnap = await getDocFromServer(targetDocRef);
  if (!targetDocSnap.exists()) {
    await setDoc(targetDocRef, {
      id: target,
      label: target,
      type: 'Concept',
      val: 1,
      relatedEdges: []
    });
  }
}

// Remove an edge from database
export async function removeEdge(uid, source, target, relation) {
  if (!uid || !source || !target) return;
  const sourceDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, source);
  const docSnap = await getDocFromServer(sourceDocRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    if (data.relatedEdges) {
      const updatedEdges = data.relatedEdges.filter(edge => 
        !(edge.source === source && edge.target === target && (edge.relation || '') === relation)
      );
      await updateDoc(sourceDocRef, { relatedEdges: updatedEdges });
    }
  }
}
