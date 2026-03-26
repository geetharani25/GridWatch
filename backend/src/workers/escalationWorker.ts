import { pool } from '../db/pool';
import { publishEvent } from '../services/realtime.service';
import { logger } from '../lib/logger';

async function escalateCriticalAlerts(): Promise<void> {
  const { rows: candidates } = await pool.query(`
    SELECT a.id, a.zone_id
    FROM alerts a
    WHERE a.status = 'open'
      AND a.severity = 'critical'
      AND a.opened_at < NOW() - INTERVAL '5 minutes'
      AND a.escalated_at IS NULL
      AND a.suppressed = FALSE
  `);

  if (candidates.length === 0) return;

  const { rows: [supervisor] } = await pool.query(
    `SELECT id FROM users WHERE role = 'supervisor' LIMIT 1`
  );
  if (!supervisor) return;

  for (const alert of candidates) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [lockResult] } = await client.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1))',
        [alert.id]
      );
      if (!lockResult.pg_try_advisory_xact_lock) {
        await client.query('ROLLBACK');
        continue;
      }

      const { rowCount } = await client.query(
        `INSERT INTO escalation_log (alert_id, assigned_to, note)
         VALUES ($1, $2, 'Auto-escalated: critical open > 5 minutes')
         ON CONFLICT (alert_id) DO NOTHING`,
        [alert.id, supervisor.id]
      );

      if (rowCount === 0) {
        await client.query('ROLLBACK');
        continue;
      }

      await client.query(
        `UPDATE alerts SET escalated_at = NOW(), assigned_to = $1 WHERE id = $2`,
        [supervisor.id, alert.id]
      );

      await client.query(
        `INSERT INTO alert_transitions (alert_id, from_status, to_status, actor_id, actor_type, note)
         VALUES ($1, 'open', 'open', $2, 'system', 'Escalated to supervisor')`,
        [alert.id, supervisor.id]
      );

      await client.query('COMMIT');

      await publishEvent(alert.zone_id, {
        type: 'escalation',
        payload: { alert_id: alert.id, assigned_to: supervisor.id },
      });

      logger.info({ alert_id: alert.id, assigned_to: supervisor.id }, 'Alert escalated');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error({ err, alert_id: alert.id }, 'Escalation failed');
    } finally {
      client.release();
    }
  }
}

export function startEscalationWorker(): void {
  logger.info('Escalation worker started');
  setInterval(() => escalateCriticalAlerts().catch(err => logger.error({ err }, 'Escalation cycle failed')), 15_000);
  escalateCriticalAlerts().catch(err => logger.error({ err }, 'Escalation cycle failed'));
}
