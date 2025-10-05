require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { wgs84ToTM, normalizeAirPayload } = require('../dist/lib/airkorea.util');

const loadSample = (name) => {
  const file = path.resolve(__dirname, '_samples', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

test('wgs84ToTM converts coordinates to TM grid', () => {
  const { tmX, tmY } = wgs84ToTM(37.5665, 126.9780);
  assert.ok(Math.abs(tmX - 198056.367) < 1);
  assert.ok(Math.abs(tmY - 551885.031) < 1);
});

test('normalizeAirPayload extracts PM values and categories', () => {
  const payload = loadSample('airkorea_realtime.json');
  const normalized = normalizeAirPayload(payload);
  assert.equal(normalized.pm10, 22);
  assert.equal(normalized.pm25, 12);
  assert.equal(normalized.pm10Category, 'Moderate');
  assert.equal(normalized.pm25Category, 'Good');
  assert.equal(normalized.aqi, 55);
  assert.equal(normalized.aqiCategory, 'Moderate');
  assert.equal(Array.isArray(normalized.notes), true);
});
