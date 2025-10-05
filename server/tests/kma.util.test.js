require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { latLonToGrid, selectBaseSlots, mergeUltraAndVillage } = require('../dist/lib/kma.util');

const loadSample = (name) => {
  const file = path.resolve(__dirname, '_samples', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

test('latLonToGrid converts WGS84 to DFS grid', () => {
  const { nx, ny } = latLonToGrid(37.5665, 126.9780);
  assert.equal(nx, 60);
  assert.equal(ny, 127);
});

test('selectBaseSlots picks correct publication slots', () => {
  const when = new Date('2024-05-12T14:32:00+09:00');
  const slots = selectBaseSlots(when);
  assert.equal(slots.ultra_base_time, '1400');
  assert.equal(slots.ultra_base_date, '20240512');
  assert.equal(slots.village_base_time, '1400');
  assert.equal(slots.village_base_date, '20240512');

  const early = new Date('2024-05-12T01:15:00+09:00');
  const rolled = selectBaseSlots(early);
  assert.equal(rolled.village_base_time, '2300');
  assert.equal(rolled.village_base_date, '20240511');
  assert.equal(rolled.usedPreviousVillageSlot, true);
});

test('mergeUltraAndVillage produces merged weather snapshot', () => {
  const ultra = loadSample('kma_ultra.json');
  const village = loadSample('kma_village.json');
  const merged = mergeUltraAndVillage(ultra, village, { now: new Date('2024-05-12T14:32:00+09:00') });

  assert.equal(merged.now.temperature, 22);
  assert.equal(merged.now.humidity, 55);
  assert.equal(merged.pop, 30);
  assert.ok(Array.isArray(merged.hourly));
  assert.equal(merged.hourly.length >= 2, true);
  assert.equal(merged.minTemp, 17);
  assert.equal(merged.maxTemp, 26);
});
