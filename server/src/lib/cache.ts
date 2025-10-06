import NodeCache from 'node-cache';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const CACHE_TTL_SEC = toNumber(process.env['CACHE_TTL_SEC'], 300);

export const cache = new NodeCache({ stdTTL: CACHE_TTL_SEC, useClones: false });

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as T | undefined;
  if (hit) return hit;
  const v = await fn();
  cache.set(key, v);
  return v;
}
