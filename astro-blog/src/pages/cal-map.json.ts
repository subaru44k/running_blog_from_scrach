import { getCalendarMap } from '../lib/blog-index';

export const prerender = true;

export async function GET() {
  const map = await getCalendarMap();
  const body = JSON.stringify(map);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      // Cache at the edge; allow staleness while revalidating
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
