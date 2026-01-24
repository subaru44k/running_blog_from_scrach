const allowedOrigins = new Set([
  'https://subaru-is-running.com',
  'http://localhost:4321',
  'http://localhost:3000',
]);

export const corsHeaders = (origin?: string) => {
  const allowed = origin && allowedOrigins.has(origin) ? origin : 'https://subaru-is-running.com';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
};

export const parseJson = (event: any) => {
  if (!event?.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const json = (statusCode: number, body: Record<string, any>, origin?: string) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  },
  body: JSON.stringify(body),
});

export const options = (origin?: string) => ({
  statusCode: 204,
  headers: corsHeaders(origin),
  body: '',
});
