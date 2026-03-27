import * as https from 'https';

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const BASE_URL    = arg('--url',          'http://localhost');
const BATCH_SIZE  = Math.min(1000, Math.max(1, parseInt(arg('--count',    '1000'), 10)));
const INTERVAL_MS = Math.max(1000,         parseInt(arg('--interval', '10000'), 10));
const ANOMALY_RATE = Math.min(1, Math.max(0, parseFloat(arg('--anomaly-rate', '0.05'))));

const EMAIL    = 'supervisor@gridwatch.test';
const PASSWORD = 'GridWatch2026!';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function makeReading(sensorId: string): object {
  const anomaly = Math.random() < ANOMALY_RATE;

  let voltage: number;
  let temperature: number;

  if (anomaly) {
    if (Math.random() < 0.5) {
      voltage     = Math.random() < 0.5 ? rand(190, 209) : rand(231, 250);
      temperature = rand(40, 80);
    } else {
      voltage     = rand(210, 230);
      temperature = Math.random() < 0.5 ? rand(20, 39) : rand(81, 100);
    }
  } else {
    voltage     = rand(211, 229);
    temperature = rand(41, 79);
  }

  return {
    sensor_id:   sensorId,
    timestamp:   new Date().toISOString(),
    voltage:     parseFloat(voltage.toFixed(4)),
    current:     parseFloat(rand(4.8, 5.4).toFixed(4)),
    temperature: parseFloat(temperature.toFixed(4)),
    status_code: anomaly ? 1 : 0,
  };
}

async function post(url: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function get(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function main() {
  console.log(`GridWatch ingest simulator`);
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Batch   : ${BATCH_SIZE} readings`);
  console.log(`  Interval: ${INTERVAL_MS}ms`);
  console.log(`  Anomaly : ${(ANOMALY_RATE * 100).toFixed(0)}% of readings`);
  console.log('');

  console.log('Logging in...');
  const loginRes = await post(`${BASE_URL}/api/auth/login`, { email: EMAIL, password: PASSWORD });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    console.error(`Login failed (${loginRes.status}): ${text}`);
    process.exit(1);
  }
  const { token } = await loginRes.json() as { token: string };
  console.log('Login OK');

  console.log('Fetching sensors...');
  const sensorsRes = await get(`${BASE_URL}/api/sensors`, token);
  if (!sensorsRes.ok) {
    console.error(`Failed to fetch sensors: ${sensorsRes.status}`);
    process.exit(1);
  }
  const sensors = await sensorsRes.json() as Array<{ id: string }>;
  const sensorIds = sensors.map(s => s.id);
  console.log(`Got ${sensorIds.length} sensors`);
  console.log('');
  console.log('Starting simulation — Ctrl+C to stop\n');

  let batchNum = 0;

  async function runBatch() {
    batchNum++;
    const start = Date.now();

    const readings = Array.from({ length: BATCH_SIZE }, () => {
      const id = sensorIds[Math.floor(Math.random() * sensorIds.length)];
      return makeReading(id);
    });

    try {
      const res = await post(`${BASE_URL}/api/ingest`, readings, token);
      const elapsed = Date.now() - start;
      if (res.ok) {
        const body = await res.json() as { accepted: number; failed: unknown[] };
        console.log(
          `[${new Date().toISOString()}] batch #${batchNum} — ` +
          `accepted=${body.accepted} failed=${body.failed.length} ${elapsed}ms`
        );
      } else {
        const text = await res.text();
        console.error(`[${new Date().toISOString()}] batch #${batchNum} HTTP ${res.status}: ${text}`);
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] batch #${batchNum} error:`, err);
    }
  }

  await runBatch();
  setInterval(runBatch, INTERVAL_MS);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
