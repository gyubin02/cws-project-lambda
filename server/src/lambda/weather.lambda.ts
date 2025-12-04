/**
 * Lambda 엔트리포인트: GET /api/v1/weather
 * IMPLEMENTATION STATUS: OK (controller 연결 + CORS 응답)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getWeatherBriefController } from '../controllers/weather.controller';
import { logger } from '../lib/logger';
import { isOptions, toErrorResponse, toLambdaResponse, withCors } from './http';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  try {
    const qs = event.queryStringParameters ?? {};
    const params: {
      location?: string;
      lat?: string | number;
      lon?: string | number;
      time?: string;
      requestId?: string;
    } = {};

    if (qs['location']) params.location = qs['location'];
    if (qs['lat']) params.lat = qs['lat'] as any;
    if (qs['lon']) params.lon = qs['lon'] as any;
    if (qs['time']) params.time = qs['time'];

    const requestId = event.headers?.['x-request-id'] ?? event.headers?.['X-Request-Id'];
    if (requestId) params.requestId = requestId;

    const result = await getWeatherBriefController(params);

    return toLambdaResponse(result);
  } catch (error) {
    logger.error({ err: error, event }, 'Error in weather Lambda');
    return toErrorResponse();
  }
}
