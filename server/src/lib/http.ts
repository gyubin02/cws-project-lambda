import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const REQUEST_TIMEOUT_MS = toNumber(process.env['REQUEST_TIMEOUT_MS'], 7000);
const RETRY_MAX_ATTEMPTS = toNumber(process.env['RETRY_MAX_ATTEMPTS'], 2);

type RetryableConfig = AxiosRequestConfig & { __retryCount?: number };

export const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
});

http.interceptors.response.use(
  (response: any) => response,
  async (error: AxiosError) => {
    const cfg = error.config as RetryableConfig | undefined;
    if (!cfg) {
      return Promise.reject(error);
    }

    const method = (cfg.method ?? 'get').toLowerCase();
    if (method !== 'get') {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const retriableStatus = !status || status >= 500 || status === 429;
    if (!retriableStatus) {
      return Promise.reject(error);
    }

    const maxAttempts = Math.max(0, RETRY_MAX_ATTEMPTS);
    cfg.__retryCount = cfg.__retryCount ?? 0;

    if (cfg.__retryCount >= maxAttempts) {
      return Promise.reject(error);
    }

    cfg.__retryCount += 1;

    const baseDelayMs = 300;
    const delay = Math.min(baseDelayMs * Math.pow(2, cfg.__retryCount - 1), 1500);
    const jitter = Math.random() * 100;
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));

    return http(cfg);
  }
);

export function joinUrl(base: string, path: string) {
  const trimmedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}
