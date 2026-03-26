import { Pool } from 'pg';

export const ZONE_IDS = {
  northeast: '11111111-0000-0000-0000-000000000001',
  southern:  '11111111-0000-0000-0000-000000000002',
  western:   '11111111-0000-0000-0000-000000000003',
};

export async function seedZones(pool: Pool): Promise<void> {
  await pool.query(`
    INSERT INTO zones (id, name, description) VALUES
      ('11111111-0000-0000-0000-000000000001', 'Northeast Grid',       'Northeastern distribution zone'),
      ('11111111-0000-0000-0000-000000000002', 'Southern Distribution','Southern substation zone'),
      ('11111111-0000-0000-0000-000000000003', 'Western Substation',   'Western grid zone')
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('  Zones: 3');
}
