export const BLOG_TIME_ZONE = 'Asia/Tokyo';
const JST_OFFSET = '+09:00';
const blogDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BLOG_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type BlogDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  date: string;
  time: string;
};

const blogDatePartsCache = new Map<number, BlogDateParts>();

export function normalizeBlogDateInput(value: unknown) {
  if (typeof value !== 'string') return value;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? `${value}${JST_OFFSET}`
    : value;
}

export function getBlogDateParts(date: Date) {
  const timestamp = date.valueOf();
  const cached = blogDatePartsCache.get(timestamp);
  if (cached) return cached;
  const parts = blogDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const result = {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
  blogDatePartsCache.set(timestamp, result);
  return result;
}

export function formatBlogDate(date: Date) {
  return getBlogDateParts(date).date;
}

export function formatBlogDateTime(date: Date) {
  const parts = getBlogDateParts(date);
  return `${parts.date} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}
