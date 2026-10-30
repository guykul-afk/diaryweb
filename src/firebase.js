import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  doc, 
  connectFirestoreEmulator, 
  getDocsFromServer, 
  getDocFromServer, 
  updateDoc, 
  setDoc, 
  writeBatch, 
  arrayUnion, 
  deleteDoc,
  addDoc, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  projectId: "mindcloud-8ccc6",
  appId: "1:961085343809:web:a7c8c68360c3d820f21ec0",
  storageBucket: "mindcloud-8ccc6.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDAPtxu-nJO7VDdI7OwJY7e7QFl6hrzLY0",
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

export const analyzeGraphDetective = triggerGraphAnalysis;

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

// Helper to format transcript text (replace 'משתמש' speaker label with 'גיא')
export function formatTranscript(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/(^|[\n\r]|(?<=\s))(?:\*\*)?משתמש(?:\*\*)?\s*(:|[-–—])/g, (match) => {
    return match.replace('משתמש', 'גיא');
  });
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
        mood: data.mood || data.sentiment || 'ניטרלי',
        tkb_reference: data.tkb_reference || null
      },
      content: formatTranscript(data.transcript || data.content || ''),
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
      timestamp: data.timestamp || data.created_at_ms || null,
      created_at_ms: data.created_at_ms || (data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().getTime() : new Date(data.timestamp).getTime()) : 0),
      executive_summary: data.executive_summary || '',
      reports: data.reports || {},
      metrics: data.metrics || {},
      is_full: data.is_full !== undefined ? data.is_full : true,
      analysis_type: data.analysis_type || 'full',
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
      label: data.label || nodeId,
      type: data.type || 'Insight',
      weight: data.val || 1,
      val: data.val || 1,
      content: data.content || '',
      fx: data.fx !== undefined ? data.fx : null,
      fy: data.fy !== undefined ? data.fy : null,
      metrics: data.metrics || null,
      date: data.date || null,
      stances: data.stances || data.properties?.stances || [],
      sourceQuotes: data.sourceQuotes || data.properties?.sourceQuotes || [],
      epistemicConfidence: data.epistemicConfidence !== undefined ? data.epistemicConfidence : (data.confidence !== undefined ? data.confidence : 1),
      provenanceType: data.provenanceType || 'EXTRACTED'
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
            relation: edge.relation || 'קשור_ל',
            label: edge.relation || 'קשור_ל',
            sentimentScore: edge.sentimentScore !== undefined ? edge.sentimentScore : 0,
            sourceQuotes: edge.sourceQuotes || [],
            timestamp: edge.timestamp,
            isManual: edge.isManual || false,
            stances: edge.stances || [],
            epistemicConfidence: edge.epistemicConfidence !== undefined ? edge.epistemicConfidence : 1,
            provenanceType: edge.provenanceType || 'EXTRACTED',
            date: edge.date || null
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
        fy: null,
        stances: [],
        sourceQuotes: [],
        epistemicConfidence: 1,
        provenanceType: 'EXTRACTED'
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
        fy: null,
        stances: [],
        sourceQuotes: [],
        epistemicConfidence: 1,
        provenanceType: 'EXTRACTED'
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

// ==========================================
// RIKMA Self: Epistemic Decisions & Learning
// ==========================================

// Fetch user decisions from users/{uid}/decisions
export async function fetchUserDecisions(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, `users/${uid}/decisions`);
    const q = query(colRef, orderBy('decisionDate', 'desc'));
    const snap = await getDocsFromServer(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("fetchUserDecisions warning:", err);
    return [];
  }
}

// Fetch open predictions from users/{uid}/predictions
export async function fetchUserPredictions(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, `users/${uid}/predictions`);
    const q = query(colRef, orderBy('recordedAt', 'desc'));
    const snap = await getDocsFromServer(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("fetchUserPredictions warning:", err);
    return [];
  }
}

// Fetch observed outcomes from users/{uid}/outcomes
export async function fetchUserOutcomes(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, `users/${uid}/outcomes`);
    const q = query(colRef, orderBy('observedAt', 'desc'));
    const snap = await getDocsFromServer(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("fetchUserOutcomes warning:", err);
    return [];
  }
}

// Save or update a DecisionRecord in Firestore and normalize associated predictions
export async function saveUserDecision(uid, decisionData) {
  if (!uid || !decisionData) throw new Error("Missing UID or decisionData");

  const decId = decisionData.id || `dec_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Normalize and save predictions if present
  const savedPredictions = [];
  if (Array.isArray(decisionData.predictions) && decisionData.predictions.length > 0) {
    for (let i = 0; i < decisionData.predictions.length; i++) {
      const pred = decisionData.predictions[i];
      const isString = typeof pred === 'string';
      const predId = (!isString && pred.id) ? pred.id : `pred_${Date.now()}_${i}`;
      const expectedOutcome = isString ? pred : (pred.expectedOutcome || pred.predictionText || pred.title || pred.text || '');
      const predictionText = isString ? pred : (pred.predictionText || pred.expectedOutcome || pred.text || expectedOutcome);
      const confidence = (!isString && (pred.confidence !== undefined ? pred.confidence : pred.probability)) ?? 0.8;
      const probability = (!isString && (pred.probability !== undefined ? pred.probability : pred.confidence)) ?? confidence;
      const targetDate = (!isString && (pred.targetDate || pred.timeHorizon)) || '';
      const timeHorizon = (!isString && (pred.timeHorizon || pred.targetDate)) || targetDate;
      const status = (!isString && pred.status) ? pred.status : 'pending';
      const empiricalStatus = (!isString && pred.empiricalStatus) ? pred.empiricalStatus : 'UNTESTED';
      const createdAt = (!isString && pred.createdAt) ? pred.createdAt : nowIso;
      const recordedAt = (!isString && (pred.recordedAt || pred.createdAt)) ? (pred.recordedAt || pred.createdAt) : nowIso;

      const predDoc = {
        id: predId,
        decisionId: decId,
        title: decisionData.title || '',
        domain: decisionData.domain || 'general',
        expectedOutcome,
        predictionText,
        confidence,
        probability,
        targetDate,
        timeHorizon,
        status,
        empiricalStatus,
        createdAt,
        recordedAt,
        updatedAt: nowIso
      };

      const predRef = doc(db, `users/${uid}/predictions`, predId);
      await setDoc(predRef, predDoc, { merge: true });
      savedPredictions.push(predDoc);
    }
  }

  const decRef = doc(db, `users/${uid}/decisions`, decId);
  const dataToSave = {
    ...decisionData,
    id: decId,
    domain: decisionData.domain || 'general',
    decisionDate: decisionData.decisionDate || nowIso.split('T')[0],
    updatedAt: nowIso
  };
  if (savedPredictions.length > 0) {
    dataToSave.predictions = savedPredictions;
  }
  await setDoc(decRef, dataToSave, { merge: true });
  return dataToSave;
}

// Export saveDecisionRecord as alias to preserve backward compatibility
export const saveDecisionRecord = saveUserDecision;

// Mirror / Decision Consultation
export async function consultDecisionMirror(uid, payload = {}) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const mirrorFunc = httpsCallable(functions, 'consult_decision_mirror', { timeout: 120000 });
  const result = await mirrorFunc({ uid, ...payload });
  return result.data;
}

// Epistemic scanning across diary entries
export async function scanDiaryForEpistemicEvents(uid) {
  if (!uid) throw new Error("Missing User ID (UID)");
  const scanFunc = httpsCallable(functions, 'scan_diary_for_epistemic_events', { timeout: 180000 });
  const result = await scanFunc({ uid });
  return result.data;
}

export const scanDiaryForOutcomesAndDecisions = scanDiaryForEpistemicEvents;

// Epistemic Candidates
export async function fetchEpistemicCandidates(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, `users/${uid}/epistemic_candidates`);
    const snap = await getDocsFromServer(colRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("fetchEpistemicCandidates warning:", err);
    return [];
  }
}

export async function resolveEpistemicCandidate(uid, candidateId, status, extraData = {}) {
  if (!uid || !candidateId) throw new Error("Missing UID or candidateId");
  const candRef = doc(db, `users/${uid}/epistemic_candidates`, candidateId);
  const updatePayload = {
    status,
    resolvedAt: new Date().toISOString(),
    ...extraData
  };
  await setDoc(candRef, updatePayload, { merge: true });
  return { id: candidateId, ...updatePayload };
}

// Ontology Candidates (supports both positional and object arguments)
export async function updateOntologyCandidateStatus(arg1, candidateIdArg, statusArg, candidateDataArg = {}) {
  let uid = arg1;
  let candidateId = candidateIdArg;
  let status = statusArg;
  let candidateData = candidateDataArg;
  if (arg1 && typeof arg1 === 'object') {
    uid = arg1.uid || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';
    candidateId = arg1.candidateId || arg1.id;
    status = arg1.status;
    candidateData = arg1.candidateData || {};
  }
  if (!uid || !candidateId) throw new Error("Missing UID or candidateId");
  const candRef = doc(db, `users/${uid}/ontology_candidates`, candidateId);
  const payload = {
    ...candidateData,
    id: candidateId,
    status,
    updatedAt: new Date().toISOString()
  };
  await setDoc(candRef, payload, { merge: true });
  return payload;
}

export async function fetchOntologyCandidates(uid) {
  if (!uid) return [];
  try {
    const colRef = collection(db, `users/${uid}/ontology_candidates`);
    const snap = await getDocsFromServer(colRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("fetchOntologyCandidates warning:", err);
    return [];
  }
}

// Entity Reconciliation (supports both positional and object arguments)
export async function reconcileGraphEntities(arg1, primaryIdArg, duplicateIdArg, actionArg = 'merge') {
  if (arg1 && typeof arg1 === 'object') {
    const uid = arg1.uid || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';
    const canonicalId = arg1.canonicalId || arg1.primaryId;
    const mergedIds = Array.isArray(arg1.mergedIds) ? arg1.mergedIds : (arg1.duplicateId ? [arg1.duplicateId] : []);
    const act = (arg1.action === 'MERGE' || arg1.action === 'merge' || arg1.action === 'SAME_ENTITY') ? 'merge' : 'separate';
    let lastRec = null;
    for (const mId of mergedIds) {
      if (mId && mId !== canonicalId) {
        lastRec = await reconcileGraphEntities(uid, canonicalId, mId, act);
      }
    }
    return lastRec || { status: 'ok', canonicalId, action: act };
  }
  const uid = arg1;
  const primaryId = primaryIdArg;
  const duplicateId = duplicateIdArg;
  const action = actionArg;
  if (!uid || !primaryId || !duplicateId) throw new Error("Missing UID, primaryId or duplicateId");
  
  const recId = `rec_${Date.now()}_${encodeURIComponent(primaryId)}_${encodeURIComponent(duplicateId)}`;
  const recRef = doc(db, `users/${uid}/entity_reconciliations`, recId);
  const recData = {
    id: recId,
    primaryId,
    duplicateId,
    action,
    timestamp: new Date().toISOString()
  };
  await setDoc(recRef, recData, { merge: true });

  if (action === 'merge') {
    const primaryDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, primaryId);
    const duplicateDocRef = doc(db, `users/${uid}/knowledge_graph_nodes`, duplicateId);

    const [primarySnap, dupSnap] = await Promise.all([
      getDocFromServer(primaryDocRef),
      getDocFromServer(duplicateDocRef)
    ]);

    let primaryData = primarySnap.exists() 
      ? primarySnap.data() 
      : { id: primaryId, label: primaryId, type: 'Concept', val: 1, relatedEdges: [] };
    const primaryEdges = primaryData.relatedEdges ? [...primaryData.relatedEdges] : [];

    if (dupSnap.exists()) {
      const dupData = dupSnap.data();
      const dupEdges = dupData.relatedEdges || [];

      // Re-point duplicate edges to primaryId
      const remappedDupEdges = dupEdges.map(edge => ({
        ...edge,
        source: edge.source === duplicateId ? primaryId : edge.source,
        target: edge.target === duplicateId ? primaryId : edge.target
      })).filter(edge => edge.source !== edge.target);

      // Combine edges avoiding duplicates
      const existingEdgeKeys = new Set(primaryEdges.map(e => `${e.source}-${e.target}-${e.relation}`));
      remappedDupEdges.forEach(edge => {
        const key = `${edge.source}-${edge.target}-${edge.relation}`;
        if (!existingEdgeKeys.has(key)) {
          existingEdgeKeys.add(key);
          primaryEdges.push(edge);
        }
      });

      // Merge aliases
      const aliases = new Set(primaryData.aliases || []);
      if (dupData.label) aliases.add(dupData.label);
      if (dupData.aliases && Array.isArray(dupData.aliases)) {
        dupData.aliases.forEach(a => aliases.add(a));
      }
      aliases.add(duplicateId);

      await setDoc(primaryDocRef, {
        ...primaryData,
        val: (primaryData.val || 1) + (dupData.val || 1),
        relatedEdges: primaryEdges,
        aliases: Array.from(aliases),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Delete duplicate document
      await deleteDoc(duplicateDocRef);
    }
  }

  return recData;
}

// Confirm an outcome and link to prediction & decision
export async function confirmOutcomeMatch(uid, outcomeData) {
  if (!uid || !outcomeData) throw new Error("Missing UID or outcomeData");
  const outId = outcomeData.id || `out_${Date.now()}`;
  const docRef = doc(db, `users/${uid}/outcomes`, outId);
  const payload = {
    ...outcomeData,
    id: outId,
    humanConfirmation: true,
    savedAt: new Date().toISOString()
  };
  await setDoc(docRef, payload, { merge: true });

  // Update related prediction status if predictionId exists
  if (outcomeData.predictionId) {
    const predRef = doc(db, `users/${uid}/predictions`, outcomeData.predictionId);
    await setDoc(predRef, {
      empiricalStatus: outcomeData.matchedExpectation === 'FULL' ? 'SUPPORTED' : (outcomeData.matchedExpectation === 'FAILED' ? 'FALSIFIED' : 'PARTIAL'),
      outcomeId: outId
    }, { merge: true });
  }

  return payload;
}
