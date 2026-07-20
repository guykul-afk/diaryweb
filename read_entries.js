require('dotenv').config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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
const auth = getAuth(app);

async function main() {
  try {
    console.log("Signing in anonymously...");
    await signInAnonymously(auth);
    console.log("Authenticated successfully!");
    
    const uid = process.env.VITE_FIREBASE_UID || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';
    const entriesRef = collection(db, `users/${uid}/entries`);
    const q = query(entriesRef, orderBy('timestamp', 'desc'), limit(10));
    console.log("Fetching entries...");
    const querySnapshot = await getDocs(q);
    
    const entries = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      entries.push({
        id: doc.id,
        timestamp: data.timestamp,
        topics: data.topics || [],
        mood: data.mood || data.sentiment || 'neutral',
        content: data.transcript || data.content || ''
      });
    });
    
    console.log("SUCCESS_DATA_START");
    console.log(JSON.stringify(entries, null, 2));
    console.log("SUCCESS_DATA_END");
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }
}

main();
