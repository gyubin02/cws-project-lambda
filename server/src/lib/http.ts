import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ENV } from './env';
import { performance } from 'node:perf_hooks';

export const http = axios.create({ timeout: ENV.HTTP_TIMEOUT_MS });

axiosRetry(http, {
  retries: ENV.HTTP_RETRY,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (e) =>
    axiosRetry.isNetworkOrIdempotentRequestError(e) || e.code === 'ECONNABORTED',
});

http.interceptors.request.use((config) => {
  (config as any).__t0 = performance.now();
  return config;
});
http.interceptors.response.use(
  (res) => {
    const t0 = (res.config as any).__t0;
    (res as any).__rtt_ms = t0 ? Math.round(performance.now() - t0) : undefined;
    return res;
  },
  (err) => {
    const t0 = (err.config as any)?.__t0;
    (err as any).__rtt_ms = t0 ? Math.round(performance.now() - t0) : undefined;
    throw err;
  }
);
