// server/src/lib/env.ts
export type Env = {
  MOCK: 0 | 1;
  TMAP_API_KEY: string;
  KMA_SERVICE_KEY: string;        // normalized (alias of KMA_API_KEY)
  AIRKOREA_SERVICE_KEY: string;   // normalized (alias of AIRKOREA_API_KEY)
  EXPRESSWAY_API_KEY: string;
};

function pick(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) if (c && c.trim().length > 0) return c.trim();
  return '';
}

export const ENV: Env = {
  MOCK: process.env['MOCK'] === '0' ? 0 : 1,
  TMAP_API_KEY: pick(process.env['TMAP_API_KEY']),
  KMA_SERVICE_KEY: pick(process.env['KMA_SERVICE_KEY'], process.env['KMA_API_KEY']),
  AIRKOREA_SERVICE_KEY: pick(process.env['AIRKOREA_SERVICE_KEY'], process.env['AIRKOREA_API_KEY']),
  EXPRESSWAY_API_KEY: pick(process.env['EXPRESSWAY_API_KEY'], process.env['KEC_API_KEY']),
};
