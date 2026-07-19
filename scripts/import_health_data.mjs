import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection } from 'firebase/firestore';

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

const TAKEOUT_DIR = "./takeout-20260713T152930Z-2-001/Takeout/Google Health";

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Basic CSV split, handle potential quotes if needed, but simple is fine here
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

function parseDate(timestampStr) {
  if (!timestampStr) return null;
  return timestampStr.split('T')[0];
}

async function run() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: node scripts/import_health_data.mjs <UID>");
    process.exit(1);
  }

  console.log(`Parsing health data from: ${TAKEOUT_DIR}`);
  const dailyMetrics = {};

  const getOrCreateDay = (date) => {
    if (!dailyMetrics[date]) {
      dailyMetrics[date] = {
        sleep_score: null,
        steps: 0,
        resting_hr: null,
        hrv: null,
        active_minutes: 0
      };
    }
    return dailyMetrics[date];
  };

  // 1. Sleep Score
  const sleepCsv = path.join(TAKEOUT_DIR, "Sleep Score", "sleep_score.csv");
  const sleepRows = parseCSV(sleepCsv);
  console.log(`Parsed ${sleepRows.length} sleep score rows.`);
  sleepRows.forEach(row => {
    const date = parseDate(row.timestamp);
    if (date && row.overall_score) {
      getOrCreateDay(date).sleep_score = parseInt(row.overall_score, 10);
    }
  });

  // 2. Steps
  const physicalActivityDir = path.join(TAKEOUT_DIR, "Physical Activity_GoogleData");
  if (fs.existsSync(physicalActivityDir)) {
    const files = fs.readdirSync(physicalActivityDir);
    const stepsFiles = files.filter(f => f.startsWith("steps_") && f.endsWith(".csv"));
    console.log(`Found ${stepsFiles.length} steps files.`);
    
    stepsFiles.forEach(file => {
      const rows = parseCSV(path.join(physicalActivityDir, file));
      rows.forEach(row => {
        const date = parseDate(row.timestamp);
        if (date && row.steps) {
          getOrCreateDay(date).steps += parseInt(row.steps, 10);
        }
      });
    });
  }

  // 3. Resting Heart Rate
  const restingHrCsv = path.join(physicalActivityDir, "daily_resting_heart_rate.csv");
  const restingHrRows = parseCSV(restingHrCsv);
  console.log(`Parsed ${restingHrRows.length} resting heart rate rows.`);
  restingHrRows.forEach(row => {
    const date = parseDate(row.timestamp);
    if (date && row['beats per minute']) {
      getOrCreateDay(date).resting_hr = parseFloat(row['beats per minute']);
    }
  });

  // 4. HRV
  const hrvCsv = path.join(physicalActivityDir, "daily_heart_rate_variability.csv");
  const hrvRows = parseCSV(hrvCsv);
  console.log(`Parsed ${hrvRows.length} HRV rows.`);
  hrvRows.forEach(row => {
    const date = parseDate(row.timestamp);
    const val = row['average heart rate variability milliseconds'];
    if (date && val) {
      getOrCreateDay(date).hrv = parseFloat(val);
    }
  });

  // 5. Active Zone Minutes
  if (fs.existsSync(physicalActivityDir)) {
    const files = fs.readdirSync(physicalActivityDir);
    const activeFiles = files.filter(f => f.startsWith("active_zone_minutes_") && f.endsWith(".csv"));
    console.log(`Found ${activeFiles.length} active zone minutes files.`);
    
    activeFiles.forEach(file => {
      const rows = parseCSV(path.join(physicalActivityDir, file));
      rows.forEach(row => {
        const date = parseDate(row.timestamp);
        const val = row['total minutes'];
        if (date && val) {
          getOrCreateDay(date).active_minutes += parseInt(val, 10);
        }
      });
    });
  }

  const days = Object.keys(dailyMetrics).filter(date => date >= '2026-06-11');
  console.log(`Total days with metrics (after June 11, 2026): ${days.length}`);
  if (days.length === 0) {
    console.log("No data found to upload.");
    process.exit(0);
  }

  // Deleting older HealthMetric nodes from Firestore
  console.log("Cleaning up old HealthMetric nodes before June 11, 2026...");
  try {
    const { getDocs, query, where, deleteDoc } = await import('firebase/firestore');
    const q = query(
      collection(db, `users/${uid}/knowledge_graph_nodes`),
      where("type", "==", "HealthMetric")
    );
    const snap = await getDocs(q);
    let deleteBatch = writeBatch(db);
    let delCount = 0;
    
    for (const docSnap of snap.docs) {
      const docData = docSnap.data();
      const nodeDate = docData.date;
      if (nodeDate && nodeDate < '2026-06-11') {
        deleteBatch.delete(docSnap.ref);
        delCount++;
        if (delCount % 400 === 0) {
          await deleteBatch.commit();
          deleteBatch = writeBatch(db);
        }
      }
    }
    if (delCount % 400 !== 0) {
      await deleteBatch.commit();
    }
    console.log(`Deleted ${delCount} old HealthMetric nodes from graph.`);
  } catch (err) {
    console.error("Error cleaning up old nodes:", err);
  }

  console.log(`Uploading to Firestore for UID: ${uid}...`);
  
  let batch = writeBatch(db);
  let count = 0;
  
  for (const date of days) {
    const data = dailyMetrics[date];
    const nodeId = `Health_${date.replace(/-/g, '_')}`;
    
    const contentParts = [];
    if (data.sleep_score) contentParts.push(`Sleep Score: ${data.sleep_score}`);
    if (data.steps) contentParts.push(`Steps: ${data.steps}`);
    if (data.resting_hr) contentParts.push(`Resting HR: ${data.resting_hr.toFixed(1)} bpm`);
    if (data.hrv) contentParts.push(`HRV: ${data.hrv.toFixed(1)} ms`);
    if (data.active_minutes) contentParts.push(`Active Minutes: ${data.active_minutes}`);
    
    const content = `Health Metrics for ${date}:\n` + contentParts.join('\n');
    
    const docRef = doc(db, `users/${uid}/knowledge_graph_nodes`, nodeId);
    batch.set(docRef, {
      id: nodeId,
      label: `Health ${date}`,
      type: "HealthMetric",
      val: 1,
      content: content,
      metrics: data,
      date: date
    }, { merge: true });
    
    count++;
    if (count % 400 === 0) {
      console.log(`Committing batch of ${count}...`);
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  
  if (count % 400 !== 0) {
    console.log(`Committing final batch...`);
    await batch.commit();
  }
  
  console.log(`Successfully uploaded ${count} HealthMetric nodes to OKF graph.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
