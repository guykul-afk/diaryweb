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
  if (!response.ok) {
    throw new Error(`Failed to refresh access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function listSources() {
  console.log("Refreshing access token...");
  const token = await getAccessToken();

  console.log("Fetching available data sources from Google Fit API...");
  const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Error fetching data sources:", data);
    return;
  }

  console.log("\n=== FOUND DATA SOURCES ===");
  if (!data.dataSource || data.dataSource.length === 0) {
    console.log("No data sources found on this account.");
    return;
  }

  data.dataSource.forEach(ds => {
    console.log(`- Type: ${ds.dataType.name}`);
    console.log(`  ID: ${ds.dataStreamId}`);
    console.log(`  Name: ${ds.name || 'N/A'}`);
    console.log(`  Device: ${ds.device ? `${ds.device.manufacturer} ${ds.device.model}` : 'N/A'}`);
    console.log("-----------------------------------------");
  });
}

listSources().catch(console.error);
