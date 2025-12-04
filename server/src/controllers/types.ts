/**
 * 공통 컨트롤러 응답 타입 (Express/Lambda 겸용).
 * IMPLEMENTATION STATUS: Pure data container, used across controllers.
 */

export type ControllerResult<T = unknown> = {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
};
