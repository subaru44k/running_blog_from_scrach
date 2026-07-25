const BLOG_TIME_ZONE = 'Asia/Tokyo';
const JST_OFFSET_MINUTES = 540;

function isValidDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeTimeInput(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`;
}

function offsetToIso(offsetMinutes) {
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 1439) {
    throw new Error(`Invalid timezone offset: ${offsetMinutes}`);
  }
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function buildOffsetDateTime(dateInput, timeInput, offsetMinutes = JST_OFFSET_MINUTES) {
  if (!isValidDateInput(dateInput)) return null;
  const time = normalizeTimeInput(timeInput);
  if (!time) return null;
  return `${dateInput}T${time}${offsetToIso(offsetMinutes)}`;
}

function parseBlogDate(value) {
  if (value instanceof Date) return new Date(value.valueOf());
  const raw = String(value || '');
  const withJstOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)
    ? `${raw}${offsetToIso(JST_OFFSET_MINUTES)}`
    : raw;
  return new Date(withJstOffset);
}

function dateTimeParts(value, timeZone = BLOG_TIME_ZONE) {
  const date = parseBlogDate(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

function earliestTime(values) {
  const valid = values
    .map(normalizeTimeInput)
    .filter(Boolean)
    .sort();
  return valid[0] || null;
}

module.exports = {
  BLOG_TIME_ZONE,
  JST_OFFSET_MINUTES,
  buildOffsetDateTime,
  dateTimeParts,
  earliestTime,
  isValidDateInput,
  normalizeTimeInput,
  offsetToIso,
  parseBlogDate,
};
