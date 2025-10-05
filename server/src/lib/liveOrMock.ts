import { ENV } from './env';
import { logger } from './logger';

type Fn<T> = () => Promise<T>;

export async function liveOrMock<T>(opts: {
  hasKeys: boolean;
  live: Fn<T>;
  mock: Fn<T>;
  adapter: string;
}): Promise<T> {
  const { hasKeys, live, mock, adapter } = opts;

  const tryLive = async (): Promise<T> => {
    const start = Date.now();
    const result = await live();
    logger.info(`[${adapter}] live OK in ${Date.now() - start}ms`);
    return result;
  };

  if (ENV.MOCK) {
    if (hasKeys) {
      try {
        return await tryLive();
      } catch (error: any) {
        const status = error?.response?.status;
        const reason = status
          ? `${status} ${error?.response?.statusText ?? ''}`.trim()
          : (error?.message ?? String(error));
        logger.warn(`[${adapter}] live failed (MOCK=1) → fixture fallback. reason=${reason}`);
        return await mock();
      }
    }
    return await mock();
  }

  try {
    return await tryLive();
  } catch (error: any) {
    const status = error?.response?.status;
    const reason = status
      ? `${status} ${error?.response?.statusText ?? ''}`.trim()
      : (error?.message ?? String(error));
    logger.warn(`[${adapter}] live failed (MOCK=0) → fixture fallback. reason=${reason}`);
    return await mock();
  }
}
