require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { WeatherService } = require('../dist/services/weather.service');

const service = new WeatherService();

test('WeatherService returns normalized brief', async () => {
  const brief = await service.getWeatherBrief({ lat: 37.5, lon: 126.9 });
  assert.equal(brief.source, 'kma');
  assert.equal(typeof brief.pop, 'number');
  assert.equal(brief.condition, 'clear');
  assert.ok(Array.isArray(brief.hourly));
});
