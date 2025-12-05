/**
 * Lambda 엔트리포인트: GET /api/v1/traffic/city, /traffic/car, /traffic/transit
 * IMPLEMENTATION STATUS: OK (route dispatch + controller 연결)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  getCarTrafficController,
  getTransitTrafficController,
  getCityTrafficController,
} from '../controllers/traffic.controller';
import { logger } from '../lib/logger';
import { isOptions, toErrorResponse, toLambdaResponse, withCors } from './http';

function detectRoute(event: APIGatewayProxyEventV2): 'car' | 'transit' | 'city' | undefined {
  const path = (event.rawPath || event.requestContext?.http?.path || '').toLowerCase();
  const routeKey = (event.routeKey || '').toLowerCase();
  const target = routeKey || path;

  if (target.includes('/traffic/city')) return 'city';
  if (target.includes('/traffic/car')) return 'car';
  if (target.includes('/traffic/transit')) return 'transit';
  return undefined;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  const route = detectRoute(event);
  if (!route) {
    return toErrorResponse(404, { error: 'not_found', message: 'Unsupported traffic route' });
  }

  try {
    let result;
    switch (route) {
      case 'car':
        result = await getCarTrafficController(event.queryStringParameters ?? {});
        break;
      case 'transit':
        result = await getTransitTrafficController(event.queryStringParameters ?? {});
        break;
      case 'city':
      default:
        result = await getCityTrafficController(event.queryStringParameters ?? {});
        break;
    }

    return toLambdaResponse(result);
  } catch (error) {
    logger.error({ err: error, event }, 'Error in traffic city Lambda');
    return toErrorResponse();
  }
}
