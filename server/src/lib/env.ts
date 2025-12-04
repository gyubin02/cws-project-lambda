// server/src/lib/env.ts
export type Env = {
  MOCK: 0 | 1;
  TMAP_API_KEY: string;
  TMAP_CAR_BASE_URL: string;
  TMAP_CAR_PATH: string;
  TMAP_TRANSIT_BASE_URL: string;
  TMAP_TRANSIT_PATH: string;
  KMA_SERVICE_KEY: string;        // normalized (alias of KMA_API_KEY)
  AIRKOREA_SERVICE_KEY: string;   // normalized (alias of AIRKOREA_API_KEY)
  EXPRESSWAY_API_KEY: string;
  ETA_TIE_THRESHOLD_MIN: number;
  DB_ENABLED: 0 | 1;
  DB_CLIENT: 'mysql' | 'postgres';
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_CONNECTION_LIMIT: number;
};

function pick(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) if (c && c.trim().length > 0) return c.trim();
  return '';
}

function pickNumber(value: string | undefined | null, fallback: number): number {
  if (value == null) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickDbClient(value: string | undefined | null): 'mysql' | 'postgres' {
  const trimmed = (value || '').trim().toLowerCase();
  if (trimmed === 'postgres' || trimmed === 'pg' || trimmed === 'postgresql') {
    return 'postgres';
  }
  return 'mysql';
}

export const ENV: Env = {
  MOCK: process.env['MOCK'] === '0' ? 0 : 1,
  TMAP_API_KEY: pick(process.env['TMAP_API_KEY']),
  TMAP_CAR_BASE_URL: pick(process.env['TMAP_CAR_BASE_URL'], 'https://apis.openapi.sk.com/tmap'),
  TMAP_CAR_PATH: pick(process.env['TMAP_CAR_PATH'], '/routes'),
  TMAP_TRANSIT_BASE_URL: pick(process.env['TMAP_TRANSIT_BASE_URL'], 'https://apis.openapi.sk.com/transit'),
  TMAP_TRANSIT_PATH: pick(process.env['TMAP_TRANSIT_PATH'], '/routes'),
  KMA_SERVICE_KEY: pick(process.env['KMA_SERVICE_KEY'], process.env['KMA_API_KEY']),
  AIRKOREA_SERVICE_KEY: pick(process.env['AIRKOREA_SERVICE_KEY'], process.env['AIRKOREA_API_KEY']),
  EXPRESSWAY_API_KEY: pick(process.env['EXPRESSWAY_API_KEY'], process.env['KEC_API_KEY']),
  ETA_TIE_THRESHOLD_MIN: pickNumber(process.env['ETA_TIE_THRESHOLD_MIN'], 3),
  DB_ENABLED: process.env['DB_ENABLED'] === '1' ? 1 : 0,
  DB_CLIENT: pickDbClient(process.env['DB_CLIENT']),
  DB_HOST: pick(process.env['DB_HOST']),
  DB_PORT: pickNumber(process.env['DB_PORT'], 0),
  DB_USER: pick(process.env['DB_USER']),
  DB_PASSWORD: pick(process.env['DB_PASSWORD']),
  DB_NAME: pick(process.env['DB_NAME']),
  DB_CONNECTION_LIMIT: pickNumber(process.env['DB_CONNECTION_LIMIT'], 5),
};
