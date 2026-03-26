import { pool } from '../db/pool';
import { Alert, AlertSeverity, AlertStatus, VALID_TRANSITIONS } from '../types/alert';

export async function createAlert(
  anomalyId: string,
  sensorId: string,
  zoneId: string,
  severity: AlertSeverity,
  suppressed: boolean
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO alerts (anomaly_id, sensor_id, zone_id, severity, suppressed)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [anomalyId, sensorId, zoneId, severity, suppressed]
  );
  const alertId = rows[0].id;
  await pool.query(
    `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_type)
     VALUES ($1, NULL, 'open', 'system')`,
    [alertId]
  );
  return alertId;
}

export async function transitionAlert(
  alertId: string,
  toStatus: AlertStatus,
  actorId: string,
  actorType: 'user' | 'system' = 'user',
  note?: string
): Promise<Alert> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM alerts WHERE id = $1 FOR UPDATE',
      [alertId]
    );
    if (!rows[0]) throw Object.assign(new Error('Alert not found'), { status: 404 });

    const current = rows[0] as Alert;
    if (!VALID_TRANSITIONS[current.status].includes(toStatus)) {
      throw Object.assign(
        new Error(`Invalid transition: ${current.status} → ${toStatus}`),
        { status: 409 }
      );
    }

    const tsField = toStatus === 'acknowledged' ? 'acknowledged_at' : 'resolved_at';
    const { rows: [updated] } = await client.query(
      `UPDATE alerts SET status = $1, ${tsField} = NOW() WHERE id = $2 RETURNING *`,
      [toStatus, alertId]
    );

    await client.query(
      `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_id, actor_type, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [alertId, current.status, toStatus, actorId, actorType, note ?? null]
    );

    await client.query('COMMIT');
    return updated as Alert;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
