import 'dotenv/config';
import { z } from 'zod';
import { logger } from './logger';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8787),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MOCK: z.preprocess((value) => {
    if (typeof value === 'number') return value ? 1 : 0;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '1' || trimmed.toLowerCase() === 'true') return 1;
      return 0;
    }
    return 1;
  }, z.number().int().min(0).max(1)).default(1),

  REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).default(7000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().min(0).default(2),

  TMAP_API_KEY: z.string().optional(),
  TMAP_BASE_URL: z.string().default('https://apis.openapi.sk.com/tmap'),

  EXPRESSWAY_API_KEY: z.string().optional(),
  EXPRESSWAY_BASE_URL: z.string().default('http://data.ex.co.kr/openapi/trtm'),

  KMA_API_KEY: z.string().optional(),
  KMA_BASE_URL: z.string().default('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0'),

  AIRKOREA_API_KEY: z.string().optional(),
  AIRKOREA_BASE_URL: z.string().default('http://apis.data.go.kr/B552584/ArpltnInforInqireSvc'),

  CACHE_TTL_SEC: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
});

type RawEnv = z.infer<typeof EnvSchema>;

const sanitize = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const rawEnv: RawEnv = EnvSchema.parse(process.env);

export const ENV = {
  ...rawEnv,
  MOCK: rawEnv.MOCK === 1,
  REQUEST_TIMEOUT_MS: Number(rawEnv.REQUEST_TIMEOUT_MS),
  RETRY_MAX_ATTEMPTS: Number(rawEnv.RETRY_MAX_ATTEMPTS),
  TMAP_API_KEY: sanitize(rawEnv.TMAP_API_KEY),
  EXPRESSWAY_API_KEY: sanitize(rawEnv.EXPRESSWAY_API_KEY),
  KMA_API_KEY: sanitize(rawEnv.KMA_API_KEY),
  AIRKOREA_API_KEY: sanitize(rawEnv.AIRKOREA_API_KEY),
  TMAP_BASE_URL: rawEnv.TMAP_BASE_URL.trim(),
  EXPRESSWAY_BASE_URL: rawEnv.EXPRESSWAY_BASE_URL.trim(),
  KMA_BASE_URL: rawEnv.KMA_BASE_URL.trim(),
  AIRKOREA_BASE_URL: rawEnv.AIRKOREA_BASE_URL.trim(),
} as const;

const missingKeys = Object.entries({
  TMAP_API_KEY: ENV.TMAP_API_KEY,
  EXPRESSWAY_API_KEY: ENV.EXPRESSWAY_API_KEY,
  KMA_API_KEY: ENV.KMA_API_KEY,
  AIRKOREA_API_KEY: ENV.AIRKOREA_API_KEY,
}).filter(([, value]) => !value).map(([key]) => key);

if (ENV.MOCK) {
  if (missingKeys.length) {
    logger.warn({ missingKeys }, 'API keys missing (MOCK=1) — live calls may fall back to fixtures.');
  }
} else if (missingKeys.length) {
  const message = `Missing required API keys with MOCK=0: ${missingKeys.join(', ')}`;
  logger.error({ missingKeys }, message);
  throw new Error(message);
}

export const isMock = ENV.MOCK;
