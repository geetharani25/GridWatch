import { pool } from '../db/pool';
import { redis } from '../db/redis';
import { SensorReading, SensorReadingSchema } from '../types/sensor';

export function validateBatch(raw: unknown[]): {
  valid: SensorReading[];
  failed: { index: number; error: string }[];
} {
  const valid: SensorReading[] = [];
  const failed: { index: number; error: string }[] = [];
  raw.forEach((item, index) => {
    const result = SensorReadingSchema.safeParse(item);
    if (result.success) valid.push(result.data);
    else failed.push({ index, error: result.error.issues[0].message });
  });
  return { valid, failed };
}

export async function bulkInsert(readings: SensorReading[]): Promise<void> {
  if (readings.length === 0) return;
  const values: unknown[] = [];
  const placeholders = readings.map((r, i) => {
    const base = i * 6;
    values.push(r.sensor_id, r.timestamp, r.voltage, r.current, r.temperature, r.status_code);
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`;
  });
  await pool.query(
    `INSERT INTO readings (sensor_id, timestamp, voltage, current, temperature, status_code)
     VALUES ${placeholders.join(',')}
     ON CONFLICT (sensor_id, timestamp) DO NOTHING`,
    values
  );
}

export async function enqueueForProcessing(readings: SensorReading[]): Promise<void> {
  for (const r of readings) {
    const msg = JSON.stringify({ sensor_id: r.sensor_id, timestamp: r.timestamp });
    try {
      await redis.rpush('queue:anomaly', msg);
    } catch {
      await pool.query("SELECT pg_notify('anomaly_queue', $1)", [msg]);
    }
  }
}

export async function updateLastSeen(readings: SensorReading[]): Promise<void> {
  const latest = new Map<string, string>();
  for (const r of readings) {
    if (!latest.has(r.sensor_id) || r.timestamp > latest.get(r.sensor_id)!)
      latest.set(r.sensor_id, r.timestamp);
  }
  const ids = [...latest.keys()];
  const timestamps = ids.map(id => latest.get(id)!);
  await Promise.all(
    ids.map((id, i) =>
      pool.query(
        'UPDATE sensors SET last_seen_at = $1 WHERE id = $2 AND (last_seen_at IS NULL OR last_seen_at < $1)',
        [timestamps[i], id]
      )
    )
  );
}
