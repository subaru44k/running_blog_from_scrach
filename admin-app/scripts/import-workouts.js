#!/usr/bin/env node
/**
 * Imports Garmin workouts first, with daily Fitbit fallback, as draft blog posts.
 *
 * Garmin uses locally saved tokens. Fitbit S3 credentials are loaded only on
 * fallback days. Both sources share the existing Markdown format and filename.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { buildOffsetDateTime, earliestTime } = require('../lib/blog-date');
const { saveFitbitTokens } = require('../lib/fitbit-token-store');
const { formatWorkoutSummary } = require('../lib/fitbit-workout-format');
const { fetchGarminWorkouts, renderGarminMarkdown, recordedKmSplits } = require('../lib/garmin-workouts');
const { selectWorkoutSource, findExistingWorkoutPost, parseFitbitPayload } = require('../lib/workout-import');
const { isValidDateInput: validateDate } = require('../lib/blog-date');

const BLOG_DIR = path.resolve(__dirname, '../../astro-blog/src/content/blog');
const ENV_PATH = path.resolve(__dirname, '../.env');

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return;
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const CONFIG = {
  bucket: process.env.TOKEN_S3_BUCKET,
  key: process.env.TOKEN_S3_KEY || 'fitbit/token.json',
  clientId: process.env.FITBIT_CLIENT_ID,
  clientSecret: process.env.FITBIT_CLIENT_SECRET,
  timezoneOffsetMinutes: parseInt(process.env.FITBIT_IMPORT_TZ_OFFSET || '540', 10),
  defaultCategory: process.env.FITBIT_DEFAULT_CATEGORY || '練習(デフォルト)',
  defaultAuthor: process.env.FITBIT_DEFAULT_AUTHOR || 'Subaru',
  status: process.env.FITBIT_DEFAULT_STATUS || 'draft',
  dryRun: /^(1|true)$/i.test(process.env.FITBIT_IMPORT_DRY_RUN || 'false'),
  splitDebug: /^(1|true)$/i.test(process.env.FITBIT_SPLIT_DEBUG || 'false'),
  maxConsecutiveEmptyDays: Math.max(1, parseInt(process.env.FITBIT_MAX_CONSECUTIVE_EMPTY_DAYS || '5', 10) || 5),
  runActivityNames: (process.env.FITBIT_RUN_ACTIVITY_NAMES || 'Structured Workout,Run,Treadmill run,Trail run,Incline run')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  runActivityIds: (process.env.FITBIT_RUN_ACTIVITY_IDS || '91060')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v)),
};

const s3 = new S3Client({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
let cachedRunTypeIds = null;
let fitbitTokens = null;

async function fetchFitbitWorkout(dateStr) {
  if (!CONFIG.bucket || !CONFIG.clientId || !CONFIG.clientSecret) {
    throw new Error('Fitbit fallback requires TOKEN_S3_BUCKET, FITBIT_CLIENT_ID, and FITBIT_CLIENT_SECRET.');
  }
  if (!fitbitTokens) fitbitTokens = await loadTokens();
  fitbitTokens = await ensureAccessToken(fitbitTokens);
  const payload = await fetchActivities(fitbitTokens, dateStr);
  const rendered = await renderActivityMarkdown(dateStr, payload, fitbitTokens);
  return { ...rendered, entrySeed: payload.summary?.steps || '' };
}

function ensureFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Run on Node 18+ or polyfill fetch.');
  }
  return fetch;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logRateLimitHeaders(res) {
  if (!res || !CONFIG.splitDebug) return;
  const limit = res.headers.get('fitbit-rate-limit-limit');
  const remaining = res.headers.get('fitbit-rate-limit-remaining');
  const reset = res.headers.get('fitbit-rate-limit-reset');
  if (limit || remaining || reset) {
    console.log(`Split debug: rate limit headers limit=${limit || '-'} remaining=${remaining || '-'} reset=${reset || '-'}`);
  }
}

function checkFitbitDetailResponse(res) {
  if (res.status === 401 || res.status === 429 || res.status >= 500) {
    throw new Error(`Fitbit detail request failed (${res.status}); stopping import.`);
  }
}

async function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function loadTokens() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: CONFIG.bucket, Key: CONFIG.key }));
    const json = JSON.parse(await streamToString(res.Body));
    return json;
  } catch (err) {
    console.error('Failed to load Fitbit tokens from S3:', err.message || err);
    throw err;
  }
}

async function saveTokens(tokens) {
  const payload = await saveFitbitTokens({
    s3,
    bucket: CONFIG.bucket,
    key: CONFIG.key,
    tokens,
    serverSideEncryption: process.env.TOKEN_S3_SSE,
  });
  if (CONFIG.dryRun) {
    console.log('[dry-run] Persisted refreshed Fitbit tokens to S3');
  }
  return payload;
}

function needsRefresh(tokens) {
  if (!tokens.expires_at) return true;
  const expiry = new Date(tokens.expires_at).getTime();
  if (Number.isNaN(expiry)) return true;
  // Refresh 2 minutes before expiry to be safe
  return Date.now() + 120000 >= expiry;
}

async function refreshAccessToken(tokens) {
  const fetchFn = ensureFetch();
  const basicAuth = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });

  const res = await fetchFn('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh Fitbit token (${res.status}): ${text}`);
  }

  const json = await res.json();
  const now = Date.now();
  const expiresAt = new Date(now + (json.expires_in || 0) * 1000).toISOString();

  const nextTokens = {
    ...tokens,
    access_token: json.access_token,
    refresh_token: json.refresh_token || tokens.refresh_token,
    scope: json.scope || tokens.scope,
    token_type: json.token_type || tokens.token_type,
    expires_at: expiresAt,
    user_id: json.user_id || tokens.user_id,
  };

  await saveTokens(nextTokens);
  return Object.assign(tokens, nextTokens);
}

async function ensureAccessToken(tokens) {
  if (!tokens.access_token) {
    throw new Error('Token payload is missing access_token. Re-run the OAuth flow.');
  }
  if (!needsRefresh(tokens)) return tokens;
  console.log('Refreshing Fitbit access token...');
  return refreshAccessToken(tokens);
}

async function fetchActivities(tokens, dateStr, refreshedOnce = false) {
  const fetchFn = ensureFetch();
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchFn(`https://api.fitbit.com/1/user/-/activities/date/${dateStr}.json`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    });
    if (res.status === 401) {
      if (refreshedOnce) throw new Error('Fitbit authentication failed after token refresh (401).');
      console.warn('Access token expired, retrying after refresh...');
      const refreshed = await refreshAccessToken(tokens);
      return fetchActivities(refreshed, dateStr, true);
    }
    logRateLimitHeaders(res);
    if (res.status === 429 && attempt < maxRetries) {
      const waitMs = 1500 * Math.pow(2, attempt);
      if (CONFIG.splitDebug) {
        console.warn(`Split debug: rate limited for ${dateStr}, retrying in ${waitMs}ms`);
      }
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to fetch activities for ${dateStr}: ${res.status} ${body}`);
    }
    const json = parseFitbitPayload(await res.text());
    if (!Array.isArray(json.activities)) throw new Error('Invalid Fitbit daily activity payload.');
    if (CONFIG.splitDebug) {
      console.log(`Split debug: daily activity payload (${dateStr}): ${JSON.stringify(json)}`);
    }
    return json;
  }
  throw new Error(`Failed to fetch activities for ${dateStr}: rate limit exceeded`);
}

async function getRunActivityTypeIds(tokens) {
  if (cachedRunTypeIds) return cachedRunTypeIds;
  const fetchFn = ensureFetch();
  const res = await fetchFn('https://api.fitbit.com/1/activities.json', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
      'Accept-Language': 'en_US',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: activity types fetch failed (${res.status})`);
    }
    cachedRunTypeIds = new Set(CONFIG.runActivityIds);
    return cachedRunTypeIds;
  }
  const data = await res.json();
  const categories = data?.categories || [];
  const runIds = new Set();
  const runNameRe = /(run|jog|jogging|trail run|treadmill run|incline run)/i;
  function collectRunIds(category) {
    if (!category) return;
    const catName = String(category.name || '');
    const isRunCategory = /running/i.test(catName);
    const activities = category.activities || [];
    for (const activity of activities) {
      const name = String(activity?.name || '');
      if (isRunCategory || runNameRe.test(name)) {
        const id = Number(activity?.id);
        if (Number.isFinite(id)) runIds.add(id);
      }
    }
    const subCategories = category.subCategories || [];
    for (const sub of subCategories) {
      collectRunIds(sub);
    }
  }
  for (const category of categories) {
    collectRunIds(category);
  }
  for (const id of CONFIG.runActivityIds) {
    runIds.add(id);
  }
  cachedRunTypeIds = runIds;
  return runIds;
}

async function fetchActivityLaps(tokens, logId) {
  if (!logId) return null;
  const fetchFn = ensureFetch();
  const res = await fetchFn(`https://api.fitbit.com/1/user/-/activities/${logId}/laps.json`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: laps fetch failed for ${logId} (${res.status})`);
    }
    return null;
  }
  const data = await res.json();
  const laps = data?.laps || data?.lap || data;
  if (!Array.isArray(laps) || laps.length === 0) return null;
  return laps;
}

async function fetchActivityTcx(tokens, tcxLink) {
  if (!tcxLink) return null;
  const fetchFn = ensureFetch();
  const res = await fetchFn(tcxLink, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/vnd.garmin.tcx+xml',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: TCX fetch failed (${res.status})`);
    }
    return null;
  }
  return res.text();
}

async function fetchActivityTcxByLogId(tokens, logId) {
  if (!logId) return null;
  const fetchFn = ensureFetch();
  const res = await fetchFn(`https://api.fitbit.com/1/user/-/activities/${logId}.tcx?includePartialTCX=true`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/vnd.garmin.tcx+xml',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: TCX fetch by logId failed for ${logId} (${res.status})`);
    }
    return null;
  }
  return res.text();
}

async function fetchActivityDetail(tokens, logId) {
  if (!logId) return null;
  const fetchFn = ensureFetch();
  const res = await fetchFn(`https://api.fitbit.com/1/user/-/activities/${logId}.json`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: activity detail fetch failed for ${logId} (${res.status})`);
    }
    return null;
  }
  return res.json();
}

function parseTcxTrackpoints(xml) {
  const trackpoints = [];
  const tpRe = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g;
  let match;
  while ((match = tpRe.exec(xml)) !== null) {
    const segment = match[1];
    const timeMatch = segment.match(/<Time>([^<]+)<\/Time>/);
    const distMatch = segment.match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/);
    if (!timeMatch || !distMatch) continue;
    const time = Date.parse(timeMatch[1]);
    const meters = parseFloat(distMatch[1]);
    if (!Number.isFinite(time) || !Number.isFinite(meters)) continue;
    trackpoints.push({ time, meters });
  }
  if (trackpoints.length < 2) return null;
  const start = trackpoints[0].time;
  return trackpoints.map((tp) => ({
    seconds: (tp.time - start) / 1000,
    distanceKm: tp.meters / 1000,
  }));
}

function parseTcxLaps(xml) {
  const laps = [];
  const lapRe = /<Lap[^>]*>([\s\S]*?)<\/Lap>/g;
  let match;
  while ((match = lapRe.exec(xml)) !== null) {
    const segment = match[1];
    const distMatch = segment.match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/);
    const timeMatch = segment.match(/<TotalTimeSeconds>([^<]+)<\/TotalTimeSeconds>/);
    if (!distMatch || !timeMatch) continue;
    const meters = parseFloat(distMatch[1]);
    const seconds = parseFloat(timeMatch[1]);
    if (!Number.isFinite(meters) || !Number.isFinite(seconds)) continue;
    laps.push({ meters, seconds });
  }
  return laps.length ? laps : null;
}

function secondsFromTimeString(timeStr) {
  const parts = timeStr.split(':').map((v) => parseInt(v, 10));
  if (parts.length < 2 || parts.some((v) => Number.isNaN(v))) return null;
  const [h, m, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

function isValidDateInput(value) {
  return validateDate(value);
}

function computeSplitsFromSamples(samples, includePartial) {
  if (!samples || samples.length < 2) return [];
  const sorted = [...samples].sort((a, b) => a.seconds - b.seconds);
  const maxDistance = sorted[sorted.length - 1].distanceKm;
  const maxKm = Math.floor(maxDistance);
  if (maxKm < 1) return [];
  const splits = [];
  let targetKm = 1;
  let lastSplitTime = 0;
  for (let i = 1; i < sorted.length && targetKm <= maxKm; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.distanceKm < targetKm) continue;
    const distDelta = curr.distanceKm - prev.distanceKm;
    if (distDelta <= 0) continue;
    const ratio = (targetKm - prev.distanceKm) / distDelta;
    const timeAtTarget = prev.seconds + ratio * (curr.seconds - prev.seconds);
    const splitSec = timeAtTarget - lastSplitTime;
    splits.push({ distanceKm: targetKm, seconds: splitSec });
    lastSplitTime = timeAtTarget;
    targetKm += 1;
  }
  if (includePartial && maxDistance > maxKm + 0.01) {
    const last = sorted[sorted.length - 1];
    const partialSeconds = last.seconds - lastSplitTime;
    if (partialSeconds > 0) {
      splits.push({ distanceKm: maxDistance, seconds: partialSeconds, isPartial: true });
    }
  }
  return splits;
}

function formatSplitSeconds(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '-';
  const rounded = Math.round(sec);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

function formatSplitLines(splits) {
  const parts = splits.map((split) => {
    const label = formatSplitSeconds(split.seconds);
    if (split.isPartial) {
      const dist = split.distanceKm.toFixed(1);
      return `${label}(${dist}km)`;
    }
    return label;
  });
  const lines = [];
  for (let i = 0; i < parts.length; i += 5) {
    const line = parts.slice(i, i + 5).join('→');
    lines.push(i === 0 ? line : `→${line}`);
  }
  return lines;
}

async function getRunSplits(tokens, activity, dateStr) {
  const logId = activity.logId || activity.activityId;
  const laps = await fetchActivityLaps(tokens, logId);
  if (laps && laps.length) {
    const approxOneKm = laps.every((lap) => Math.abs((lap.distance || 0) - 1) <= 0.05);
    if (approxOneKm) {
      const lapSplits = laps
        .map((lap, idx) => ({ distanceKm: idx + 1, seconds: lap.duration ? lap.duration / 1000 : 0 }))
        .filter((lap) => lap.seconds > 0);
      if (lapSplits.length) return lapSplits;
    }
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: laps exist but are not ~1km (logId=${logId})`);
    }
  }

  let tcxLink = activity.tcxLink;
  if (!tcxLink && logId) {
    const detail = await fetchActivityDetail(tokens, logId);
    tcxLink = detail?.activity?.tcxLink || detail?.tcxLink;
    if (!tcxLink && CONFIG.splitDebug) {
      console.warn(`Split debug: tcxLink missing in activity detail (logId=${logId}); using TCX endpoint by logId`);
    }
  }
  let tcxXml = await fetchActivityTcx(tokens, tcxLink);
  if (!tcxXml && logId) {
    tcxXml = await fetchActivityTcxByLogId(tokens, logId);
  }
  if (tcxXml) {
    const laps = parseTcxLaps(tcxXml);
    if (laps) {
      const lapSplits = recordedKmSplits(laps);
      if (lapSplits.length) return lapSplits;
      if (CONFIG.splitDebug) {
        console.warn(`Split debug: TCX laps present but not ~1km (logId=${logId})`);
      }
    }
    const samples = parseTcxTrackpoints(tcxXml);
    if (samples) {
      const splits = computeSplitsFromSamples(samples, true);
      if (splits.length) return splits;
      if (CONFIG.splitDebug) {
        console.warn(`Split debug: TCX parsed but no splits computed (logId=${logId})`);
      }
    } else if (CONFIG.splitDebug) {
      console.warn(`Split debug: TCX missing trackpoints (logId=${logId})`);
    }
  }

  const resolution = process.env.FITBIT_DISTANCE_RESOLUTION || '1sec';
  const fetchFn = ensureFetch();
  const res = await fetchFn(`https://api.fitbit.com/1/user/-/activities/distance/date/${dateStr}/1d/${resolution}.json`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Accept': 'application/json',
    },
  });
  checkFitbitDetailResponse(res);
  if (!res.ok) return [];
  const json = await res.json();
  const dataset = json?.['activities-distance-intraday']?.dataset || [];
  if (!Array.isArray(dataset) || dataset.length < 2) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: intraday dataset missing or too small (logId=${logId})`);
    }
    return [];
  }
  const startSec = secondsFromTimeString(activity.startTime || '00:00:00');
  if (startSec == null) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: invalid startTime for intraday match (logId=${logId})`);
    }
    return [];
  }
  const durationSec = Math.round((activity.duration || 0) / 1000);
  const endSec = startSec + durationSec;
  const samples = [];
  let cumulative = 0;
  for (const point of dataset) {
    const tSec = secondsFromTimeString(point.time);
    if (tSec == null || tSec < startSec || tSec > endSec) continue;
    const dist = Number(point.value);
    if (!Number.isFinite(dist)) continue;
    cumulative += dist;
    samples.push({ seconds: tSec - startSec, distanceKm: cumulative });
  }
  if (samples.length < 2) {
    if (CONFIG.splitDebug) {
      console.warn(`Split debug: intraday samples too small after filtering (logId=${logId})`);
    }
    return [];
  }
  return computeSplitsFromSamples(samples, true);
}

function parseCliArgs(args = process.argv.slice(2), now = Date.now()) {
  const result = { dates: [], source: 'auto', dryRun: false, help: false };
  let from = null;
  let to = null;
  let days = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { result.help = true; continue; }
    if (arg === '--dry-run') { result.dryRun = true; continue; }
    const match = /^(--date|--from|--to|--days|--source)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`Unknown option: ${arg}`);
    const value = match[2] === undefined ? args[++i] : match[2];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${match[1]}`);
    if (match[1] === '--date') result.dates.push(value);
    if (match[1] === '--from') from = value;
    if (match[1] === '--to') to = value;
    if (match[1] === '--days') days = Number(value);
    if (match[1] === '--source') result.source = value;
  }
  if (result.help) return result;
  if (!['auto', 'garmin', 'fitbit'].includes(result.source)) throw new Error('--source must be auto, garmin, or fitbit.');
  if (days !== null && (!Number.isInteger(days) || days < 1)) throw new Error('--days must be a positive integer.');
  if (Boolean(from) !== Boolean(to)) throw new Error('--from and --to must be supplied together.');
  for (const value of [...result.dates, from, to].filter((value) => value !== null)) {
    if (!isValidDateInput(value)) throw new Error(`Invalid date: ${value} (expected YYYY-MM-DD).`);
  }
  if (from && to) {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    const step = start <= end ? 86400000 : -86400000;
    for (let t = start; step > 0 ? t <= end : t >= end; t += step) {
      result.dates.push(new Date(t).toISOString().slice(0, 10));
    }
  }
  if (!result.dates.length) {
    const shifted = new Date(now + CONFIG.timezoneOffsetMinutes * 60000);
    const base = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
    for (let offset = 0; offset < (days || 1); offset++) {
      result.dates.push(new Date(base - offset * 86400000).toISOString().slice(0, 10));
    }
  }
  result.dates = [...new Set(result.dates)];
  return result;
}

function buildFrontmatter({ title, dateStr, startTime, entryHash }) {
  const isoDate = buildOffsetDateTime(dateStr, startTime, CONFIG.timezoneOffsetMinutes);
  if (!isoDate) {
    throw new Error(`Invalid activity date/time: ${dateStr} ${startTime}`);
  }
  return [
    '---',
    `title: "${title}"`,
    `date: "${isoDate}"`,
    `author: "${CONFIG.defaultAuthor}"`,
    `category: "${CONFIG.defaultCategory}"`,
    `status: "${CONFIG.status}"`,
    'allowComments: false',
    `entryHash: "${entryHash}"`,
    '---',
    '',
  ].join('\n');
}

async function renderActivityMarkdown(dateStr, payload, tokens) {
  const { activities = [] } = payload;
  const runTypeIds = await getRunActivityTypeIds(tokens);
  const runNameSet = new Set(CONFIG.runActivityNames.map((v) => v.toLowerCase()));
  const filtered = activities.filter((activity) => {
    const duration = Number(activity.duration || 0);
    if (duration < 30000) return false;
    const typeId = Number(activity.activityTypeId || activity.activityId);
    const parentId = Number(activity.activityParentId || activity.activityId);
    if (runTypeIds.size) {
      if (Number.isFinite(typeId) && runTypeIds.has(typeId)) return true;
      if (Number.isFinite(parentId) && runTypeIds.has(parentId)) return true;
    }
    const name = `${activity.activityParentName || ''} ${activity.activityName || ''} ${activity.activityTypeName || ''}`.trim().toLowerCase();
    for (const candidate of runNameSet) {
      if (candidate && name.includes(candidate)) return true;
    }
    return /run|ラン/i.test(name);
  });
  if (!filtered.length) {
    return { content: `No logged activities on ${dateStr}.`, empty: true };
  }
  const startTime = earliestTime(filtered.map((activity) => activity.startTime));
  if (!startTime) {
    return { content: '', empty: false, startTime: null };
  }
  const lines = [];
  for (const activity of filtered) {
    lines.push(formatWorkoutSummary(activity.duration, activity.distance));
    const splits = await getRunSplits(tokens, activity, dateStr);
    if (splits.length) {
      lines.push('');
      const splitLines = formatSplitLines(splits);
      lines.push(...splitLines);
    }
    lines.push('');
  }

  return { content: lines.join('\n'), empty: false, startTime };
}

function writeMarkdown(slug, content, { blogDir = BLOG_DIR, dryRun = CONFIG.dryRun } = {}) {
  const target = path.join(blogDir, `${slug}.md`);
  if (fs.existsSync(target)) {
    console.warn(`Skipping ${slug}: file already exists.`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] Would write ${target}`);
    console.log(content);
    return;
  }
  fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
  console.log(`Created ${path.relative(process.cwd(), target)}`);
}

async function main(args = process.argv.slice(2), {
  blogDir = BLOG_DIR,
  fetchGarmin = fetchGarminWorkouts,
  fetchFitbit = fetchFitbitWorkout,
} = {}) {
  const options = parseCliArgs(args);
  if (options.help) {
    console.log('Usage: node scripts/import-workouts.js [--date YYYY-MM-DD ... | --from YYYY-MM-DD --to YYYY-MM-DD | --days N] [--source auto|garmin|fitbit] [--dry-run]');
    return;
  }
  const { dates, source } = options;
  const dryRun = options.dryRun || CONFIG.dryRun;
  fs.mkdirSync(blogDir, { recursive: true });
  let consecutiveEmptyDays = 0;
  for (const dateStr of dates) {
    console.log(`\nProcessing ${dateStr}...`);
    const existing = findExistingWorkoutPost(blogDir, dateStr);
    if (existing) {
      console.log(`Skipping ${dateStr}: ${existing} already exists.`);
      consecutiveEmptyDays = 0;
      continue;
    }
    try {
      const selected = await selectWorkoutSource({
        source,
        fetchGarmin: () => fetchGarmin(dateStr),
        fetchFitbit: () => fetchFitbit(dateStr),
      });
      console.log(`Using ${selected.source} for ${dateStr}.`);
      const rendered = selected.source === 'garmin'
        ? renderGarminMarkdown(dateStr, selected.payload, { offsetMinutes: CONFIG.timezoneOffsetMinutes, formatSplitLines })
        : selected.payload;
      const { content, empty, startTime } = rendered;
      if (empty) {
        consecutiveEmptyDays += 1;
        console.log(`No running activities found for ${dateStr}.`);
        if (consecutiveEmptyDays >= CONFIG.maxConsecutiveEmptyDays) {
          throw new Error(`Stopping import after ${consecutiveEmptyDays} consecutive days without matching activities.`);
        }
        continue;
      }
      consecutiveEmptyDays = 0;
      if (!startTime) {
        console.warn(`No valid ${selected.source} startTime found for running activities on ${dateStr}; skipping Markdown.`);
        continue;
      }
      const slug = `${dateStr}-fitbit-workout`;
      const entrySeed = selected.source === 'garmin'
        ? selected.payload.activities.map((activity) => activity.id).join(',')
        : rendered.entrySeed;
      const entryHash = crypto.createHash('sha1').update(`${dateStr}-${slug}-${entrySeed || ''}`).digest('hex');
      const storedDateTime = buildOffsetDateTime(dateStr, startTime, CONFIG.timezoneOffsetMinutes);
      console.log(`Using earliest run start time: ${storedDateTime}`);
      const markdown = buildFrontmatter({ title: '練習', dateStr, startTime, entryHash }) + content.trimEnd() + '\n';
      writeMarkdown(slug, markdown, { blogDir, dryRun });
    } catch (err) {
      throw new Error(`Failed to import ${dateStr}: ${err.message || err}`);
    }
  }
  console.log('\nImport complete.');
}

function runCli() {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}

if (require.main === module) runCli();
module.exports = { main, runCli, parseCliArgs, formatSplitLines, buildFrontmatter, renderActivityMarkdown };
