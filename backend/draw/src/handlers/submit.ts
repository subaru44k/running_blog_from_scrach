import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { json, options, parseJson } from '../lib/http';
import { rateLimit } from '../lib/rateLimit';
import { getObjectBuffer } from '../lib/s3';
import { computeInkRatio, isInkGateFail } from '../lib/inkGate';
import { scoreStub } from '../lib/scoreStub';
import { ddb } from '../lib/ddb';
import { DRAW_BUCKET, DRAW_TABLE, RATE_LIMIT_SUBMIT, SECONDARY_QUEUE_URL, SUBMISSION_TTL_DAYS } from '../lib/env';
import { getClientIp } from '../lib/ip';
import type { SubmitResult } from '../types';
import { SQSClient } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({});

const gateResult = (submissionId: string): SubmitResult => ({
  submissionId,
  score: 0,
  breakdown: { likeness: 0, composition: 0, originality: 0 },
  oneLiner: '線がほとんど見えないため、採点をスキップしました。',
  tips: [],
  isRanked: false,
});

const makeScoreSortKey = (score: number, createdAt: string, submissionId: string) => {
  const inv = String(100 - Math.min(100, Math.max(0, score))).padStart(3, '0');
  return `${inv}#${createdAt}#${submissionId}`;
};

const computeRank = (items: Array<{ scoreSortKey?: string }>, newKey: string) => {
  const list = [...items.map((i) => i.scoreSortKey || '')];
  list.push(newKey);
  list.sort();
  return list.indexOf(newKey) + 1;
};

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const { promptId, submissionId, imageKey, nickname } = parseJson(event);
    if (!promptId || !submissionId || !imageKey) {
      return json(400, { error: 'promptId, submissionId, imageKey required' }, origin);
    }
    const ip = getClientIp(event);
    await rateLimit(`ip#submit#${ip}`, RATE_LIMIT_SUBMIT);

    const imageBuffer = await getObjectBuffer(DRAW_BUCKET, imageKey);
    const inkRatio = computeInkRatio(imageBuffer);
    const createdAt = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + SUBMISSION_TTL_DAYS * 86400;

    let result: SubmitResult;
    let isRanked = false;
    let rank: number | undefined = undefined;
    let scoreSortKey = '';
    let secondaryStatus: 'pending' | 'skipped' | 'failed' | 'done' = 'skipped';

    if (isInkGateFail(inkRatio)) {
      result = gateResult(submissionId);
      scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
    } else {
      const scored = scoreStub();
      result = {
        submissionId,
        score: scored.score,
        breakdown: scored.breakdown,
        oneLiner: scored.oneLiner,
        tips: scored.tips,
        isRanked: false,
      };

      scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
      const leaderboard = await ddb.send(new QueryCommand({
        TableName: DRAW_TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': promptId },
        ProjectionExpression: 'scoreSortKey',
        ScanIndexForward: true,
        Limit: 20,
      }));
      const items = (leaderboard.Items || []) as Array<{ scoreSortKey?: string }>;
      rank = computeRank(items, scoreSortKey);
      isRanked = rank <= 20;
      result.isRanked = isRanked;
      if (isRanked) result.rank = rank;
      secondaryStatus = isRanked ? 'pending' : 'skipped';
    }

    await ddb.send(new PutCommand({
      TableName: DRAW_TABLE,
      Item: {
        promptId,
        submissionId,
        createdAt,
        expiresAt,
        nickname: nickname || '匿名',
        imageKey,
        score: result.score,
        breakdown: result.breakdown,
        oneLiner: result.oneLiner,
        tips: result.tips,
        isRanked: result.isRanked,
        rank: result.rank,
        secondaryStatus,
        enrichedComment: null,
        secondaryAttempts: 0,
        GSI1PK: promptId,
        scoreSortKey,
      },
    }));

    if (result.isRanked) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: SECONDARY_QUEUE_URL,
        MessageBody: JSON.stringify({ promptId, submissionId, score: result.score }),
      }));
    }

    return json(200, result, origin);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json(status, { error: err?.message || 'failed' }, origin);
  }
};
