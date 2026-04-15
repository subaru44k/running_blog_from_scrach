import { getCollection, type CollectionEntry } from 'astro:content';
import { filterPostsForBuild } from './build-filter';

export type BlogPost = CollectionEntry<'blog'>;
export type CalendarEntry = { s: string; c: number };
export type SidebarItem = {
  slug: string;
  title: string;
  date: string;
  category: string;
};

let allPostsPromise: Promise<BlogPost[]> | undefined;
let publishedPostsPromise: Promise<BlogPost[]> | undefined;
let sortedPublishedPostsPromise: Promise<BlogPost[]> | undefined;

export function getAllBlogPosts() {
  allPostsPromise ??= getCollection('blog').then((posts) => filterPostsForBuild(posts));
  return allPostsPromise;
}

export function getPublishedBlogPosts() {
  publishedPostsPromise ??= getCollection('blog', ({ data }) => data.status === 'publish').then((posts) =>
    filterPostsForBuild(posts)
  );
  return publishedPostsPromise;
}

export function getSortedPublishedBlogPosts() {
  sortedPublishedPostsPromise ??= getPublishedBlogPosts().then((posts) =>
    [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
  );
  return sortedPublishedPostsPromise;
}

export function toSidebarItem(post: BlogPost): SidebarItem {
  return {
    slug: post.slug,
    title: post.data.title,
    date: post.data.date.toISOString(),
    category: post.data.category,
  };
}

export function buildCalendarMap(posts: BlogPost[]) {
  return posts.reduce(
    (acc, post) => {
      const key = post.slug.slice(0, 10);
      if (!acc[key]) acc[key] = { s: post.slug, c: 1 };
      else acc[key].c += 1;
      return acc;
    },
    {} as Record<string, CalendarEntry>
  );
}

export async function getCalendarMap() {
  const posts = await getPublishedBlogPosts();
  return buildCalendarMap(posts);
}

export async function getCalendarMonths() {
  const posts = await getPublishedBlogPosts();
  const months = new Set<string>();
  for (const post of posts) {
    const date = post.data.date;
    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return Array.from(months);
}

export async function getMonthCalendarMap(year: number, month: number) {
  const posts = await getPublishedBlogPosts();
  return buildCalendarMap(
    posts.filter((post) => {
      const date = post.data.date;
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    })
  );
}

export function groupPostsByYearMonth(posts: BlogPost[]) {
  const grouped: Record<string, Record<string, BlogPost[]>> = {};
  for (const post of posts) {
    const date = post.data.date;
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    grouped[year] ||= {};
    grouped[year][month] ||= [];
    grouped[year][month].push(post);
  }
  return grouped;
}

export function imageForCategory(category: string): string {
  switch (category) {
    case '練習(弱)':
      return '/images/workouts/abstract-04.svg';
    case '練習(中)':
      return '/images/workouts/abstract-03.svg';
    case '練習(強)':
      return '/images/workouts/abstract-08.svg';
    case '試合':
      return '/images/workouts/abstract-02.svg';
    case '練習(デフォルト)':
    default:
      return '/images/workouts/abstract-01.svg';
  }
}
