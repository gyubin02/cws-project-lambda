/**
 * Lambda 엔트리포인트: GET /api/v1/briefing
 * IMPLEMENTATION STATUS: OK (controller 연결 + CORS 응답)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getBriefingController } from '../controllers/briefing.controller';
import { logger } from '../lib/logger';
import { isOptions, toErrorResponse, toLambdaResponse, withCors } from './http';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  try {
    const qs = event.queryStringParameters ?? {};
    const params: { user_id?: string; from?: string; to?: string; time?: string } = {};
    if (qs['user_id']) params.user_id = qs['user_id'];
    if (qs['from']) params.from = qs['from'];
    if (qs['to']) params.to = qs['to'];
    if (qs['time']) params.time = qs['time'];

    const result = await getBriefingController(params);

    return toLambdaResponse(result);
  } catch (error) {
    logger.error({ err: error, event }, 'Error in briefing Lambda');
    return toErrorResponse();
  }
}
