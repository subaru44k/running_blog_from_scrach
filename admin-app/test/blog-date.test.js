const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOffsetDateTime,
  dateTimeParts,
  earliestTime,
  isValidDateInput,
  normalizeTimeInput,
} = require('../lib/blog-date');

test('builds an offset ISO timestamp without shifting the wall-clock time', () => {
  assert.equal(
    buildOffsetDateTime('2026-02-08', '06:32:15', 540),
    '2026-02-08T06:32:15+09:00'
  );
});

test('validates calendar dates and clock times strictly', () => {
  assert.equal(isValidDateInput('2026-02-29'), false);
  assert.equal(isValidDateInput('2024-02-29'), true);
  assert.equal(normalizeTimeInput('23:59'), '23:59:00');
  assert.equal(normalizeTimeInput('24:00'), null);
  assert.equal(buildOffsetDateTime('2026-02-30', '06:00', 540), null);
});

test('selects the earliest valid Fitbit start time', () => {
  assert.equal(earliestTime(['18:10:00', '06:32', 'invalid']), '06:32:00');
  assert.equal(earliestTime(['invalid', '']), null);
});

test('formats stored timestamps as JST independently of the process timezone', () => {
  assert.deepEqual(dateTimeParts('2026-02-07T21:32:15.000Z'), {
    date: '2026-02-08',
    time: '06:32:15',
  });
});
