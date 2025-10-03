require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TmapAdapter } = require('../dist/adapters/tmap.adapter');

const adapter = new TmapAdapter();
const ORIGIN = { lat: 37.5, lon: 126.9 };
const DEST = { lat: 37.4, lon: 127.0 };

test('TMAP car fixture parses into TrafficBrief', async () => {
  const brief = await adapter.routeCar(ORIGIN, DEST);
  assert.equal(brief.mode, 'car');
  assert.equal(brief.source, 'tmap');
  assert.equal(brief.eta_minutes, 47);
  assert.ok(Math.abs((brief.distance_km ?? 0) - 21.3) < 0.2);
  assert.equal(brief.steps?.length, 3);
  assert.equal(brief.congestion_level, 'MID');
});

test('TMAP transit fixture includes fare and transfers', async () => {
  const brief = await adapter.routeTransit(ORIGIN, DEST);
  assert.equal(brief.mode, 'transit');
  assert.equal(brief.fare_krw, 1550);
  assert.equal(brief.transfers, 1);
  assert.ok(brief.steps?.some((step) => step.type === 'metro'));
});

test('TMAP geocode resolves place names', async () => {
  const coords = await adapter.geocode('강남역');
  assert.ok(typeof coords.lat === 'number');
  assert.ok(typeof coords.lon === 'number');
});
