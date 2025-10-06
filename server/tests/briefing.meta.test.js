require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const ENV_KEYS = [
  'MOCK',
  'TMAP_API_KEY',
  'KMA_SERVICE_KEY',
  'KMA_API_KEY',
  'AIRKOREA_SERVICE_KEY',
  'AIRKOREA_API_KEY',
  'EXPRESSWAY_API_KEY',
  'REQUEST_TIMEOUT_MS',
  'RETRY_MAX_ATTEMPTS',
];

const originalEnv = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

function setScenarioEnv() {
  process.env['MOCK'] = '0';
  process.env['TMAP_API_KEY'] = 'REAL_TMAP_KEY';
  delete process.env['KMA_SERVICE_KEY'];
  delete process.env['KMA_API_KEY'];
  delete process.env['AIRKOREA_SERVICE_KEY'];
  delete process.env['AIRKOREA_API_KEY'];
  delete process.env['EXPRESSWAY_API_KEY'];
  process.env['REQUEST_TIMEOUT_MS'] = '50';
  process.env['RETRY_MAX_ATTEMPTS'] = '0';
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function loadBriefingHandler() {
  const modules = [
    '../dist/routes/briefing.routes',
    '../dist/lib/liveOrMock',
    '../dist/lib/env',
  ];
  for (const modulePath of modules) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // ignore missing cache entries
    }
  }
  const routerModule = require('../dist/routes/briefing.routes');
  const router = routerModule.default ?? routerModule;
  const layer = router.stack.find((entry) => entry.route?.path === '/' && entry.route.methods.get);
  if (!layer) {
    throw new Error('Unable to locate briefing GET handler');
  }
  return layer.route.stack[0].handle;
}

test('briefing meta reports live/mock sources with only TMAP key', async () => {
  setScenarioEnv();
  const handler = loadBriefingHandler();

  const req = {
    query: {
      from: '37.55,126.98',
      to: '37.40,127.10',
    },
  };
  let statusCode;
  let payload;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
  };

  await handler(req, res);

  assert.ok(payload, 'Response payload missing');
  assert.equal(statusCode ?? 200, 200);
  const sources = payload.meta?.sources;
  assert.ok(sources, 'sources meta missing');
  assert.equal(sources.traffic.car, 'live');
  assert.equal(sources.weather, 'mock');
  assert.equal(sources.air, 'mock');
  assert.equal(sources.traffic.expressway, 'mock');
});

test.after(() => {
  restoreEnv();
  loadBriefingHandler();
});
