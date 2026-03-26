import { createApp } from './app';
import { config } from './config';
import { pool } from './db/pool';
import { redis } from './db/redis';
import { startAnomalyWorker } from './workers/anomalyWorker';
import { startPatternAbsenceWorker } from './workers/patternAbsenceWorker';
import { startEscalationWorker } from './workers/escalationWorker';
import { logger } from './lib/logger';

async function main() {
  await pool.query('SELECT 1'); // verify DB connection
  await redis.ping();          // verify Redis connection

  const app = createApp();
  app.listen(config.PORT, () =>
    logger.info({ port: config.PORT }, 'Backend listening')
  );

  startAnomalyWorker().catch(err => logger.error({ err }, 'Anomaly worker crashed'));
  startPatternAbsenceWorker();
  startEscalationWorker();
}

main().catch(err => { logger.error({ err }, 'Startup failed'); process.exit(1); });
