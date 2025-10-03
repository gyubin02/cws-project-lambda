/**
 * 대기질 라우트
 */

import { Router } from 'express';
import { z } from 'zod';
import { AirService } from '../services/air.service';
import { logger } from '../lib/logger';
import { ValidationError, UpstreamError } from '../lib/errors';
import { parseCoordinates } from '../lib/util';

const router = Router();
const airService = new AirService();

// 요청 스키마 검증
const AirQuerySchema = z.object({
  lat: z.string().transform((val) => parseFloat(val)).optional(),
  lon: z.string().transform((val) => parseFloat(val)).optional(),
  district: z.string().optional(),
}).refine(
  (data) => (data.lat && data.lon) || data.district,
  {
    message: 'Either coordinates (lat, lon) or district must be provided',
  }
);

router.get('/', async (req, res) => {
  const reqId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ reqId, query: req.query }, 'Air quality request received');

    // 쿼리 파라미터 검증
    const parseResult = AirQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      logger.warn({ reqId, errors: parseResult.error.errors }, 'Invalid request parameters');
      return res.status(400).json({
        error: 'Invalid parameters',
        details: parseResult.error.errors,
      });
    }

    const { lat, lon, district } = parseResult.data;
    
    let coordinates;
    if (lat && lon) {
      coordinates = { lat, lon };
    } else {
      // 기본 좌표 (서울 중심)
      coordinates = { lat: 37.5665, lon: 126.9780 };
    }
    
    // 대기질 데이터 조회
    const airData = await airService.getAirQualityData(coordinates, district);
    
    logger.info({ reqId, pm10: airData.pm10, pm25: airData.pm25, grade: airData.grade }, 'Air quality data retrieved successfully');
    
    return res.json(airData);
  } catch (error) {
    logger.error({ 
      reqId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Air quality request failed');

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
