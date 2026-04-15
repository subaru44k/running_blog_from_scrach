import type { APIRoute } from 'astro';
import { getSortedPublishedBlogPosts, toSidebarItem } from '../lib/blog-index';

const SIDEBAR_LIMIT = 50;

export const GET: APIRoute = async () => {
  const posts = await getSortedPublishedBlogPosts();

  const map: Record<
    string,
    { slug: string; title: string; date: string; category: string }[]
  > = {};

  for (const post of posts) {
    const category = post.data.category || 'Uncategorized';
    if (!map[category]) map[category] = [];
    map[category].push(toSidebarItem(post));
  }

  for (const category of Object.keys(map)) {
    map[category] = map[category]
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
      .slice(0, SIDEBAR_LIMIT);
  }

  return new Response(JSON.stringify(map), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
