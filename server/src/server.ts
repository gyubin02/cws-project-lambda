/**
 * 서버 시작점
 */

import dotenv from 'dotenv';
import app from './app';
import { logger } from './lib/logger';

// 환경변수 로드
dotenv.config();

const PORT = process.env.PORT || 8787;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 필수 환경변수 검증
const requiredEnvVars = [
  'KMA_SERVICE_KEY',
  'AIRKOREA_SERVICE_KEY',
  'EXPRESSWAY_API_KEY',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  if (NODE_ENV === 'production' && process.env.MOCK !== '1') {
    logger.error({ missingEnvVars }, 'Missing required environment variables');
    process.exit(1);
  } else {
    logger.warn({ missingEnvVars }, 'Env vars missing (dev/mock) — continuing startup');
  }
}

// 서버 시작
const server = app.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid,
  }, 'Server started successfully');
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');
  
  server.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // 강제 종료 타임아웃
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

export default server;
