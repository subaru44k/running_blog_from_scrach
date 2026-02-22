import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb';
import { DRAW_TABLE } from '../lib/env';
import { buildSignedUrl } from '../lib/cfSign';
import { json, options } from '../lib/http';
import type { LeaderboardResponse } from '../types';
import { resolveDrawPrompt } from '../lib/prompt';

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const promptIdQuery = event?.queryStringParameters?.promptId;
    const month = event?.queryStringParameters?.month;
    const limitParam = event?.queryStringParameters?.limit;
    const limit = Math.min(Number(limitParam || 20) || 20, 50);
    const prompt = resolveDrawPrompt({ promptId: promptIdQuery, month });
    const promptId = prompt.promptId;

    const response = await ddb.send(new QueryCommand({
      TableName: DRAW_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': promptId },
      ScanIndexForward: true,
      Limit: limit,
    }));

    const items = (response.Items || []).map((item: any, idx: number) => ({
      rank: idx + 1,
      score: item.score,
      nickname: item.nickname || '匿名',
      submissionId: item.submissionId,
      imageKey: item.imageKey,
    }));

    const signedItems = [] as LeaderboardResponse['items'];
    for (const item of items) {
      const imageDataUrl = await buildSignedUrl(item.imageKey);
      signedItems.push({
        rank: item.rank,
        score: item.score,
        nickname: item.nickname,
        submissionId: item.submissionId,
        imageDataUrl,
      });
    }

    const body: LeaderboardResponse = {
      promptId,
      items: signedItems,
    };
    return json(200, body, origin);
  } catch (err: any) {
    return json(500, { error: err?.message || 'failed' }, origin);
  }
};
