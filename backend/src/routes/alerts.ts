import { Router } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { zoneGuard } from '../middleware/zoneGuard';
import { transitionAlert } from '../services/alert.service';
import { publishEvent } from '../services/realtime.service';
import { AlertStatus } from '../types/alert';

const router = Router();

router.get('/', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { status, severity, page = '1' } = req.query as Record<string, string>;
    const limit = 50;
    const offset = (Number(page) - 1) * limit;

    const conditions: string[] = ['($1::uuid[] IS NULL OR a.zone_id = ANY($1::uuid[]))'];
    const params: unknown[] = [req.zoneFilter];

    if (status) conditions.push(`a.status = $${params.push(status)}`);
    if (severity) conditions.push(`a.severity = $${params.push(severity)}`);

    const where = conditions.join(' AND ');
    const { rows } = await pool.query(
      `SELECT a.*, s.name AS sensor_name, u.email AS assigned_email
       FROM alerts a
       JOIN sensors s ON s.id = a.sensor_id
       LEFT JOIN users u ON u.id = a.assigned_to
       WHERE ${where}
       ORDER BY a.opened_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ alerts: rows, page: Number(page), limit });
  } catch (err) { next(err); }
});

router.get('/:id', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, s.name AS sensor_name
       FROM alerts a
       JOIN sensors s ON s.id = a.sensor_id
       WHERE a.id = $1 AND ($2::uuid[] IS NULL OR a.zone_id = ANY($2::uuid[]))`,
      [req.params.id, req.zoneFilter]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Alert not found' }); return; }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM alerts WHERE id = $1 AND ($2::uuid[] IS NULL OR zone_id = ANY($2::uuid[]))`,
      [req.params.id, req.zoneFilter]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Alert not found' }); return; }

    const toStatus = Array.isArray(req.body.status) ? req.body.status[0] : req.body.status;
    const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await transitionAlert(
      alertId,
      toStatus as AlertStatus,
      req.user!.id,
      'user',
      req.body.note
    );

    await publishEvent(updated.zone_id, {
      type: 'alert_updated',
      payload: { alert_id: updated.id, status: updated.status, actor_id: req.user!.id },
    });

    res.json(updated);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) { res.status(e.status).json({ error: e.message }); return; }
    next(err);
  }
});

router.get('/:id/transitions', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT at2.*, u.email AS actor_email
       FROM alert_transitions at2
       LEFT JOIN users u ON u.id = at2.actor_id
       WHERE at2.alert_id = $1
       ORDER BY at2.transitioned_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
