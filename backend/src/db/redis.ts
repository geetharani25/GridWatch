import Redis from 'ioredis';
import { config } from '../config';

export const redis    = new Redis(config.REDIS_URL, { lazyConnect: false }); // general purpose
export const redisSub = new Redis(config.REDIS_URL, { lazyConnect: false }); // PSUBSCRIBE only
export const redisQueue = new Redis(config.REDIS_URL, { lazyConnect: false }); // BLPOP only (blocking)
