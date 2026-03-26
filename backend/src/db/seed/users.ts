import { Pool } from 'pg';
import bcrypt from 'bcrypt';

export const USER_IDS = {
  operatorA:  '22222222-0000-0000-0000-000000000001',
  operatorB:  '22222222-0000-0000-0000-000000000002',
  supervisor: '22222222-0000-0000-0000-000000000003',
};

export async function seedUsers(pool: Pool): Promise<void> {
  const hash = await bcrypt.hash('GridWatch2026!', 10);

  await pool.query(`
    INSERT INTO users (id, email, password_hash, role) VALUES
      ('22222222-0000-0000-0000-000000000001', 'operator_a@gridwatch.test',  $1, 'operator'),
      ('22222222-0000-0000-0000-000000000002', 'operator_b@gridwatch.test',  $1, 'operator'),
      ('22222222-0000-0000-0000-000000000003', 'supervisor@gridwatch.test',  $1, 'supervisor')
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, [hash]);

  // Zone A for operator_a; Zones B+C for operator_b
  await pool.query(`
    INSERT INTO user_zones (user_id, zone_id) VALUES
      ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
      ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002'),
      ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003')
    ON CONFLICT DO NOTHING
  `);
  console.log('  Users: 3 (operator_a, operator_b, supervisor)');
}
