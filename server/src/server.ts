/**
 * 서버 시작점
 */

import 'dotenv/config';
import app from './app';
import { logger } from './lib/logger';
import { ENV } from './lib/env';
import { liveOrMock, AdapterName } from './lib/liveOrMock';

const PORT = Number(process.env['PORT'] ?? 8787);
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const shouldStart = !process.env['JEST_WORKER_ID'];

type AdapterConfig = {
  adapter: AdapterName;
  envVars: string[];
  hasKey: boolean;
};

const adapters: AdapterConfig[] = [
  { adapter: 'tmap', envVars: ['TMAP_API_KEY'], hasKey: !!ENV.TMAP_API_KEY },
  { adapter: 'kma', envVars: ['KMA_SERVICE_KEY', 'KMA_API_KEY'], hasKey: !!ENV.KMA_SERVICE_KEY },
  {
    adapter: 'airkorea',
    envVars: ['AIRKOREA_SERVICE_KEY', 'AIRKOREA_API_KEY'],
    hasKey: !!ENV.AIRKOREA_SERVICE_KEY,
  },
  { adapter: 'expressway', envVars: ['EXPRESSWAY_API_KEY', 'KEC_API_KEY'], hasKey: !!ENV.EXPRESSWAY_API_KEY },
];

if (shouldStart) {
  logger.info({ mock: ENV.MOCK }, `Booting server with MOCK=${ENV.MOCK}`);

  adapters.forEach(({ adapter, envVars, hasKey }) => {
    const mode = liveOrMock(adapter);
    const label = adapter.toUpperCase();

    if (!hasKey) {
      logger.warn({ adapter, envVars, mode }, `${label} adapter missing API key(s); using mock mode.`);
      return;
    }

    if (mode === 'mock') {
      logger.info({ adapter, mode }, `${label} adapter forced to mock (MOCK=${ENV.MOCK}).`);
    } else {
      logger.info({ adapter, mode }, `${label} adapter running live.`);
    }
  });
}

let server: ReturnType<typeof app.listen> | undefined;

if (shouldStart) {
  server = app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid,
      },
      'Server started successfully'
    );
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
