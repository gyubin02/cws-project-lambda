require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const { trafficService } = require('../dist/services/traffic.service');
const { ENV } = require('../dist/lib/env');
const { ExpresswayAdapter } = require('../dist/adapters/expressway.adapter');

const FROM = { lat: 37.5517, lon: 126.9723 };
const TO = { lat: 37.2727, lon: 127.4357 };

test('getRouteTollgates returns matched tollgates with mock KEC data', async () => {
  const result = await trafficService.getRouteTollgates({
    from: FROM,
    to: TO,
    bufferMeters: 5000,
    maxTollgates: 5,
  });

  assert.equal(result.ok, true);
  assert.ok(result.route.geometry);
  assert.equal(result.fallback.used, false);
  assert.ok(result.tollgates.length >= 1);
  assert.ok(result.tollgates.some((gate) => gate.kec && gate.kec.source === 'mock'));
});

test('getRouteTollgates marks kec_unavailable when plaza data missing', async () => {
  const originalMock = ENV.MOCK;
  const originalKey = ENV.EXPRESSWAY_API_KEY;
  const originalExpressway = trafficService.expressway;

  ENV.MOCK = 0;
  ENV.EXPRESSWAY_API_KEY = '';
  trafficService.expressway = new ExpresswayAdapter();

  try {
    const result = await trafficService.getRouteTollgates({
      from: FROM,
      to: TO,
      bufferMeters: 5000,
      maxTollgates: 5,
    });

    assert.equal(result.ok, true);
    if (result.tollgates.length) {
      assert.ok(result.tollgates.some((gate) => gate.kec && gate.kec.source === 'kec_unavailable'));
    } else {
      assert.equal(result.fallback.used, true);
      assert.equal(result.fallback.reason, 'no_tollgates_matched');
    }
  } finally {
    ENV.MOCK = originalMock;
    ENV.EXPRESSWAY_API_KEY = originalKey;
    trafficService.expressway = originalExpressway;
  }
});
