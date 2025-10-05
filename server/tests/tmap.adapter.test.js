require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { TmapAdapter } = require('../dist/adapters/tmap.adapter');

const adapter = new TmapAdapter();
const SKIP = process.env['SKIP_TMAP_TESTS'] === '1';
const ORIGIN = { lat: 37.5, lon: 126.9 };
const DEST = { lat: 37.4, lon: 127.0 };

test('TMAP car fixture parses into TrafficBrief', { skip: SKIP }, async () => {
  try {
    const brief = await adapter.routeCar(ORIGIN, DEST);
    assert.equal(brief.mode, 'car');
    assert.equal(brief.source, 'tmap');
    assert.equal(brief.eta_minutes, 47);
    assert.ok(Math.abs((brief.distance_km ?? 0) - 21.3) < 0.2);
    assert.equal(brief.steps?.length, 3);
    assert.equal(brief.congestion_level, 'MID');
    assert.equal(brief.source_status, 'missing_api_key');
    assert.ok(brief.notes?.some((note) => note.includes('fixture')));
  } catch (error) {
    console.error('routeCar failure', error);
    throw error;
  }
});

test('TMAP transit fixture includes fare and transfers', { skip: SKIP }, async () => {
  try {
    const brief = await adapter.routeTransit(ORIGIN, DEST);
    assert.equal(brief.mode, 'transit');
    assert.equal(brief.fare_krw, 1550);
    assert.equal(brief.transfers, 1);
    assert.ok(brief.steps?.some((step) => step.type === 'metro'));
  } catch (error) {
    console.error('routeTransit failure', error);
    throw error;
  }
});

test('TMAP geocode resolves place names', { skip: SKIP }, async () => {
  try {
    const coords = await adapter.geocode('강남역');
    assert.ok(typeof coords.lat === 'number');
    assert.ok(typeof coords.lon === 'number');
  } catch (error) {
    console.error('geocode failure', error);
    throw error;
  }
});
