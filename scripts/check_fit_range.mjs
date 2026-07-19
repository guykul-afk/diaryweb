import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
  const url = 'https://oauth2.googleapis.com/token';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function check() {
  const token = await getAccessToken();
  const now = Date.now();
  const start = now - 60 * 24 * 60 * 60 * 1000;
  
  const startNanos = start * 1000000;
  const endNanos = now * 1000000;
  const range = `${startNanos}-${endNanos}`;

  const sources = [
    'derived:com.google.step_count.delta:com.google.android.fit:Google:Pixel 8a:8e5c785d:top_level',
    'raw:com.google.step_count.cumulative:Google:Pixel 8a:8e5c785d:Step Counter',
    'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
    'raw:com.google.sleep.segment:com.ouraring.oura:',
    'derived:com.google.sleep.segment:com.google.android.gms:merged',
    'derived:com.google.heart_rate.bpm:com.ouraring.oura:',
    'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm'
  ];

  for (const sourceId of sources) {
    console.log(`Checking: ${sourceId}`);
    const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(sourceId)}/datasets/${range}`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await response.json();
    console.log(`-> Points: ${data.point?.length || 0}`);
  }
}

check().catch(console.error);
