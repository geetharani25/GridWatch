import { pool } from '../db/pool';

export async function isActive(sensorId: string, atTime: Date): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM suppressions
     WHERE sensor_id = $1 AND start_time <= $2 AND end_time >= $2 LIMIT 1`,
    [sensorId, atTime]
  );
  return rows.length > 0;
}
