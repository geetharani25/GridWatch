import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { ZONE_IDS } from './zones';

export interface SeedSensor {
  id: string;
  zone_id: string;
  name: string;
  seed: number;
}

export async function seedSensors(pool: Pool): Promise<SeedSensor[]> {
  const zoneCounts: Array<[string, number]> = [
    [ZONE_IDS.northeast, 400],
    [ZONE_IDS.southern,  350],
    [ZONE_IDS.western,   300],
  ];

  const sensors: SeedSensor[] = [];
  for (const [zoneId, count] of zoneCounts) {
    for (let i = 1; i <= count; i++) {
      sensors.push({ id: uuidv4(), zone_id: zoneId, name: `Sensor-${zoneId.slice(-3)}-${String(i).padStart(4, '0')}`, seed: i });
    }
  }

  const BATCH = 100;
  for (let i = 0; i < sensors.length; i += BATCH) {
    const batch = sensors.slice(i, i + BATCH);
    const values = batch.map(s => `('${s.id}','${s.zone_id}','${s.name}','healthy')`).join(',');
    await pool.query(
      `INSERT INTO sensors (id, zone_id, name, status) VALUES ${values} ON CONFLICT (id) DO NOTHING`
    );
  }

  console.log(`  Sensors: ${sensors.length}`);
  return sensors;
}
