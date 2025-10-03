/**
 * 날씨 라우트
 */

import { Router } from 'express';
import { z } from 'zod';
import { WeatherService } from '../services/weather.service';
import { logger } from '../lib/logger';
import { UpstreamError } from '../lib/errors';

const router = Router();
const weatherService = new WeatherService();

// 요청 스키마 검증
const WeatherQuerySchema = z.object({
  lat: z.string().transform((val) => parseFloat(val)),
  lon: z.string().transform((val) => parseFloat(val)),
  time: z.string().datetime().optional(),
});

router.get('/', async (req, res) => {
  const reqId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ reqId, query: req.query }, 'Weather request received');

    // 쿼리 파라미터 검증
    const parseResult = WeatherQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      logger.warn({ reqId, errors: parseResult.error.errors }, 'Invalid request parameters');
      return res.status(400).json({
        error: 'Invalid parameters',
        details: parseResult.error.errors,
      });
    }

    const { lat, lon, time } = parseResult.data;
    const coordinates = { lat, lon };
    const timeDate = time ? new Date(time) : undefined;
    
    // 날씨 데이터 조회
    const weatherData = await weatherService.getWeatherData(coordinates, timeDate);
    
    logger.info({ reqId, temp: weatherData.temp, condition: weatherData.condition }, 'Weather data retrieved successfully');
    
    return res.json(weatherData);
  } catch (error) {
    logger.error({ 
      reqId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Weather request failed');

    if (error instanceof UpstreamError) {
      return res.status(error.status || 500).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
