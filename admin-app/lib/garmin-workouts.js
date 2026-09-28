const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { earliestTime, normalizeTimeInput } = require('./blog-date');
const { formatWorkoutSummary } = require('./fitbit-workout-format');

const execute = promisify(execFile);
const GARMIN_SCRIPT = path.resolve(__dirname, '../scripts/garmin.sh');

async function fetchGarminWorkouts(dateStr) {
  let stdout;
  try {
    ({ stdout } = await execute('sh', [GARMIN_SCRIPT, 'import-data', '--date', dateStr], {
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    }));
  } catch (error) {
    const detail = error.killed ? 'request timed out' : String(error.stderr || '').trim();
    throw new Error(`Garmin import failed: ${detail || 'Python runtime or authentication unavailable. Run garmin.sh login.'}`);
  }
  const payload = JSON.parse(stdout);
  if (!payload || !Array.isArray(payload.activities)) throw new Error('Invalid Garmin activity payload.');
  payload.activities = payload.activities.filter((activity) => {
    if (!activity || !Number.isFinite(activity.durationMs)) throw new Error('Invalid Garmin duration.');
    return activity.durationMs >= 30000;
  });
  return payload;
}

function garminStartTime(activity, dateStr, offsetMinutes) {
  const raw = String(activity.startTimeGMT || '');
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) return null;
  const normalized = raw.replace(' ', 'T');
  if (!normalizeTimeInput(normalized.slice(11, 19))) return null;
  const timestamp = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(timestamp)) return null;
  const shifted = new Date(timestamp + offsetMinutes * 60000).toISOString();
  if (shifted.slice(0, 10) !== dateStr) throw new Error('Garmin activity falls outside the requested date in the blog timezone.');
  return shifted.slice(11, 19);
}

function recordedKmSplits(laps) {
  if (!Array.isArray(laps) || !laps.length) return [];
  let cumulativeMeters = 0;
  const splits = [];
  for (let i = 0; i < laps.length; i++) {
    const { meters, seconds } = laps[i];
    if (!Number.isFinite(meters) || meters <= 0 || !Number.isFinite(seconds) || seconds <= 0) return [];
    const oneKm = Math.abs(meters - 1000) <= 5;
    const partial = i === laps.length - 1 && meters < 995;
    if (!oneKm && !partial) return [];
    cumulativeMeters += meters;
    splits.push({ distanceKm: cumulativeMeters / 1000, seconds, ...(partial ? { isPartial: true } : {}) });
  }
  return splits;
}

function renderGarminMarkdown(dateStr, payload, { offsetMinutes, formatSplitLines, warn = console.warn }) {
  const { activities } = payload;
  if (!activities.length) return { empty: true, content: '', startTime: null };
  const startTime = earliestTime(activities.map((activity) => garminStartTime(activity, dateStr, offsetMinutes)));
  if (!startTime) return { empty: false, content: '', startTime: null };
  const lines = [];
  for (const activity of activities) {
    lines.push(formatWorkoutSummary(activity.durationMs, activity.distanceKm));
    const splits = recordedKmSplits(activity.laps);
    if (splits.length) lines.push('', ...formatSplitLines(splits));
    else if (activity.laps?.length) warn(`Garmin ${activity.id}: non-1km laps; omitting kilometre splits.`);
    if (activity.lapsUnavailable) warn(`Garmin ${activity.id}: lap detail unavailable; summary only.`);
    lines.push('');
  }
  return { empty: false, content: lines.join('\n'), startTime };
}

module.exports = { fetchGarminWorkouts, garminStartTime, recordedKmSplits, renderGarminMarkdown };
