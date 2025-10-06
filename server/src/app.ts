/**
 * Express 앱 설정
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import { logger } from './lib/logger';
import { rateLimiter } from './lib/rateLimit';
import briefingRoutes from './routes/briefing.routes';
import weatherRoutes from './routes/weather.routes';
import airRoutes from './routes/air.routes';
import trafficRoutes from './routes/traffic.routes';
import healthRoutes from './routes/health.routes';
import profileRoutes from './routes/profile.routes';
import settingsRoutes from './routes/settings.routes';

type ExpressRequest = {
  method: string;
  originalUrl?: string;
  url: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  get(name: string): string | undefined;
  requestId?: string;
};

type ExpressResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
};

type ExpressNext = () => void;

const requestLogger = (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
  const start = Date.now();
  const reqId = (req as any).requestId || (req.headers['x-request-id'] as string) || randomUUID();
  if (!(req as any).requestId) {
    (req as any).requestId = reqId;
    res.setHeader('X-Request-ID', reqId);
  }

  res.on('finish', () => {
    logger.info(
      {
        reqId,
        method: req.method,
        url: req.originalUrl ?? req.url,
        status: res.statusCode,
        duration: Date.now() - start,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
      'Request completed'
    );
  });

  next();
};

const app = express();

// 보안 미들웨어
app.use(helmet({
  contentSecurityPolicy: false, // API 서버이므로 CSP 비활성화
  crossOriginEmbedderPolicy: false,
}));

// CORS 설정
const corsOrigins = process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000'];
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
app.use((req: any, res: any, next: any) => {
  const rid = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('X-Request-ID', rid);
  (req as any).requestId = rid;
  next();
});

// 로깅 미들웨어
app.use(requestLogger);
app.use(rateLimiter);

// API 라우트
app.use('/api/v1/briefing', briefingRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/air', airRoutes);
app.use('/api/v1/traffic', trafficRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/healthz', healthRoutes);
app.use('/health', healthRoutes);

// 루트 경로
app.get('/', (_req: any, res: any) => {
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
      settings: '/api/v1/settings',
      health: '/api/v1/healthz',
    },
  });
});

// 404 핸들러
app.use('*', (req: any, res: any) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// 전역 에러 핸들러
app.use((error: any, req: any, res: any, _next: any) => {
  const reqId = (req as any).requestId as string;
  
  logger.error({ 
    reqId, 
    err: error, 
    url: req.url, 
    method: req.method 
  }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env['NODE_ENV'] === 'development' ? String(error?.message || error) : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(reqId && { requestId: reqId }),
  });
});

export default app;
