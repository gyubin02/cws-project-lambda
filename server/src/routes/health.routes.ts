/**
 * 헬스체크 라우트
 */

import { Router } from 'express';
import { logger } from '../lib/logger';

const router: Router = Router();

router.get('/', (req, res) => {
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

export default router;
