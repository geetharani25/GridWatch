import { Pool } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { SeedSensor } from './sensors';

export async function seedReadings(pool: Pool, sensors: SeedSensor[]): Promise<void> {
  const client = await pool.connect();
  try {
    const copyStream = client.query(
      copyFrom('COPY readings (sensor_id, timestamp, voltage, current, temperature, status_code) FROM STDIN CSV')
    );

    const readable = new Readable({ read() {} });

    const pipelinePromise = pipeline(readable, copyStream);

    const start = new Date('2026-03-24T00:00:00Z').getTime();
    const INTERVALS = 576; // 48h at 5-minute intervals

    for (let interval = 0; interval < INTERVALS; interval++) {
      const ts = new Date(start + interval * 5 * 60 * 1000).toISOString();
      for (const sensor of sensors) {
        const voltage     = (220 + Math.sin(interval * 0.1 + sensor.seed * 0.01) * 5).toFixed(4);
        const temperature = (60  + Math.cos(interval * 0.05) * 10).toFixed(4);
        readable.push(`${sensor.id},${ts},${voltage},5.1000,${temperature},0\n`);
      }
    }
    readable.push(null);

    await pipelinePromise;
    console.log(`  Readings: ~${sensors.length * INTERVALS} (via COPY)`);
  } finally {
    client.release();
  }
}
