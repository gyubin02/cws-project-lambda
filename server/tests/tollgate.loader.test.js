require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeTollgateDataset } = require('../dist/lib/util');

test('normalizeTollgateDataset supports array root schema', () => {
  const raw = [
    { id: 'T1', name: 'One', lat: 37.0, lon: 127.0 },
    { id: 'T2', name: 'Two', lat: 37.1, lon: 127.1, routeName: 'Express' },
  ];

  const result = normalizeTollgateDataset(raw);
  assert.equal(result.length, 2);
  assert.equal(result[1].routeName, 'Express');
});

test('normalizeTollgateDataset supports object root schema with metadata', () => {
  const raw = {
    tollgates: [
      { id: 'T1', name: 'One', lat: 37.0, lon: 127.0, routeNo: '100' },
      { id: 'T1', name: 'One Duplicate', lat: 37.0, lon: 127.0, routeName: 'Ring Road' },
      { id: 'T3', name: 'Three', lat: 37.2, lon: 127.2 },
    ],
    source: 'test',
  };

  const result = normalizeTollgateDataset(raw);
  assert.equal(result.length, 2);
  const merged = result.find((gate) => gate.id === 'T1');
  assert.ok(merged);
  assert.equal(merged.routeNo, '100');
  assert.equal(merged.routeName, 'Ring Road');
});
