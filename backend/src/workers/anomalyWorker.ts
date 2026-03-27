import { pool } from '../db/pool';
import { redisQueue as redis } from '../db/redis';
import { evaluateRuleA, evaluateRuleB } from '../services/anomaly.service';
import { createAlert } from '../services/alert.service';
import { publishEvent } from '../services/realtime.service';
import { AnomalyRecord } from '../types/alert';
import { logger } from '../lib/logger';

const FETCH_QUERY = `
  SELECT
    r.id, r.sensor_id, r.timestamp, r.voltage, r.current, r.temperature, r.status_code,
    sc.voltage_min, sc.voltage_max, sc.temperature_min, sc.temperature_max,
    sc.rate_of_change_pct, sc.rule_a_severity, sc.rule_b_severity,
    s.zone_id, s.status AS current_status,
    (SELECT JSON_AGG(JSON_BUILD_OBJECT('voltage', pr.voltage, 'temperature', pr.temperature))
     FROM (SELECT voltage, temperature FROM readings
           WHERE sensor_id = r.sensor_id AND id != r.id
           ORDER BY timestamp DESC LIMIT 3) pr
    ) AS prev_readings,
    sup.id AS suppression_id
  FROM readings r
  JOIN sensors s ON s.id = r.sensor_id
  LEFT JOIN sensor_configs sc ON sc.sensor_id = r.sensor_id
  LEFT JOIN suppressions sup ON sup.sensor_id = r.sensor_id
    AND sup.start_time <= r.timestamp AND sup.end_time >= r.timestamp
  WHERE r.sensor_id = $1 AND r.timestamp = $2
`;

async function processReading(sensorId: string, timestamp: string): Promise<void> {
  const { rows } = await pool.query(FETCH_QUERY, [sensorId, timestamp]);
  if (!rows[0] || rows[0].voltage_min === undefined) return;

  const row = rows[0];
  const suppressed = !!row.suppression_id;
  const prevReadings: Array<{ voltage: number; temperature: number }> = row.prev_readings || [];
  const config = {
    voltage_min:        row.voltage_min !== null ? Number(row.voltage_min) : null,
    voltage_max:        row.voltage_max !== null ? Number(row.voltage_max) : null,
    temperature_min:    row.temperature_min !== null ? Number(row.temperature_min) : null,
    temperature_max:    row.temperature_max !== null ? Number(row.temperature_max) : null,
    rate_of_change_pct: row.rate_of_change_pct !== null ? Number(row.rate_of_change_pct) : null,
    rule_a_severity:    row.rule_a_severity,
    rule_b_severity:    row.rule_b_severity,
    rule_c_severity:    'critical' as const,
  };
  const reading = { voltage: Number(row.voltage), temperature: Number(row.temperature) };
  const parsedPrev = prevReadings.map(p => ({ voltage: Number(p.voltage), temperature: Number(p.temperature) }));

  const anomalyRules: AnomalyRecord[] = [
    ...evaluateRuleA(reading, config),
    ...evaluateRuleB(reading, parsedPrev, config),
  ];

  let newStatus = row.current_status;
  for (const anomalyData of anomalyRules) {
    const { rows: [anomaly] } = await pool.query(
      `INSERT INTO anomalies (sensor_id, reading_id, rule, detail)
       SELECT $1, id, $2, $3 FROM readings WHERE sensor_id = $1 AND timestamp = $4
       RETURNING id`,
      [sensorId, anomalyData.rule, JSON.stringify(anomalyData.detail), timestamp]
    );
    if (!anomaly) continue;

    const severity = anomalyData.rule === 'threshold_breach'
      ? config.rule_a_severity : config.rule_b_severity;
    const alertId = await createAlert(anomaly.id, sensorId, row.zone_id, severity, suppressed);
    newStatus = severity === 'critical' ? 'critical' : (newStatus === 'critical' ? 'critical' : 'warning');

    if (!suppressed) {
      await publishEvent(row.zone_id, {
        type: 'alert_created',
        payload: { alert_id: alertId, sensor_id: sensorId, zone_id: row.zone_id, severity },
      });
    }
  }

  if (anomalyRules.length === 0) newStatus = 'healthy';
  if (newStatus !== row.current_status) {
    await pool.query('UPDATE sensors SET status = $1 WHERE id = $2', [newStatus, sensorId]);
    await publishEvent(row.zone_id, {
      type: 'sensor_state_change',
      payload: { sensor_id: sensorId, zone_id: row.zone_id, new_status: newStatus, previous_status: row.current_status },
    });
  }
}

export async function startAnomalyWorker(): Promise<void> {
  logger.info('Anomaly worker started');
  while (true) {
    try {
      const result = await redis.blpop('queue:anomaly', 5);
      if (!result) continue;
      const { sensor_id, timestamp } = JSON.parse(result[1]);
      await processReading(sensor_id, timestamp).catch(err =>
        logger.error({ err, sensor_id }, 'Failed to process reading')
      );
    } catch (err) {
      logger.error({ err }, 'Anomaly worker error');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
