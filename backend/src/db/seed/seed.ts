import 'dotenv/config';
import { pool } from '../pool';
import { redis, redisSub, redisQueue } from '../redis';
import { seedZones } from './zones';
import { seedUsers } from './users';
import { seedSensors } from './sensors';
import { seedSensorConfigs } from './sensor_configs';
import { seedReadings } from './readings';
import { seedDemoScenarios } from './scenarios';

async function main() {
  console.log('Starting full seed...');
  const t0 = Date.now();

  process.stdout.write('Seeding zones... ');
  await seedZones(pool);

  process.stdout.write('Seeding users... ');
  await seedUsers(pool);

  process.stdout.write('Seeding sensors... ');
  const sensors = await seedSensors(pool);

  process.stdout.write('Seeding sensor configs... ');
  await seedSensorConfigs(pool, sensors);

  process.stdout.write('Seeding readings (COPY, ~600K rows)... ');
  await seedReadings(pool, sensors);

  process.stdout.write('Seeding demo scenarios... ');
  await seedDemoScenarios(pool, sensors);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSeed complete in ${elapsed}s.`);

  await pool.end();
  redis.disconnect();
  redisSub.disconnect();
  redisQueue.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
