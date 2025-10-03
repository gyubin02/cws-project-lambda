require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { AirService } = require('../dist/services/air.service');

const service = new AirService();

test('AirService returns grade and advice', async () => {
  const brief = await service.getAirBrief({ lat: 37.5, lon: 126.9 });
  assert.equal(brief.grade, 'good');
  assert.equal(typeof brief.advice, 'string');
});
