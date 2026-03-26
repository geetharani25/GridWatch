import { pool } from '../db/pool';
import { redis } from '../db/redis';

export async function getSensorHistory(
  sensorId: string,
  from: Date,
  to: Date,
  page: number,
  zoneFilter: string[] | null
) {
  const limit = 100;
  const offset = (page - 1) * limit;

  // Count query — cached in Redis for 30s
  const cacheKey = `sensor_history_count:${sensorId}:${from.toISOString()}:${to.toISOString()}`;
  let totalCount: number;
  const cached = await redis.get(cacheKey);
  if (cached) {
    totalCount = Number(cached);
  } else {
    const { rows: [countRow] } = await pool.query(
      `SELECT COUNT(*) FROM readings r
       JOIN sensors s ON s.id = r.sensor_id
       WHERE r.sensor_id = $1 AND r.timestamp >= $2 AND r.timestamp <= $3
         AND ($4::uuid[] IS NULL OR s.zone_id = ANY($4::uuid[]))`,
      [sensorId, from, to, zoneFilter]
    );
    totalCount = Number(countRow.count);
    await redis.setex(cacheKey, 30, String(totalCount));
  }

  const { rows } = await pool.query(`
    WITH sensor_check AS (
      SELECT id FROM sensors
      WHERE id = $1 AND ($2::uuid[] IS NULL OR zone_id = ANY($2::uuid[]))
    ),
    reading_page AS (
      SELECT r.id, r.timestamp, r.voltage, r.current, r.temperature, r.status_code
      FROM readings r
      WHERE r.sensor_id = $1
        AND r.timestamp >= $3 AND r.timestamp <= $4
        AND EXISTS (SELECT 1 FROM sensor_check)
      ORDER BY r.timestamp DESC
      LIMIT $5 OFFSET $6
    ),
    anomaly_join AS (
      SELECT a.reading_id, a.id AS anomaly_id, a.rule, a.detail,
             al.id AS alert_id, al.status AS alert_status
      FROM anomalies a
      JOIN alerts al ON al.anomaly_id = a.id
      WHERE a.reading_id = ANY(SELECT id FROM reading_page)
    )
    SELECT
      rp.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'anomaly_id',   aj.anomaly_id,
            'rule',         aj.rule,
            'detail',       aj.detail,
            'alert_id',     aj.alert_id,
            'alert_status', aj.alert_status
          )
        ) FILTER (WHERE aj.anomaly_id IS NOT NULL),
        '[]'
      ) AS anomalies
    FROM reading_page rp
    LEFT JOIN anomaly_join aj ON aj.reading_id = rp.id
    GROUP BY rp.id, rp.timestamp, rp.voltage, rp.current, rp.temperature, rp.status_code
    ORDER BY rp.timestamp DESC
  `, [sensorId, zoneFilter, from, to, limit, offset]);

  return {
    readings: rows,
    page,
    limit,
    total: totalCount,
    pages: Math.ceil(totalCount / limit),
  };
}
