/**
 * 서버 시작점
 */

import app from './app';
import { logger } from './lib/logger';
import { ENV } from './lib/env';

const PORT = ENV.PORT;
const NODE_ENV = ENV.NODE_ENV;

// 필수 환경변수 검증
const requiredEnvVars = [
  'TMAP_API_KEY',
  'EXPRESSWAY_API_KEY',
  'KMA_API_KEY',
  'AIRKOREA_API_KEY',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  if (NODE_ENV === 'production' && !ENV.MOCK) {
    logger.error({ missingEnvVars }, 'Missing required environment variables');
    process.exit(1);
  } else {
    logger.warn({ missingEnvVars }, 'Env vars missing (dev/mock) — continuing startup');
  }
}

const shouldStart = !process.env['JEST_WORKER_ID'];

let server: ReturnType<typeof app.listen> | undefined;

if (shouldStart) {
  server = app.listen(PORT, () => {
    logger.info({
      port: PORT,
      environment: NODE_ENV,
      nodeVersion: process.version,
      pid: process.pid,
    }, 'Server started successfully');
  });
}

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');
  
  server?.close(() => {
    logger.info('Server closed successfully');
    process.exit(0);
  });
  
  // 강제 종료 타임아웃
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

if (shouldStart) {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// 처리되지 않은 예외 처리
if (shouldStart) {
  process.on('uncaughtException', (error) => {
    logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });
}

export default server;
