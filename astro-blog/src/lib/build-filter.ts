export function filterPostsForBuild<T extends { data: { date: Date } }>(posts: T[]) {
  const limitRaw = import.meta.env.ASTRO_BUILD_LIMIT;
  const sinceRaw = import.meta.env.ASTRO_BUILD_SINCE;

  const limit = Number(limitRaw || 0);
  const since = sinceRaw ? new Date(sinceRaw) : null;

  let filtered = posts;
  if (since && !Number.isNaN(since.valueOf())) {
    filtered = filtered.filter((post) => post.data.date >= since);
  }

  if (limit > 0 && Number.isFinite(limit)) {
    filtered = [...filtered].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()).slice(0, limit);
  }

  return filtered;
}
