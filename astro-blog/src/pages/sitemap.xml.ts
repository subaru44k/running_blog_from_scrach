import { getCollection } from 'astro:content';

export async function GET() {
  const site = import.meta.env.SITE?.replace(/\/?$/, '/') || 'https://subaru-is-running.com/';
  const posts = await getCollection('blog', ({ data }) => data.status === 'publish');
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const urls = [
    { loc: site, lastmod: new Date().toISOString() },
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

