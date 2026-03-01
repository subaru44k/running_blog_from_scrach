import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { json, options, parseJson } from '../lib/http';
import { rateLimit } from '../lib/rateLimit';
import { getObjectBuffer } from '../lib/s3';
import { computeInkRatio, isInkGateFail } from '../lib/inkGate';
import { scoreStub } from '../lib/scoreStub';
import { ddb } from '../lib/ddb';
import { DRAW_BUCKET, DRAW_TABLE, PRIMARY_MODEL_ID, RATE_LIMIT_SUBMIT, SECONDARY_QUEUE_URL, SUBMISSION_TTL_DAYS } from '../lib/env';
import { getClientIp } from '../lib/ip';
import type { SubmitResult } from '../types';
import { SQSClient } from '@aws-sdk/client-sqs';
import { invokeClaudeJson } from '../lib/bedrock';
import { buildPrimaryUser, primarySystemPrompt } from '../lib/aiPrompts';
import { resolveDrawPrompt } from '../lib/prompt';

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

const clampScore = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

type PrimaryRubric = {
  promptMatch: number;
  composition: number;
  shapeClarity: number;
  lineStability: number;
  creativity: number;
  completeness: number;
};

const clampRubric = (value: unknown) => Math.min(10, Math.max(0, Math.round(Number(value ?? 5) || 5)));

const normalizeRubric = (input: any): PrimaryRubric => {
  if (input?.rubric) {
    return {
      promptMatch: clampRubric(input.rubric.promptMatch),
      composition: clampRubric(input.rubric.composition),
      shapeClarity: clampRubric(input.rubric.shapeClarity),
      lineStability: clampRubric(input.rubric.lineStability),
      creativity: clampRubric(input.rubric.creativity),
      completeness: clampRubric(input.rubric.completeness),
    };
  }
  // Backward-compatibility for legacy breakdown style output.
  return {
    promptMatch: clampRubric((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10),
    composition: clampRubric((input?.breakdown?.composition ?? input?.composition ?? 50) / 10),
    shapeClarity: clampRubric((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10),
    lineStability: clampRubric(((input?.breakdown?.composition ?? input?.composition ?? 50) * 0.5 + (input?.breakdown?.originality ?? input?.originality ?? 50) * 0.5) / 10),
    creativity: clampRubric((input?.breakdown?.originality ?? input?.originality ?? 50) / 10),
    completeness: clampRubric(((input?.score ?? 60) * 0.8 + (input?.breakdown?.composition ?? input?.composition ?? 50) * 0.2) / 10),
  };
};

const computeScoreFromRubric = (rubric: PrimaryRubric) => {
  const weighted =
    rubric.promptMatch * 24 +
    rubric.composition * 16 +
    rubric.shapeClarity * 18 +
    rubric.lineStability * 12 +
    rubric.creativity * 16 +
    rubric.completeness * 14;
  return clampScore(weighted / 10);
};

const toLegacyBreakdown = (rubric: PrimaryRubric) => ({
  likeness: clampScore((rubric.promptMatch * 0.6 + rubric.shapeClarity * 0.4) * 10),
  composition: clampScore((rubric.composition * 0.7 + rubric.completeness * 0.3) * 10),
  originality: clampScore((rubric.creativity * 0.7 + rubric.lineStability * 0.3) * 10),
});

const computeDeterministicJitter = (submissionId: string) => {
  let hash = 2166136261; // FNV-1a 32-bit
  for (let i = 0; i < submissionId.length; i += 1) {
    hash ^= submissionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const mod = (hash >>> 0) % 3;
  if (mod === 0) return -1;
  if (mod === 1) return 0;
  return 1;
};

const normalizePrimary = (input: any) => {
  const rubric = normalizeRubric(input);
  const breakdown = toLegacyBreakdown(rubric);
  const score = computeScoreFromRubric(rubric);
  const oneLiner = String(input?.oneLiner || '前向きで良い雰囲気です。').slice(0, 90);
  const tipsRaw = Array.isArray(input?.tips) ? input.tips : [];
  const tips = tipsRaw.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 3);
  return { score, breakdown, oneLiner, tips, rubric };
};

export const handler = async (event: any) => {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  if (event?.requestContext?.http?.method === 'OPTIONS') return options(origin);
  try {
    const { promptId: promptIdRaw, submissionId, imageKey, nickname, promptText, month } = parseJson(event);
    if (!submissionId || !imageKey) {
      return json(400, { error: 'submissionId, imageKey required' }, origin);
    }
    const imagePromptId = (() => {
      const m = /^draw\/(prompt-\d{4}-\d{2})\/[^/]+\.png$/.exec(String(imageKey));
      return m ? m[1] : undefined;
    })();
    const prompt = resolveDrawPrompt({ promptId: imagePromptId || promptIdRaw, month });
    const promptId = prompt.promptId;
    const resolvedPromptText = prompt.promptText;
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
    const tokenRecordedAt = new Date().toISOString();
    let primaryModelId: string | null = null;
    let primaryInputTokens: number | null = null;
    let primaryOutputTokens: number | null = null;
    let primaryTotalTokens: number | null = null;
    let primaryLatencyMs: number | null = null;
    let primaryRubric: PrimaryRubric | null = null;
    let aiFallbackUsed = false;

    if (isInkGateFail(inkRatio)) {
      result = gateResult(submissionId);
      scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
      aiFallbackUsed = true;
    } else {
      let scored = scoreStub();
      try {
        const imageBase64 = imageBuffer.toString('base64');
        const startedAt = Date.now();
        const ai = await invokeClaudeJson<any>(
          PRIMARY_MODEL_ID,
          primarySystemPrompt,
          buildPrimaryUser(String(resolvedPromptText || promptText || 'お題不明'), imageBase64),
        );
        primaryLatencyMs = Date.now() - startedAt;
        primaryModelId = ai.modelId;
        primaryInputTokens = ai.usage.inputTokens;
        primaryOutputTokens = ai.usage.outputTokens;
        primaryTotalTokens = ai.usage.totalTokens;
        const normalized = normalizePrimary(ai.data);
        scored = { ...scored, ...normalized };
        primaryRubric = normalized.rubric;
      } catch (err) {
        console.error('primary_bedrock_failed', err);
        aiFallbackUsed = true;
      }
      const jitteredScore = scored.score >= 60
        ? clampScore(scored.score + computeDeterministicJitter(submissionId))
        : scored.score;
      result = {
        submissionId,
        score: jitteredScore,
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
        promptText: resolvedPromptText || '',
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
        primaryModelId,
        primaryInputTokens,
        primaryOutputTokens,
        primaryTotalTokens,
        primaryLatencyMs,
        primaryRubric,
        aiFallbackUsed,
        tokenRecordedAt,
        secondaryModelId: null,
        secondaryInputTokens: null,
        secondaryOutputTokens: null,
        secondaryTotalTokens: null,
        secondaryLatencyMs: null,
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
