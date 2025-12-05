/**
 * Lambda 엔트리포인트: GET /api/v1/traffic/expressway, /traffic/route-tollgates
 * IMPLEMENTATION STATUS: OK (route dispatch + controller 연결)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  getExpresswayTrafficController,
  getRouteTollgatesController,
} from '../controllers/traffic.controller';
import { logger } from '../lib/logger';
import { isOptions, toErrorResponse, toLambdaResponse, withCors } from './http';

function detectRoute(event: APIGatewayProxyEventV2): 'expressway' | 'route-tollgates' | undefined {
  const path = (event.rawPath || event.requestContext?.http?.path || '').toLowerCase();
  const routeKey = (event.routeKey || '').toLowerCase();
  const target = routeKey || path;

  if (target.includes('route-tollgates')) return 'route-tollgates';
  if (target.includes('expressway')) return 'expressway';
  return undefined;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  const route = detectRoute(event);
  if (!route) {
    return toErrorResponse(404, { error: 'not_found', message: 'Unsupported expressway route' });
  }

  try {
    const qs = event.queryStringParameters ?? {};
    const result =
      route === 'route-tollgates'
        ? await getRouteTollgatesController(qs)
        : await getExpresswayTrafficController(qs);

    return toLambdaResponse(result);
  } catch (error) {
    logger.error({ err: error, event }, 'Error in traffic expressway Lambda');
    return toErrorResponse();
  }
}
