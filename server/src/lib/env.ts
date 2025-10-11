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
};
