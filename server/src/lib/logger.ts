/**
 * Pino 로거 설정
 */

import pino from 'pino';
import { Request, Response } from 'express';

const isDevelopment = process.env['NODE_ENV'] === 'development';

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export const requestLogger = (req: Request, res: Response, next: () => void) => {
  const start = Date.now();
  const reqId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = reqId;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      reqId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    }, 'Request completed');
  });
  
  next();
};

export const logUpstreamCall = (
  reqId: string,
  upstream: string,
  url: string,
  status: number,
  duration: number,
  cacheHit: boolean = false
) => {
  logger.info({
    reqId,
    upstream,
    url,
    status,
    duration,
    cacheHit,
  }, 'Upstream API call');
};

export const logError = (reqId: string, error: Error, context?: Record<string, unknown>) => {
  logger.error({
    reqId,
    error: error.message,
    stack: error.stack,
    ...context,
  }, 'Error occurred');
};
