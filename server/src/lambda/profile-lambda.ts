/**
 * Lambda 엔트리포인트: GET/POST /api/v1/profile
 * IMPLEMENTATION STATUS: OK (controller 연결 + JSON body 파싱 + CORS 응답)
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createOrUpdateProfile, getProfile } from '../controllers/profile.controller';
import { logger } from '../lib/logger';
import { isOptions, parseJsonBody, toErrorResponse, toLambdaResponse, withCors } from './http';

function method(event: APIGatewayProxyEventV2): string {
  return event?.requestContext?.http?.method ?? (event as any)?.httpMethod ?? '';
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (isOptions(event)) {
    return { statusCode: 200, headers: withCors(), body: '' };
  }

  const httpMethod = method(event).toUpperCase();

  try {
    if (httpMethod === 'GET') {
      const result = await getProfile(event.queryStringParameters ?? {});
      return toLambdaResponse(result);
    }

    if (httpMethod === 'POST') {
      const body = parseJsonBody(event);
      const result = await createOrUpdateProfile(body);
      return toLambdaResponse(result);
    }

    return toErrorResponse(405, { error: 'method_not_allowed' });
  } catch (error) {
    logger.error({ err: error, event }, 'Error in profile Lambda');
    return toErrorResponse();
  }
}
