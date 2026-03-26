import { Router } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { zoneGuard } from '../middleware/zoneGuard';

const router = Router();

// POST /suppressions
router.post('/', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { sensor_id, start_time, end_time } = req.body;
    if (!sensor_id || !start_time || !end_time) {
      res.status(400).json({ error: 'sensor_id, start_time, end_time required' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id FROM sensors WHERE id = $1 AND ($2::uuid[] IS NULL OR zone_id = ANY($2::uuid[]))`,
      [sensor_id, req.zoneFilter]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Sensor not found' }); return; }

    const { rows: [suppression] } = await pool.query(
      `INSERT INTO suppressions (sensor_id, start_time, end_time, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [sensor_id, start_time, end_time, req.user!.id]
    );

    res.status(201).json({
      suppression,
      note: 'Existing open alerts for this sensor are not retroactively suppressed.',
    });
  } catch (err) { next(err); }
});

// DELETE /suppressions/:id
router.delete('/:id', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const suppId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { rows } = await pool.query(
      `SELECT sup.id FROM suppressions sup
       JOIN sensors s ON s.id = sup.sensor_id
       WHERE sup.id = $1 AND ($2::uuid[] IS NULL OR s.zone_id = ANY($2::uuid[]))`,
      [suppId, req.zoneFilter]
    );
    if (!rows[0]) { res.status(404).json({ error: 'Suppression not found' }); return; }

    await pool.query('DELETE FROM suppressions WHERE id = $1', [suppId]);
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /suppressions?sensor_id=...
router.get('/', authMiddleware, zoneGuard, async (req, res, next) => {
  try {
    const { sensor_id } = req.query;
    const { rows } = await pool.query(
      `SELECT sup.*, s.name AS sensor_name
       FROM suppressions sup
       JOIN sensors s ON s.id = sup.sensor_id
       WHERE ($1::uuid[] IS NULL OR s.zone_id = ANY($1::uuid[]))
         AND ($2::uuid IS NULL OR sup.sensor_id = $2)
       ORDER BY sup.start_time DESC`,
      [req.zoneFilter, sensor_id || null]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
