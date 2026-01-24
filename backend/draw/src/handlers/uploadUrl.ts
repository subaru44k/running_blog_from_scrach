import { json, options, parseJson } from '../lib/http';
import { rateLimit } from '../lib/rateLimit';
import { createPutUrl } from '../lib/s3';
import { DRAW_BUCKET, IMAGE_TTL_SECONDS, RATE_LIMIT_UPLOAD } from '../lib/env';
import { generateUlid } from '../lib/ulid';
import { getClientIp } from '../lib/ip';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const { promptId } = parseJson(event);
    if (!promptId) {
      return json(400, { error: 'promptId required' }, origin);
    }
    const ip = getClientIp(event);
    await rateLimit(`ip#upload-url#${ip}`, RATE_LIMIT_UPLOAD);

    const submissionId = generateUlid();
    const imageKey = `draw/${promptId}/${submissionId}.png`;
    const putUrl = await createPutUrl(DRAW_BUCKET, imageKey, IMAGE_TTL_SECONDS, 'image/png');

    return json(200, { submissionId, imageKey, putUrl }, origin);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json(status, { error: err?.message || 'failed' }, origin);
  }
};
