import { Pool } from 'pg';
import { SeedSensor } from './sensors';

export async function seedSensorConfigs(pool: Pool, sensors: SeedSensor[]): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < sensors.length; i += BATCH) {
    const batch = sensors.slice(i, i + BATCH);
    const values = batch.map(s => {
      const severity = s.seed % 3 === 0 ? 'critical' : 'warning';
      return `('${s.id}', 210, 230, 40, 80, 25.0, '${severity}', '${severity}', 'critical')`;
    }).join(',');
    await pool.query(
      `INSERT INTO sensor_configs (sensor_id, voltage_min, voltage_max, temperature_min, temperature_max, rate_of_change_pct, rule_a_severity, rule_b_severity, rule_c_severity)
       VALUES ${values} ON CONFLICT (sensor_id) DO NOTHING`
    );
  }
  console.log(`  Sensor configs: ${sensors.length}`);
}
