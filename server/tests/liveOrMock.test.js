require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const { liveOrMock } = require('../dist/lib/liveOrMock');
const { ENV } = require('../dist/lib/env');

test('liveOrMock falls back to mock when live throws (MOCK=1)', async () => {
  const result = await liveOrMock({
    adapter: 'TEST',
    hasKeys: true,
    live: async () => {
      throw new Error('boom');
    },
    mock: async () => 42,
  });
  assert.equal(result, 42);
});

test('liveOrMock falls back under MOCK=0 when live fails', async () => {
  const original = ENV.MOCK;
  try {
    ENV.MOCK = false;
    const result = await liveOrMock({
      adapter: 'TEST',
      hasKeys: true,
      live: async () => {
        throw new Error('fail');
      },
      mock: async () => 'fixture',
    });
    assert.equal(result, 'fixture');
  } finally {
    ENV.MOCK = original;
  }
});
