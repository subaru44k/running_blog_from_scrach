import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { filterPostsForBuild } from '../../../lib/build-filter';

export const prerender = true;

export async function getStaticPaths() {
  const posts = filterPostsForBuild(await getCollection('blog', ({ data }) => data.status === 'publish'));
  const months = new Set<string>();
  for (const post of posts) {
    const d = post.data.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.add(key);
  }
  return Array.from(months).map((key) => {
    const [year, month] = key.split('-');
    return { params: { year, month } };
  });
}

export const GET: APIRoute = async ({ params }) => {
  const year = Number(params.year);
  const month = Number(params.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }

  const posts = filterPostsForBuild(await getCollection('blog', ({ data }) => data.status === 'publish'));
  const map: Record<string, { s: string; c: number }> = {};
  for (const post of posts) {
    const d = post.data.date;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y !== year || m !== month) continue;
    const key = post.slug.slice(0, 10); // YYYY-MM-DD
    if (!map[key]) map[key] = { s: post.slug, c: 1 };
    else map[key].c += 1;
  }

  return new Response(JSON.stringify(map), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
};
