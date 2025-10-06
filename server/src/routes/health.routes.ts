/**
 * 헬스체크 라우트
 */

import express from 'express';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { GEOCODE_LIVE_FAILURE_PREFIX, tmapAdapter } from '../adapters/tmap.adapter';

const router = express.Router();

router.get('/', (req: any, res: any) => {
  const reqId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ reqId }, 'Health check request received');
    
    const healthData = {
      ok: true,
      time: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
    };
    
    logger.info({ reqId, uptime: healthData.uptime }, 'Health check completed');
    
    return res.json(healthData);
  } catch (error) {
    logger.error({ 
      reqId, 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Health check failed');

    return res.status(500).json({
      ok: false,
      time: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

router.get('/geocode', async (req: any, res: any) => {
  const addr = typeof req.query?.addr === 'string' ? req.query.addr.trim() : '';

  if (!addr) {
    return res.status(400).json({ ok: false, error: 'bad_request', message: 'addr query parameter is required' });
  }

  try {
    const coordinates = await tmapAdapter.geocodeLiveOnly(addr);
    return res.json({ ok: true, source: 'geocoded', lat: coordinates.lat, lon: coordinates.lon });
  } catch (error) {
    if (error instanceof UpstreamError) {
      if (typeof error.message === 'string' && error.message.startsWith(GEOCODE_LIVE_FAILURE_PREFIX)) {
        const message = error.message.slice(GEOCODE_LIVE_FAILURE_PREFIX.length).trim() || 'TMAP live geocode failed';
        return res.status(error.status ?? 503).json({ ok: false, error: 'geocode_failed_live_only', message });
      }

      const status = error.status ?? 503;
      const code = error.code ?? 'upstream_error';
      return res.status(status).json({ ok: false, error: code, message: error.message });
    }

    const fallbackMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ ok: false, error: 'internal_error', message: fallbackMessage });
  }
});

export default router;
