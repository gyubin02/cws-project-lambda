require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ExpresswayAdapter } = require('../dist/adapters/expressway.adapter');

const adapter = new ExpresswayAdapter();

test('Expressway fixture to TrafficBrief with congestion level', async () => {
  const brief = await adapter.routeExpresswayByTollgate('SEOUL', 'PANGYO');
  assert.equal(brief.mode, 'car');
  assert.equal(brief.eta_minutes, 33);
  assert.equal(brief.congestion_level, 'MID');
});
