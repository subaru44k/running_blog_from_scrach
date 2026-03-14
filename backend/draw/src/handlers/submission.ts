import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_TABLE } from '../lib/env';
import { buildSignedUrl } from '../lib/cfSign';
import { json, options } from '../lib/http';
import type { SubmissionDetailResponse } from '../types';
import { resolveDrawPrompt } from '../lib/prompt';

const clampScore = (value: any) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const promptIdQuery = String(event?.queryStringParameters?.promptId || '').trim();
    const submissionId = String(event?.queryStringParameters?.submissionId || '').trim();
    const month = event?.queryStringParameters?.month;
    const prompt = resolveDrawPrompt({ promptId: promptIdQuery, month });
    const promptId = prompt.promptId;

    if (!promptId || !submissionId) {
      return json(400, { error: 'promptId and submissionId are required' }, origin);
    }

    const response = await ddb.send(new GetCommand({
      TableName: DRAW_TABLE,
      Key: { promptId, submissionId },
    }));

    const item = response.Item;
    if (!item || !item.imageKey) {
      return json(404, { error: 'not_found' }, origin);
    }

    const body: SubmissionDetailResponse = {
      submissionId,
      promptId,
      promptText: String(item.promptText || prompt.promptText || ''),
      createdAt: String(item.createdAt || ''),
      rank: Number.isFinite(Number(item.rank)) ? Number(item.rank) : undefined,
      score: clampScore(item.score),
      breakdown: {
        likeness: clampScore(item?.breakdown?.likeness),
        composition: clampScore(item?.breakdown?.composition),
        originality: clampScore(item?.breakdown?.originality),
      },
      oneLiner: String(item.oneLiner || ''),
      tips: Array.isArray(item.tips) ? item.tips.map((tip: any) => String(tip)) : [],
      imageDataUrl: await buildSignedUrl(String(item.imageKey)),
    };

    return json(200, body, origin);
  } catch (err: any) {
    return json(500, { error: err?.message || 'failed' }, origin);
  }
};
