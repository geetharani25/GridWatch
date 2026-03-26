import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { config } from '../config';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password required' });
    return;
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!rows[0]) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const { rows: zones } = await pool.query(
    'SELECT zone_id FROM user_zones WHERE user_id = $1',
    [rows[0].id]
  );

  const token = jwt.sign(
    { sub: rows[0].id, role: rows[0].role, zones: zones.map((z: { zone_id: string }) => z.zone_id) },
    config.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: { id: rows[0].id, email: rows[0].email, role: rows[0].role } });
});

export default router;
