import { Pool } from 'pg';
import { SeedSensor } from './sensors';
import { USER_IDS } from './users';

export async function seedDemoScenarios(pool: Pool, sensors: SeedSensor[]): Promise<void> {
  // 50 sensors with threshold breach anomalies (voltage spike)
  const breachSensors = sensors.slice(0, 50);
  for (const sensor of breachSensors) {
    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, reading_id, rule, detail)
       SELECT $1, r.id, 'threshold_breach', '{"field":"voltage","value":245,"max":230}'::jsonb
       FROM readings r WHERE r.sensor_id = $1 ORDER BY r.timestamp DESC LIMIT 1
       RETURNING id`,
      [sensor.id]
    );
    if (!anomaly) continue;
    const severity = sensor.seed % 3 === 0 ? 'critical' : 'warning';
    await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, zone_id, severity, suppressed)
       VALUES ($1, $2, $3, $4, false)`,
      [anomaly.id, sensor.id, sensor.zone_id, severity]
    );
    const { rows: [alert] } = await pool.query(
      `SELECT id FROM alerts WHERE anomaly_id = $1`, [anomaly.id]
    );
    await pool.query(
      `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_type) VALUES ($1, NULL, 'open', 'system')`,
      [alert.id]
    );
    await pool.query(`UPDATE sensors SET status = $1 WHERE id = $2`, [severity, sensor.id]);
  }
  console.log('  Threshold breach scenarios: 50 sensors');

  // 20 sensors set silent (last_seen_at 3 hours ago)
  const silentSensors = sensors.slice(50, 70);
  for (const sensor of silentSensors) {
    await pool.query(
      `UPDATE sensors SET last_seen_at = NOW() - INTERVAL '3 hours', status = 'healthy' WHERE id = $1`,
      [sensor.id]
    );
  }
  console.log('  Silent sensor candidates: 20 sensors (will be detected by worker)');

  // 10 sensors with active suppressions
  const suppressedSensors = sensors.slice(70, 80);
  for (const sensor of suppressedSensors) {
    await pool.query(
      `INSERT INTO suppressions (sensor_id, start_time, end_time, created_by)
       VALUES ($1, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '23 hours', $2)`,
      [sensor.id, USER_IDS.supervisor]
    );
  }
  console.log('  Active suppressions: 10 sensors');

  // 5 critical alerts opened >5 minutes ago (for escalation demo)
  const escalateSensors = sensors.slice(80, 85);
  for (const sensor of escalateSensors) {
    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, reading_id, rule, detail, triggered_at)
       SELECT $1, r.id, 'threshold_breach', '{"field":"voltage","value":250,"max":230}'::jsonb, NOW() - INTERVAL '6 minutes'
       FROM readings r WHERE r.sensor_id = $1 ORDER BY r.timestamp DESC LIMIT 1
       RETURNING id`,
      [sensor.id]
    );
    if (!anomaly) continue;
    await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, zone_id, severity, opened_at)
       VALUES ($1, $2, $3, 'critical', NOW() - INTERVAL '6 minutes')`,
      [anomaly.id, sensor.id, sensor.zone_id]
    );
    const { rows: [alert] } = await pool.query(
      `SELECT id FROM alerts WHERE anomaly_id = $1`, [anomaly.id]
    );
    await pool.query(
      `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_type) VALUES ($1, NULL, 'open', 'system')`,
      [alert.id]
    );
    await pool.query(`UPDATE sensors SET status = 'critical' WHERE id = $1`, [sensor.id]);
  }
  console.log('  Escalatable critical alerts: 5 (opened 6 min ago)');

  // 3 acknowledged alerts
  const ackSensors = sensors.slice(85, 88);
  for (const sensor of ackSensors) {
    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, rule, detail) VALUES ($1, 'threshold_breach', '{"field":"voltage","value":235,"max":230}'::jsonb) RETURNING id`,
      [sensor.id]
    );
    await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, zone_id, severity, status, acknowledged_at)
       VALUES ($1, $2, $3, 'warning', 'acknowledged', NOW() - INTERVAL '30 minutes')`,
      [anomaly.id, sensor.id, sensor.zone_id]
    );
    const { rows: [alert] } = await pool.query(
      `SELECT id FROM alerts WHERE anomaly_id = $1`, [anomaly.id]
    );
    await pool.query(
      `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_id, actor_type) VALUES ($1, 'open', 'acknowledged', $2, 'user')`,
      [alert.id, USER_IDS.operatorA]
    );
  }
  console.log('  Acknowledged alerts: 3');

  // 2 resolved alerts with full transition history
  const resolvedSensors = sensors.slice(88, 90);
  for (const sensor of resolvedSensors) {
    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, rule, detail) VALUES ($1, 'threshold_breach', '{"field":"temperature","value":85,"max":80}'::jsonb) RETURNING id`,
      [sensor.id]
    );
    await pool.query(
      `INSERT INTO alerts (anomaly_id, sensor_id, zone_id, severity, status, acknowledged_at, resolved_at)
       VALUES ($1, $2, $3, 'warning', 'resolved', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')`,
      [anomaly.id, sensor.id, sensor.zone_id]
    );
    const { rows: [alert] } = await pool.query(
      `SELECT id FROM alerts WHERE anomaly_id = $1`, [anomaly.id]
    );
    await pool.query(
      `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_id, actor_type) VALUES
       ($1, NULL, 'open', NULL, 'system'),
       ($1, 'open', 'acknowledged', $2, 'user'),
       ($1, 'acknowledged', 'resolved', $2, 'user')`,
      [alert.id, USER_IDS.operatorB]
    );
  }
  console.log('  Resolved alerts: 2');
}
