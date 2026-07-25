const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDistanceKm,
  formatWorkoutSummary,
} = require('../lib/fitbit-workout-format');

test('formats a workout summary with duration and total distance', () => {
  assert.equal(formatWorkoutSummary(1869449, 6.01029), '31分ジョグ(6.01km)');
  assert.equal(formatWorkoutSummary(1882209, 6.23886), '31分ジョグ(6.24km)');
});

test('omits unavailable or invalid total distance', () => {
  assert.equal(formatWorkoutSummary(1901735, undefined), '32分ジョグ');
  assert.equal(formatWorkoutSummary(1901735, 0), '32分ジョグ');
  assert.equal(formatDistanceKm(Number.NaN), null);
});
