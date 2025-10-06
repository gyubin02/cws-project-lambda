import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdapterName } from '../liveOrMock';

const ADAPTERS: AdapterName[] = ['tmap', 'kma', 'airkorea', 'expressway'];
const ENV_KEYS = [
  'MOCK',
  'TMAP_API_KEY',
  'KMA_SERVICE_KEY',
  'KMA_API_KEY',
  'AIRKOREA_SERVICE_KEY',
  'AIRKOREA_API_KEY',
  'EXPRESSWAY_API_KEY',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

const applyEnv = (overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>): void => {
  for (const key of ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const next = overrides[key];
      if (next == null) {
        delete process.env[key];
      } else {
        process.env[key] = next;
      }
    } else {
      delete process.env[key];
    }
  }
};

const restoreEnv = (): void => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const reloadHelper = () => {
  const envPath = require.resolve('../env');
  const modePath = require.resolve('../liveOrMock');
  delete require.cache[envPath];
  delete require.cache[modePath];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { liveOrMock } = require('../liveOrMock') as typeof import('../liveOrMock');
  return liveOrMock;
};

test.afterEach(() => {
  restoreEnv();
});

test('MOCK=1 forces all adapters to mock mode', () => {
  applyEnv({
    MOCK: '1',
    TMAP_API_KEY: 'REAL_TMAP',
    KMA_SERVICE_KEY: 'REAL_KMA',
    AIRKOREA_SERVICE_KEY: 'REAL_AIR',
    EXPRESSWAY_API_KEY: 'REAL_EXPRESS',
  });

  const liveOrMock = reloadHelper();
  for (const adapter of ADAPTERS) {
    assert.equal(liveOrMock(adapter), 'mock');
  }
});

test('MOCK=0 with only TMAP key enables live only for TMAP', () => {
  applyEnv({
    MOCK: '0',
    TMAP_API_KEY: 'REAL_TMAP',
  });

  const liveOrMock = reloadHelper();
  assert.equal(liveOrMock('tmap'), 'live');
  assert.equal(liveOrMock('kma'), 'mock');
  assert.equal(liveOrMock('airkorea'), 'mock');
  assert.equal(liveOrMock('expressway'), 'mock');
});

test('MOCK=0 with all keys runs everything live', () => {
  applyEnv({
    MOCK: '0',
    TMAP_API_KEY: 'REAL_TMAP',
    KMA_SERVICE_KEY: 'REAL_KMA',
    AIRKOREA_SERVICE_KEY: 'REAL_AIR',
    EXPRESSWAY_API_KEY: 'REAL_EXPRESS',
  });

  const liveOrMock = reloadHelper();
  for (const adapter of ADAPTERS) {
    assert.equal(liveOrMock(adapter), 'live');
  }
});

test('MOCK=0 with no keys falls back to mock for all adapters', () => {
  applyEnv({
    MOCK: '0',
  });

  const liveOrMock = reloadHelper();
  for (const adapter of ADAPTERS) {
    assert.equal(liveOrMock(adapter), 'mock');
  }
});
