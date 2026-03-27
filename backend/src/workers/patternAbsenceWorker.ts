import { pool } from '../db/pool';
import { isActive } from '../services/suppression.service';
import { createAlert } from '../services/alert.service';
import { publishEvent } from '../services/realtime.service';
import { logger } from '../lib/logger';

async function checkSilentSensors(): Promise<void> {
  const { rows: silentSensors } = await pool.query(`
    SELECT s.id, s.zone_id, s.last_seen_at, s.status,
           COALESCE(sc.rule_c_severity, 'critical') AS rule_c_severity
    FROM sensors s
    LEFT JOIN sensor_configs sc ON sc.sensor_id = s.id
    WHERE s.last_seen_at < NOW() - INTERVAL '2 minutes'
      AND s.status != 'silent'
  `);

  for (const sensor of silentSensors) {
    const { rows: recent } = await pool.query(`
      SELECT id FROM anomalies
      WHERE sensor_id = $1
        AND rule = 'pattern_absence'
        AND triggered_at > NOW() - INTERVAL '5 minutes'
      LIMIT 1
    `, [sensor.id]);
    if (recent.length > 0) continue;

    const suppressed = await isActive(sensor.id, new Date());

    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, reading_id, rule, detail)
       VALUES ($1, NULL, 'pattern_absence', $2) RETURNING id`,
      [sensor.id, JSON.stringify({ last_seen_at: sensor.last_seen_at })]
    );

    const severity = sensor.rule_c_severity as 'warning' | 'critical';
    const alertId = await createAlert(anomaly.id, sensor.id, sensor.zone_id, severity, suppressed);

    await pool.query(
      'UPDATE sensors SET status = $1 WHERE id = $2',
      ['silent', sensor.id]
    );

    if (!suppressed) {
      await publishEvent(sensor.zone_id, {
        type: 'sensor_state_change',
        payload: {
          sensor_id: sensor.id,
          zone_id: sensor.zone_id,
          new_status: 'silent',
          previous_status: sensor.status,
        },
      });
    }
  }

  if (silentSensors.length > 0) {
    logger.info({ count: silentSensors.length }, 'Pattern absence: sensors marked silent');
  }
}

export function startPatternAbsenceWorker(): void {
  logger.info('Pattern absence worker started');
  setInterval(() => checkSilentSensors().catch(err => logger.error({ err }, 'Pattern absence check failed')), 30_000);
  checkSilentSensors().catch(err => logger.error({ err }, 'Pattern absence check failed'));
}
