export type SourceStatus =
  | 'ok'
  | 'missing_api_key'
  | 'upstream_error'
  | 'timeout'
  | 'bad_response'
  | 'mock'
  | 'degraded'
  | 'error';

export class UpstreamError extends Error {
  code: SourceStatus;
  status?: number;
  constructor(msg: string, code: SourceStatus = 'upstream_error', status?: number) {
    super(msg); 
    this.code = code; 
    if (status !== undefined) {
      this.status = status;
    }
  }
}
