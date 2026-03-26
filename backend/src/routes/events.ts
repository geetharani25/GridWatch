import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { subscribeClient } from '../services/realtime.service';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('data: {"type":"connected"}\n\n');

  const zoneFilter = req.user!.role === 'supervisor' ? null : req.user!.zones;

  const unsubscribe = subscribeClient(
    zoneFilter,
    (data) => { res.write(`data: ${data}\n\n`); }
  );

  const keepalive = setInterval(() => { res.write(':\n\n'); }, 15_000);

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

export default router;
