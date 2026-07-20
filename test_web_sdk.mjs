import * as dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

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

async function run() {
  const uid = "K9j4Nx0WK7NKYJs6iDUz35LXFai1";
  const q = collection(db, `users/${uid}/entries`);
  const snapshot = await getDocs(q);
  console.log("Total entries in database:", snapshot.size);
  process.exit(0);
}

run().catch(console.error);
