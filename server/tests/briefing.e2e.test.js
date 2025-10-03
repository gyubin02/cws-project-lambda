require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { profileService } = require('../dist/services/profile.service');
const { buildBriefing } = require('../dist/services/briefing.service');
const { parseCoordOrGeocode } = require('../dist/lib/util');
const { tmapAdapter } = require('../dist/adapters/tmap.adapter');

const SAMPLE_PROFILE = {
  user_id: 'tester',
  preferred_mode: 'car',
  tz: 'Asia/Seoul',
  home: { lat: 37.55, lon: 126.98, label: 'Home', district: 'Seoul' },
  work: { lat: 37.40, lon: 127.10, label: 'Office' },
};

test('buildBriefing returns data for stored profile', async () => {
  await profileService.saveProfile(SAMPLE_PROFILE);
  const briefing = await buildBriefing({ userId: SAMPLE_PROFILE.user_id });
  assert.ok(briefing.summary);
  assert.ok(briefing.weather);
  assert.ok(briefing.air);
  assert.ok(briefing.traffic.car);
  assert.ok(briefing.traffic.transit);
  assert.ok(briefing.traffic.expressway);
});

test('buildBriefing works with direct coordinates', async () => {
  const briefing = await buildBriefing({
    from: { lat: 37.50, lon: 126.90 },
    to: { lat: 37.40, lon: 127.10 },
  });
  assert.ok(briefing.traffic.car);
});

test('buildBriefing throws when profile missing', async () => {
  await assert.rejects(() => buildBriefing({ userId: 'missing-user' }), /Profile not found|Origin and destination/);
});

test('buildBriefing resolves place-name inputs via geocode', async () => {
  const from = await parseCoordOrGeocode('강남역', (query) => tmapAdapter.geocode(query));
  const to = await parseCoordOrGeocode('서울역', (query) => tmapAdapter.geocode(query));
  const briefing = await buildBriefing({ from, to });
  assert.ok(briefing.traffic.car);
});
