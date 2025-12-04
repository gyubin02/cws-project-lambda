/**
 * Lambda 엔트리포인트: GET /api/v1/healthz, /api/v1/health/geocode
 * IMPLEMENTATION STATUS: OK (route dispatch + controller 연결)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { geocodeHealthController, healthCheckController } from '../controllers/health.controller';
import { logger } from '../lib/logger';
import { isOptions, toErrorResponse, toLambdaResponse, withCors } from './http';

function detectRoute(event: APIGatewayProxyEventV2): 'health' | 'geocode' | undefined {
  const path = (event.rawPath || event.requestContext?.http?.path || '').toLowerCase();
  const routeKey = (event.routeKey || '').toLowerCase();
  const target = routeKey || path;

  if (target.includes('geocode')) return 'geocode';
  if (target.includes('health')) return 'health';
  return undefined;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  const route = detectRoute(event);
  if (!route) {
    return toErrorResponse(404, { error: 'not_found', message: 'Unsupported health route' });
  }

  try {
    if (route === 'geocode') {
      const result = await geocodeHealthController(event.queryStringParameters?.['addr']);
      return toLambdaResponse(result);
    }

    const result = await healthCheckController(event.headers?.['x-request-id'] ?? event.headers?.['X-Request-Id']);
    return toLambdaResponse(result);
  } catch (error) {
    logger.error({ err: error, event }, 'Error in health Lambda');
    return toErrorResponse();
  }
}
