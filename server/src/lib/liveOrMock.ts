// server/src/lib/liveOrMock.ts
import { ENV } from './env';

export type AdapterName = 'tmap' | 'kma' | 'airkorea' | 'expressway';
export type Mode = 'live' | 'mock';

function hasKey(adapter: AdapterName): boolean {
  switch (adapter) {
    case 'tmap':
      return !!ENV.TMAP_API_KEY;
    case 'kma':
      return !!ENV.KMA_SERVICE_KEY;
    case 'airkorea':
      return !!ENV.AIRKOREA_SERVICE_KEY;
    case 'expressway':
      return !!ENV.EXPRESSWAY_API_KEY;
  }
}

export function liveOrMock(adapter: AdapterName): Mode {
  if (ENV.MOCK === 1) return 'mock';
  return hasKey(adapter) ? 'live' : 'mock';
}
