export const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env ${key}`);
  return value;
};

export const DRAW_BUCKET = requireEnv('DRAW_BUCKET');
export const DRAW_TABLE = requireEnv('DRAW_TABLE');
export const RATE_LIMIT_TABLE = requireEnv('RATE_LIMIT_TABLE');
export const CLOUDFRONT_DOMAIN = requireEnv('CLOUDFRONT_DOMAIN');
export const CF_KEY_PAIR_ID = requireEnv('CF_KEY_PAIR_ID');
export const CF_PRIVATE_KEY_SECRET_ID = requireEnv('CF_PRIVATE_KEY_SECRET_ID');

export const IMAGE_TTL_SECONDS = Number(process.env.IMAGE_TTL_SECONDS || 900);
export const SUBMISSION_TTL_DAYS = Number(process.env.SUBMISSION_TTL_DAYS || 45);
export const RATE_LIMIT_WINDOW_SECONDS = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 300);
export const RATE_LIMIT_UPLOAD = Number(process.env.RATE_LIMIT_UPLOAD || 10);
export const RATE_LIMIT_SUBMIT = Number(process.env.RATE_LIMIT_SUBMIT || 5);

export const PRIMARY_PROVIDER = process.env.PRIMARY_PROVIDER || 'openai';
export const PRIMARY_MODEL_ID = process.env.PRIMARY_MODEL_ID || 'gpt-5-mini';
export const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'minimal';
export const OPENAI_API_KEY_SECRET_ID = process.env.OPENAI_API_KEY_SECRET_ID || '';
export const SECONDARY_MODEL_ID = process.env.SECONDARY_MODEL_ID || '';
