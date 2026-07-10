import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, doc, connectFirestoreEmulator, getDocsFromServer, getDocFromServer } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: "AIzaSyDAPtxu-nJO7VDdI7OwJY7e7QFl6hrzLY0",
  authDomain: "mindcloud-8ccc6.firebaseapp.com",
  messagingSenderId: "961085343809",
  measurementId: "G-J766284FQK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

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
      content: data.content || ''
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
            timestamp: edge.timestamp
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
        content: ''
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
        content: ''
      });
      nodeIds.add(sourceLower);
    }
  });

  return { nodes, links };
}

// Helper to trigger the diary investigator Q&A cloud function
export async function queryDiaryInsights(uid, query) {
  if (!uid) throw new Error("Missing User ID (UID)");
  if (!query) throw new Error("Missing query");
  const queryFunc = httpsCallable(functions, 'query_diary_insights', { timeout: 120000 });
  const result = await queryFunc({ uid, query });
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



