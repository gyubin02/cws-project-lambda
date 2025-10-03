/**
 * 교통 라우트
 */

import { Router } from 'express';
import { z } from 'zod';
import { TrafficService } from '../services/traffic.service';
import { logger } from '../lib/logger';
import { ValidationError, UpstreamError } from '../lib/errors';
import { parseCoordinates } from '../lib/util';

const router = Router();
const trafficService = new TrafficService();

// 요청 스키마 검증
const TrafficQuerySchema = z.object({
  from: z.string().regex(/^-?\d+\.\d+,-?\d+\.\d+$/, 'Invalid from coordinates format'),
  to: z.string().regex(/^-?\d+\.\d+,-?\d+\.\d+$/, 'Invalid to coordinates format'),
  time: z.string().datetime().optional(),
});

router.get('/', async (req, res) => {
  const reqId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ reqId, query: req.query }, 'Traffic request received');

    // 쿼리 파라미터 검증
    const parseResult = TrafficQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      logger.warn({ reqId, errors: parseResult.error.errors }, 'Invalid request parameters');
      return res.status(400).json({
        error: 'Invalid parameters',
        details: parseResult.error.errors,
      });
    }

    const { from, to, time } = parseResult.data;
    const fromCoords = parseCoordinates(from);
    const toCoords = parseCoordinates(to);
    const timeDate = time ? new Date(time) : undefined;
    
    // 교통 데이터 조회
    const trafficData = await trafficService.getTrafficData(fromCoords, toCoords, timeDate);
    
    logger.info({ reqId, eta: trafficData.eta, recommend: trafficData.recommend }, 'Traffic data retrieved successfully');
    
    return res.json(trafficData);
  } catch (error) {
    logger.error({ 
      reqId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Traffic request failed');

    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: error.code,
      });
    }

    if (error instanceof UpstreamError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        upstream: error.upstream,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
