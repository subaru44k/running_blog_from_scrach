function formatDurationMinutes(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  return minutes > 0 ? `${minutes}分` : null;
}

function formatDistanceKm(distance) {
  const kilometers = Number(distance);
  if (!Number.isFinite(kilometers) || kilometers <= 0) return null;
  return `${kilometers.toFixed(2)}km`;
}

function formatWorkoutSummary(durationMs, distance) {
  const durationLabel = formatDurationMinutes(durationMs) || '運動';
  const distanceLabel = formatDistanceKm(distance);
  return `${durationLabel}ジョグ${distanceLabel ? `(${distanceLabel})` : ''}`;
}

module.exports = {
  formatDistanceKm,
  formatDurationMinutes,
  formatWorkoutSummary,
};
