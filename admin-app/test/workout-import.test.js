const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// Test expectations are independent of the operator's local .env preferences.
process.env.FITBIT_IMPORT_DRY_RUN = 'false';
process.env.FITBIT_IMPORT_TZ_OFFSET = '540';
process.env.FITBIT_MAX_CONSECUTIVE_EMPTY_DAYS = '5';
const { selectWorkoutSource, parseFitbitPayload } = require('../lib/workout-import');
const { recordedKmSplits, garminStartTime, renderGarminMarkdown } = require('../lib/garmin-workouts');
const { main, parseCliArgs, formatSplitLines, renderActivityMarkdown } = require('../scripts/import-workouts');

function garminRun(day = '2026-09-28') {
  return { activities: [{
    id: '24524186897', startTimeGMT: `${day} 02:43:36`,
    durationMs: 1883517, distanceKm: 7.19728,
    laps: [304.458, 271.919, 256.115, 252.601, 251.142, 251.469, 250.638, 45.175]
      .map((seconds, i) => ({ meters: i < 7 ? 1000 : 197.28, seconds })),
  }] };
}

const expectedBody = '31分ジョグ(7.20km)\n\n5\'04"→4\'32"→4\'16"→4\'13"→4\'11"\n→4\'11"→4\'11"→0\'45"(7.2km)\n';

test('Garmin runs suppress Fitbit for that date', async () => {
  let fitbitCalls = 0;
  const result = await selectWorkoutSource({
    fetchGarmin: async () => garminRun(),
    fetchFitbit: async () => { fitbitCalls++; throw new Error('must not call'); },
  });
  assert.equal(result.source, 'garmin');
  assert.equal(fitbitCalls, 0);
});

test('successful empty Garmin day falls back to Fitbit; overrides call only their provider', async () => {
  let garminCalls = 0;
  let fitbitCalls = 0;
  const providers = {
    fetchGarmin: async () => { garminCalls++; return { activities: [] }; },
    fetchFitbit: async () => { fitbitCalls++; return { empty: true }; },
  };
  assert.equal((await selectWorkoutSource(providers)).source, 'fitbit');
  assert.equal((await selectWorkoutSource({ ...providers, source: 'garmin' })).source, 'garmin');
  assert.equal((await selectWorkoutSource({ ...providers, source: 'fitbit' })).source, 'fitbit');
  assert.deepEqual([garminCalls, fitbitCalls], [2, 2]);
});

test('Garmin failures are never treated as empty data', async () => {
  let fitbitCalled = false;
  await assert.rejects(selectWorkoutSource({
    fetchGarmin: async () => { throw new Error('authentication failed'); },
    fetchFitbit: async () => { fitbitCalled = true; },
  }), /authentication failed/);
  assert.equal(fitbitCalled, false);
});

test('Garmin retains existing workout and split format and earliest start time', () => {
  const result = renderGarminMarkdown('2026-09-28', garminRun(), { offsetMinutes: 540, formatSplitLines });
  assert.equal(result.content, expectedBody);
  assert.equal(result.startTime, '11:43:36');
  const runs = garminRun();
  runs.activities.push({ ...runs.activities[0], startTimeGMT: '2026-09-28 00:00:00' });
  assert.equal(renderGarminMarkdown('2026-09-28', runs, { offsetMinutes: 540, formatSplitLines }).startTime, '09:00:00');
});

test('non-1km or invalid Garmin laps do not generate guessed splits', () => {
  assert.deepEqual(recordedKmSplits([{ meters: 7197.28, seconds: 1883.517 }]), []);
  assert.deepEqual(recordedKmSplits([{ meters: 400, seconds: 90 }, { meters: 600, seconds: 150 }]), []);
  assert.deepEqual(recordedKmSplits([{ meters: 1000, seconds: NaN }]), []);
  assert.deepEqual(recordedKmSplits([]), []);
  const runs = garminRun();
  runs.activities[0].laps = [];
  assert.equal(renderGarminMarkdown('2026-09-28', runs, { offsetMinutes: 540, formatSplitLines }).content, '31分ジョグ(7.20km)\n');
});

test('Garmin UTC start crosses the JST date boundary correctly', () => {
  assert.equal(garminStartTime({ startTimeGMT: '2026-09-27 16:30:45' }, '2026-09-28', 540), '01:30:45');
  assert.throws(() => garminStartTime({ startTimeGMT: '2026-09-28 16:30:45' }, '2026-09-28', 540), /outside/);
  assert.equal(garminStartTime({}, '2026-09-28', 540), null);
});

test('64bit Fitbit IDs remain exact and split rounding carries into minutes', () => {
  const data = parseFitbitPayload('{"activities":[{"logId":5726486651353448760,"duration":1883516}]}');
  assert.equal(data.activities[0].logId, '5726486651353448760');
  assert.equal(data.activities[0].duration, 1883516);
  assert.deepEqual(formatSplitLines([{ seconds: 299.9 }]), ['5\'00"']);
});

test('date and range CLI is inclusive, deduplicates dates, and defaults to today in JST', () => {
  const result = parseCliArgs(['--date', '2026-09-28', '--from', '2026-09-27', '--to', '2026-09-29', '--source=auto', '--dry-run']);
  assert.deepEqual(result.dates, ['2026-09-28', '2026-09-27', '2026-09-29']);
  assert.equal(result.dryRun, true);
  assert.deepEqual(parseCliArgs(['--from=2026-09-29', '--to=2026-09-27']).dates, ['2026-09-29', '2026-09-28', '2026-09-27']);
  const now = Date.parse('2026-09-27T16:00:00Z');
  assert.deepEqual(parseCliArgs([], now).dates, ['2026-09-28']);
  assert.deepEqual(parseCliArgs(['--days', '2'], now).dates, ['2026-09-28', '2026-09-27']);
  for (const args of [['--from', '2026-09-28'], ['--date', '2026-02-30'], ['--days', '1abc'], ['--source', 'invalid'], ['--date']]) {
    assert.throws(() => parseCliArgs(args));
  }
});

function tempBlog(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'workout-import-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}

test('mixed range writes one existing-format article per day and repeated imports skip API calls', async (t) => {
  const blogDir = tempBlog(t);
  const calls = [];
  const providers = {
    blogDir,
    fetchGarmin: async (day) => { calls.push(`garmin:${day}`); return day === '2026-09-28' ? garminRun(day) : { activities: [] }; },
    fetchFitbit: async (day) => { calls.push(`fitbit:${day}`); return { empty: false, startTime: '05:54:44', content: '32分ジョグ(6.27km)\n', entrySeed: 123 }; },
  };
  const args = ['--from', '2026-09-27', '--to', '2026-09-28'];
  await main(args, providers);
  assert.deepEqual(calls, ['garmin:2026-09-27', 'fitbit:2026-09-27', 'garmin:2026-09-28']);
  const content = fs.readFileSync(path.join(blogDir, '2026-09-28-fitbit-workout.md'), 'utf8');
  assert.match(content, /date: "2026-09-28T11:43:36\+09:00"/);
  assert.match(content, /title: "練習"/);
  assert.match(content, /allowComments: false/);
  assert.ok(content.endsWith(expectedBody));
  await main(args, providers);
  assert.equal(calls.length, 3);
  assert.equal(fs.readdirSync(blogDir).length, 2);
});

test('existing numbered legacy posts are preserved and skipped before either API', async (t) => {
  const blogDir = tempBlog(t);
  fs.writeFileSync(path.join(blogDir, '2026-09-28-fitbit-workout-2.md'), 'edited post');
  const unexpected = async () => { throw new Error('must not fetch'); };
  await main(['--date', '2026-09-28'], { blogDir, fetchGarmin: unexpected, fetchFitbit: unexpected });
  assert.equal(fs.readFileSync(path.join(blogDir, '2026-09-28-fitbit-workout-2.md'), 'utf8'), 'edited post');
  assert.equal(fs.readdirSync(blogDir).length, 1);
});

test('dry-run creates no article; provider error stops a range before later dates', async (t) => {
  const blogDir = tempBlog(t);
  await main(['--date', '2026-09-28', '--dry-run'], { blogDir, fetchGarmin: async () => garminRun() });
  assert.equal(fs.readdirSync(blogDir).length, 0);
  const calls = [];
  await assert.rejects(main(['--from', '2026-09-28', '--to', '2026-09-29'], {
    blogDir,
    fetchGarmin: async (day) => { calls.push(day); throw new Error('rate limit'); },
    fetchFitbit: async () => { throw new Error('must not fallback'); },
  }), /rate limit/);
  assert.deepEqual(calls, ['2026-09-28']);
  assert.equal(fs.readdirSync(blogDir).length, 0);
});

test('empty-day guard counts across the selected sources and returns failure', async (t) => {
  const blogDir = tempBlog(t);
  await assert.rejects(main(['--from', '2026-09-20', '--to', '2026-09-25'], {
    blogDir,
    fetchGarmin: async () => ({ activities: [] }),
    fetchFitbit: async () => ({ empty: true }),
  }), /5 consecutive days/);
  assert.equal(fs.readdirSync(blogDir).length, 0);
});

test('Fitbit mirrored summary TCX does not create uniform fake splits and uses exact log ID', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    if (url.endsWith('/1/activities.json')) return new Response('{"categories":[]}', { status: 200 });
    if (url.includes('.tcx')) return new Response('<Lap><TotalTimeSeconds>1883.516</TotalTimeSeconds><DistanceMeters>7197.28</DistanceMeters><Track><Trackpoint><Time>2026-09-28T02:43:36Z</Time></Trackpoint></Track></Lap>', { status: 200 });
    if (url.includes('/activities/distance/')) return new Response('{"activities-distance-intraday":{"dataset":[]}}', { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const payload = parseFitbitPayload('{"activities":[{"logId":5726486651353448760,"activityParentName":"Run","duration":1883516,"distance":7.19728,"startTime":"11:43"}]}');
  const result = await renderActivityMarkdown('2026-09-28', payload, { access_token: 'test-only' });
  assert.equal(result.content, '31分ジョグ(7.20km)\n');
  assert.ok(urls.some((url) => url.includes('/5726486651353448760.tcx')));
  assert.ok(!urls.some((url) => url.includes('/5726486651353448000')));
});

test('Fitbit detail rate limit rejects import rather than emitting a summary-only success', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response('{}', { status: 429 });
  await assert.rejects(renderActivityMarkdown('2026-09-28', {
    activities: [{ logId: '123', activityParentName: 'Run', duration: 60000, startTime: '11:43' }],
  }, { access_token: 'test-only' }), /429/);
});
