/**
 * Express 앱 설정
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { requestLogger, logger } from './lib/logger';
import briefingRoutes from './routes/briefing.routes';
import weatherRoutes from './routes/weather.routes';
import airRoutes from './routes/air.routes';
import trafficRoutes from './routes/traffic.routes';
import healthRoutes from './routes/health.routes';

const app = express();

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: false, // API 서버이므로 CSP 비활성화
  crossOriginEmbedderPolicy: false,
}));

// CORS 설정
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// 요청 파싱 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID 미들웨어
app.use((req, res, next) => {
  const rid = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('X-Request-ID', rid);
  (req as any).requestId = rid;
  next();
});

// 로깅 미들웨어
app.use(requestLogger);

// API 라우트
app.use('/api/v1/briefing', briefingRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/air', airRoutes);
app.use('/api/v1/traffic', trafficRoutes);
app.use('/api/v1/healthz', healthRoutes);

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    service: 'Outing Briefing API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      briefing: '/api/v1/briefing',
      weather: '/api/v1/weather',
      air: '/api/v1/air',
      traffic: '/api/v1/traffic',
      health: '/api/v1/healthz',
    },
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// 전역 에러 핸들러
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const reqId = (req as any).requestId as string;
  
  logger.error({ 
    reqId, 
    err: error, 
    url: req.url, 
    method: req.method 
  }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? String(error?.message || error) : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(reqId && { requestId: reqId }),
  });
});

export default app;
