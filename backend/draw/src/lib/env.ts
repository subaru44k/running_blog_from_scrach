export const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
};

export const DRAW_BUCKET = requireEnv('DRAW_BUCKET');
export const DRAW_TABLE = requireEnv('DRAW_TABLE');
export const RATE_LIMIT_TABLE = requireEnv('RATE_LIMIT_TABLE');
export const SECONDARY_QUEUE_URL = requireEnv('SECONDARY_QUEUE_URL');
export const CLOUDFRONT_DOMAIN = requireEnv('CLOUDFRONT_DOMAIN');
export const CF_KEY_PAIR_ID = requireEnv('CF_KEY_PAIR_ID');
export const CF_PRIVATE_KEY_SECRET_ID = requireEnv('CF_PRIVATE_KEY_SECRET_ID');

export const IMAGE_TTL_SECONDS = Number(process.env.IMAGE_TTL_SECONDS || 900);
export const SUBMISSION_TTL_DAYS = Number(process.env.SUBMISSION_TTL_DAYS || 7);
export const RATE_LIMIT_WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 300);
export const RATE_LIMIT_UPLOAD = Number(process.env.RATE_LIMIT_UPLOAD || 10);
export const RATE_LIMIT_SUBMIT = Number(process.env.RATE_LIMIT_SUBMIT || 5);

export const PRIMARY_MODEL_ID = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
export const SECONDARY_MODEL_ID = process.env.SECONDARY_MODEL_ID || 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';
