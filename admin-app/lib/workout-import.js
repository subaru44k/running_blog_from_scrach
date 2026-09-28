const fs = require('fs');

async function selectWorkoutSource({ source = 'auto', fetchGarmin, fetchFitbit }) {
  if (source === 'fitbit') return { source: 'fitbit', payload: await fetchFitbit() };
  const payload = await fetchGarmin();
  // Only a successful empty result permits fallback.
  if (source === 'garmin' || payload.activities.length) return { source: 'garmin', payload };
  return { source: 'fitbit', payload: await fetchFitbit() };
}

function findExistingWorkoutPost(blogDir, dateStr) {
  const pattern = new RegExp(`^${dateStr}-fitbit-workout(?:-\\d+)?\\.md$`);
  return fs.readdirSync(blogDir).find((name) => pattern.test(name)) || null;
}

function parseFitbitPayload(raw) {
  // Fitbit returns 64-bit log IDs which JS numbers cannot preserve.
  return JSON.parse(raw.replace(/("logId"\s*:\s*)(\d+)/g, '$1"$2"'));
}

module.exports = { selectWorkoutSource, findExistingWorkoutPost, parseFitbitPayload };
