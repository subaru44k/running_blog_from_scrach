export const getClientIp = (event: any) => {
  const header = event?.headers || {};
  const forwarded = header['x-forwarded-for'] || header['X-Forwarded-For'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return event?.requestContext?.http?.sourceIp
    || event?.requestContext?.identity?.sourceIp
    || 'unknown';
};
