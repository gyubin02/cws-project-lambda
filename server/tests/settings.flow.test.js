require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { tmapAdapter } = require('../dist/adapters/tmap.adapter');
const { saveUserSettings, getUserSettings } = require('../dist/services/settings.service');

const ORIGIN = 'Gangnam Station';
const DEST = 'Seoul Station';

test('saveUserSettings stores coordinates and respects coordinate lock toggle', async () => {
  const originCoords = await tmapAdapter.geocode(ORIGIN);
  const destCoords = await tmapAdapter.geocode(DEST);

  const saved = await saveUserSettings({}, {
    defaultOrigin: {
      name: ORIGIN,
      lat: originCoords.lat,
      lon: originCoords.lon,
      lastGeocodedAt: new Date().toISOString(),
    },
    defaultDestination: {
      name: DEST,
      lat: destCoords.lat,
      lon: destCoords.lon,
      lastGeocodedAt: new Date().toISOString(),
    },
  });

  assert.equal(saved.coordinateLock, false);
  assert.equal(saved.defaultOrigin.name, ORIGIN);
  assert.equal(saved.defaultDestination.name, DEST);
  assert.equal(saved.defaultOrigin.lat, originCoords.lat);
  assert.equal(saved.defaultDestination.lon, destCoords.lon);

  const withLock = await saveUserSettings({}, { coordinateLock: true });
  assert.equal(withLock.coordinateLock, true);

  const current = await getUserSettings({});
  assert.equal(current?.coordinateLock, true);
  assert.equal(current?.defaultOrigin?.name, ORIGIN);
  assert.equal(current?.defaultDestination?.name, DEST);
});

test('getUserSettings defaults coordinateLock to false when empty', async () => {
  const blank = await getUserSettings({});
  assert.equal(blank?.coordinateLock, false);
});
