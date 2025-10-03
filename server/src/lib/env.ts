import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(8787),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MOCK: z.coerce.number().default(1), // 1=mock, 0=live

  KMA_SERVICE_KEY: z.string().optional(),
  AIRKOREA_SERVICE_KEY: z.string().optional(),
  EXPRESSWAY_API_KEY: z.string().optional(),
  TMAP_API_KEY: z.string().optional(),

  HTTP_TIMEOUT_MS: z.coerce.number().default(4500),
  HTTP_RETRY: z.coerce.number().default(1),
  CACHE_TTL_SEC: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
});

export const ENV = EnvSchema.parse(process.env);
export const isMock = ENV.MOCK === 1;
export const hasAllKeys =
  !!ENV.KMA_SERVICE_KEY &&
  !!ENV.AIRKOREA_SERVICE_KEY &&
  !!ENV.EXPRESSWAY_API_KEY &&
  !!ENV.TMAP_API_KEY;
