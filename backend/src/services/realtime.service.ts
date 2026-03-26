import { EventEmitter } from 'events';
import { redis, redisSub } from '../db/redis';
import { pool } from '../db/pool';
import { logger } from '../lib/logger';

// In-process event bus: zone_id → SSE clients
const eventBus = new EventEmitter();
eventBus.setMaxListeners(1000);

// One shared Redis PSUBSCRIBE for all zones
redisSub.psubscribe('events:zone:*', (err) => {
  if (err) logger.error({ err }, 'Redis PSUBSCRIBE error');
});

redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
  const zoneId = channel.replace('events:zone:', '');
  eventBus.emit(`zone:${zoneId}`, message);
});

export async function publishEvent(zoneId: string, event: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify(event);
  try {
    await redis.publish(`events:zone:${zoneId}`, payload);
  } catch {
    // Fallback: emit directly on local EventEmitter
    eventBus.emit(`zone:${zoneId}`, payload);
  }
}

export function subscribeClient(
  zoneIds: string[] | null,
  onMessage: (data: string) => void
): () => void {
  const listeners: Array<[string, (msg: string) => void]> = [];

  const addListener = (zoneId: string) => {
    const key = `zone:${zoneId}`;
    const listener = (msg: string) => onMessage(msg);
    eventBus.on(key, listener);
    listeners.push([key, listener]);
  };

  if (zoneIds === null) {
    // Supervisor: listen to all zones by fetching them from DB
    pool.query('SELECT id FROM zones').then(({ rows }) =>
      rows.forEach((r: { id: string }) => addListener(r.id))
    ).catch(err => logger.error({ err }, 'Failed to fetch zones for SSE subscription'));
  } else {
    zoneIds.forEach(addListener);
  }

  return () => {
    listeners.forEach(([key, listener]) => eventBus.removeListener(key, listener));
  };
}
