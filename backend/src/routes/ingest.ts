import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateBatch, bulkInsert, enqueueForProcessing, updateLastSeen } from '../services/ingest.service';
import { logger } from '../lib/logger';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  const raw = req.body;
  if (!Array.isArray(raw) || raw.length > 1000) {
    res.status(400).json({ error: 'Expected array of up to 1000 readings' });
    return;
  }

  const { valid, failed } = validateBatch(raw);
  await bulkInsert(valid); // DURABLE WRITE — await this

  // Respond immediately after durable write
  res.json({ accepted: valid.length, failed });

  // Fire-and-forget AFTER response
  enqueueForProcessing(valid).catch(err => logger.error({ err }, 'Failed to enqueue readings'));
  updateLastSeen(valid).catch(err => logger.error({ err }, 'Failed to update last_seen_at'));
});

export default router;
