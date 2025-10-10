require('./setup');
const test = require('node:test');
const assert = require('node:assert/strict');

const util = require('../dist/lib/util');

const degToRad = (deg) => (deg * Math.PI) / 180;

test('pointToSegmentDistanceMeters computes perpendicular distance in meters', () => {
  const point = { lat: 37.01, lon: 127.01 };
  const start = { lat: 37.01, lon: 127.0 };
  const end = { lat: 37.01, lon: 127.03 };

  const distance = util.pointToSegmentDistanceMeters(point, start, end);
  const expected = Math.abs(point.lat - start.lat) * Math.cos(degToRad(point.lat)) * 111_320;

  assert.ok(distance > 0);
  assert.ok(Math.abs(distance - expected) < 30);
});

test('pointToPolylineDistanceMeters finds nearest segment index', () => {
  const polyline = [
    { lat: 37.0, lon: 127.0 },
    { lat: 37.0, lon: 127.05 },
    { lat: 37.05, lon: 127.05 },
  ];
  const point = { lat: 37.04, lon: 127.02 };

  const { distance, atIndex } = util.pointToPolylineDistanceMeters(point, polyline);
  assert.equal(atIndex, 1);
  assert.ok(distance < 4000);
});

test('sortByRouteProgress orders candidates along the route', () => {
  const line = [
    { lat: 37.0, lon: 127.0 },
    { lat: 37.02, lon: 127.02 },
    { lat: 37.05, lon: 127.05 },
  ];
  const candidates = [
    { lat: 37.049, lon: 127.049 },
    { lat: 37.01, lon: 127.01 },
    { lat: 37.035, lon: 127.035 },
  ];

  const order = util.sortByRouteProgress(line, candidates);
  assert.deepEqual(order, [1, 2, 0]);
});

test('tollgatesAlongRoute filters and orders within buffer', () => {
  const line = [
    { lat: 37.0, lon: 127.0 },
    { lat: 37.05, lon: 127.05 },
    { lat: 37.1, lon: 127.1 },
  ];

  const tollgates = [
    { id: 'A', name: 'Alpha', lat: 37.002, lon: 127.002 },
    { id: 'B', name: 'Beta', lat: 37.051, lon: 127.051 },
    { id: 'C', name: 'Gamma', lat: 37.2, lon: 127.2 },
  ];

  const matched = util.tollgatesAlongRoute(line, tollgates, 5000, 5);
  assert.equal(matched.length, 2);
  assert.equal(matched[0].id, 'A');
  assert.equal(matched[1].id, 'B');
  assert.ok(matched[0].distanceFromRouteMeters < 500);
  assert.ok(matched[1].progressRatio >= matched[0].progressRatio);
});
