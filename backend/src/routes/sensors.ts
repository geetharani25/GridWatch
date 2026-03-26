import { Router } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { zoneGuard } from '../middleware/zoneGuard';
import { getSensorHistory } from '../services/history.service';

const router = Router();

// GET /sensors — zone-filtered list
router.get('/', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
         CASE WHEN sup.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_suppressed
       FROM sensors s
       LEFT JOIN suppressions sup ON sup.sensor_id = s.id
         AND sup.start_time <= NOW() AND sup.end_time >= NOW()
       WHERE ($1::uuid[] IS NULL OR s.zone_id = ANY($1::uuid[]))
       ORDER BY s.name`,
      [req.zoneFilter]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /sensors/:id
router.get('/:id', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const sensorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { rows } = await pool.query(
      `SELECT s.*,
         CASE WHEN sup.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_suppressed,
         sup.start_time AS suppression_start, sup.end_time AS suppression_end,
         al.id AS open_alert_id, al.severity AS open_alert_severity
       FROM sensors s
       LEFT JOIN suppressions sup ON sup.sensor_id = s.id
         AND sup.start_time <= NOW() AND sup.end_time >= NOW()
       LEFT JOIN alerts al ON al.sensor_id = s.id AND al.status = 'open'
       WHERE s.id = $1 AND ($2::uuid[] IS NULL OR s.zone_id = ANY($2::uuid[]))`,
      [sensorId, req.zoneFilter]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Sensor not found' }); return; }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /sensors/:id/history
router.get('/:id/history', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { from, to, page = '1' } = req.query as Record<string, string>;
    if (!from || !to) { res.status(400).json({ error: 'from and to are required' }); return; }

    const sensorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await getSensorHistory(
      sensorId,
      new Date(from),
      new Date(to),
      Number(page),
      req.zoneFilter ?? null
    );
    if (result.readings.length === 0 && Number(page) === 1) {
      res.status(404).json({ error: 'Sensor not found or no readings in range' });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
