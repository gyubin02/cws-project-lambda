import NodeCache from 'node-cache';
import { ENV } from './env';

export const cache = new NodeCache({ stdTTL: ENV.CACHE_TTL_SEC, useClones: false });

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit) return hit;
  const v = await fn();
  cache.set(key, v);
  return v;
}
