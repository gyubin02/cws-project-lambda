/**
 * Health 컨트롤러: 기본 헬스체크 및 지오코딩 라이브 체크.
 * IMPLEMENTATION STATUS: OK (mirrors existing Express routes)
 */

import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';
import { GEOCODE_LIVE_FAILURE_PREFIX, tmapAdapter } from '../adapters/tmap.adapter';
import { ControllerResult } from './types';

export async function healthCheckController(requestId?: string): Promise<ControllerResult> {
  try {
    logger.info({ reqId: requestId }, 'Health check request received');

    const healthData = {
      ok: true,
      time: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
    };

    logger.info({ reqId: requestId, uptime: healthData.uptime }, 'Health check completed');

    return { statusCode: 200, body: healthData };
  } catch (error) {
    logger.error({
      reqId: requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'Health check failed');

    return {
      statusCode: 500,
      body: {
        ok: false,
        time: new Date().toISOString(),
        error: 'Health check failed',
      },
    };
  }
}

export async function geocodeHealthController(addr?: string): Promise<ControllerResult> {
  const trimmed = typeof addr === 'string' ? addr.trim() : '';

  if (!trimmed) {
    return {
      statusCode: 400,
      body: { ok: false, error: 'bad_request', message: 'addr query parameter is required' },
    };
  }

  try {
    const coordinates = await tmapAdapter.geocodeLiveOnly(trimmed);
    return {
      statusCode: 200,
      body: { ok: true, source: 'geocoded', lat: coordinates.lat, lon: coordinates.lon },
    };
  } catch (error) {
    if (error instanceof UpstreamError) {
      if (typeof error.message === 'string' && error.message.startsWith(GEOCODE_LIVE_FAILURE_PREFIX)) {
        const message = error.message.slice(GEOCODE_LIVE_FAILURE_PREFIX.length).trim() || 'TMAP live geocode failed';
        return { statusCode: error.status ?? 503, body: { ok: false, error: 'geocode_failed_live_only', message } };
      }

      const status = error.status ?? 503;
      const code = error.code ?? 'upstream_error';
      return { statusCode: status, body: { ok: false, error: code, message: error.message } };
    }

    const fallbackMessage = error instanceof Error ? error.message : 'Unknown error';
    return { statusCode: 500, body: { ok: false, error: 'internal_error', message: fallbackMessage } };
  }
}
