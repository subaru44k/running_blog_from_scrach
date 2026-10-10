import { json, options, parseJson } from '../lib/http.js';
import { rateLimit } from '../lib/rateLimit.js';
import { createPutUrl } from '../lib/s3.js';
import { DRAW_BUCKET, IMAGE_TTL_SECONDS, RATE_LIMIT_UPLOAD } from '../lib/env.js';
import { generateUlid } from '../lib/ulid.js';
import { getClientIp } from '../lib/ip.js';
import { getCurrentMonthJst, resolveDrawPrompt } from '../lib/prompt.js';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const { month, promptId, contentType = 'image/png' } = parseJson(event);
    if (contentType !== 'image/png' && contentType !== 'image/webp') return json(400, { error: 'Unsupported image content type' }, origin);
    const extension = contentType === 'image/webp' ? 'webp' : 'png';
    const ip = getClientIp(event);
    await rateLimit(`ip#upload-url#${ip}`, RATE_LIMIT_UPLOAD);

    const prompt = resolveDrawPrompt({ month, promptId });
    const rankingEligible = prompt.month === getCurrentMonthJst();
    const submissionId = generateUlid();
    const imageKey = rankingEligible
      ? `draw/${prompt.promptId}/${submissionId}.${extension}`
      : `draw/practice/${prompt.promptId}/${submissionId}.${extension}`;
    const putUrl = await createPutUrl(DRAW_BUCKET, imageKey, IMAGE_TTL_SECONDS, contentType);

    return json(200, {
      submissionId,
      imageKey,
      putUrl,
      promptId: prompt.promptId,
      promptText: prompt.promptText,
      rankingEligible,
      contentType,
    }, origin);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json(status, { error: err?.message || 'failed' }, origin);
  }
};
