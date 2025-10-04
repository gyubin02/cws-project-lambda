import { ENV } from './env';

const buckets = new Map<string, { count: number; resetAt: number }>();

function currentBucket(key: string, now: number) {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 0, resetAt: now + ENV.RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
    return bucket;
  }
  return existing;
}

export function rateLimiter(req: any, res: any, next: any) {
  const now = Date.now();
  const key = req.ip || 'global';
  const bucket = currentBucket(key, now);
  bucket.count += 1;

  if (bucket.count > ENV.RATE_LIMIT_MAX) {
    const retryAfter = Math.max(0, bucket.resetAt - now);
    res.setHeader('Retry-After', Math.ceil(retryAfter / 1000));
    return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Try again later.' });
  }

  return next();
}
