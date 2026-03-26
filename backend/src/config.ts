import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL:    z.string().url(),
  JWT_SECRET:   z.string().min(32),
  PORT:         z.coerce.number().default(3000),
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN:  z.string().default('http://localhost'),
});

export const config = schema.parse(process.env);
