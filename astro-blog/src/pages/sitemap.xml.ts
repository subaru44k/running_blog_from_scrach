import { getCollection } from 'astro:content';
import { filterPostsForBuild } from '../lib/build-filter';

export const prerender = true;

export async function GET() {
  const site = import.meta.env.SITE?.replace(/\/?$/, '/') || 'https://subaru-is-running.com/';
  const excludedCategories = new Set(['練習(弱)', '練習(中)', '練習(デフォルト)']);
  const posts = filterPostsForBuild(await getCollection('blog', ({ data }) => data.status === 'publish'))
    .filter((post) => !excludedCategories.has(post.data.category) && !post.slug.includes('-summary-'));
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const latestPostDate = posts[0]?.data.date ?? new Date();
  const urls = [
    { loc: site, lastmod: latestPostDate.toISOString() },
    { loc: `${site}blog/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}archive/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}running-pace/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}pdf-compress/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}draw/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}draw/archive/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}draw/play/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}draw/result/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/janken/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/snake/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/maze/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/tic-tac-toe/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}games/reversi/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}about/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}contact/`, lastmod: latestPostDate.toISOString() },
    { loc: `${site}privacy/`, lastmod: latestPostDate.toISOString() },
    ...posts.map((p) => ({
      loc: `${site}${p.slug}/`,
      lastmod: p.data.date.toISOString(),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
  });
}
