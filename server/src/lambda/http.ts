/**
 * Lambda 공통 HTTP 헬퍼: CORS 헤더 + 컨트롤러 응답 변환.
 * IMPLEMENTATION STATUS: OK (proxy 통합용), customize headers per Lambda if needed.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ControllerResult } from '../controllers/types';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-ID',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export function withCors(headers?: Record<string, string>): Record<string, string> {
  return { ...defaultHeaders, ...(headers ?? {}) };
}

export function toLambdaResponse(result: ControllerResult): APIGatewayProxyResultV2 {
  return {
    statusCode: result.statusCode,
    headers: withCors(result.headers),
    body: JSON.stringify(result.body),
  };
}

export function toErrorResponse(
  statusCode = 500,
  body: Record<string, unknown> = {
    error: 'internal_error',
    message: 'Unexpected error in Lambda handler',
  }
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: withCors(),
    body: JSON.stringify(body),
  };
}

export function isOptions(event: APIGatewayProxyEventV2): boolean {
  const method =
    event?.requestContext?.http?.method ??
    (event as any)?.httpMethod;
  return method?.toUpperCase?.() === 'OPTIONS';
}

export function parseJsonBody(event: APIGatewayProxyEventV2): any {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
