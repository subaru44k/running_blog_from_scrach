import type { APIRoute } from 'astro';
import { getCalendarMonths, getMonthCalendarMap } from '../../../lib/blog-index';

export const prerender = true;

export async function getStaticPaths() {
  const months = await getCalendarMonths();
  return months.map((key) => {
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

  const map = await getMonthCalendarMap(year, month);

  return new Response(JSON.stringify(map), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
};
