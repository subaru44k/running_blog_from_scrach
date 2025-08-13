import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET() {
  const posts = await getCollection('blog', ({ data }) => data.status === 'publish');
  // dateKey -> { s: firstSlug, c: count }
  const map: Record<string, { s: string; c: number }> = {};
  for (const p of posts) {
    const key = p.slug.slice(0, 10); // YYYY-MM-DD
    if (!map[key]) map[key] = { s: p.slug, c: 1 };
    else map[key].c += 1;
  }
  const body = JSON.stringify(map);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      // Cache at the edge; allow staleness while revalidating
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

