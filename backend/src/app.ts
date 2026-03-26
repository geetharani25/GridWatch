import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { config } from './config';
import authRouter        from './routes/auth';
import ingestRouter      from './routes/ingest';
import alertsRouter      from './routes/alerts';
import sensorsRouter     from './routes/sensors';
import suppressionsRouter from './routes/suppressions';
import eventsRouter      from './routes/events';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(requestId);
  app.use(express.json({ limit: '5mb' }));
  app.use(pinoHttp());
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/auth',         authRouter);
  app.use('/ingest',       ingestRouter);
  app.use('/alerts',       alertsRouter);
  app.use('/sensors',      sensorsRouter);
  app.use('/suppressions', suppressionsRouter);
  app.use('/events',       eventsRouter);
  app.use(errorHandler);
  return app;
}
