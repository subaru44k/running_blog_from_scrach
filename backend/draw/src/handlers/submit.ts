import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { json, options, parseJson } from '../lib/http';
import { rateLimit } from '../lib/rateLimit';
import { getObjectBuffer } from '../lib/s3';
import { computeInkRatio, isInkGateFail } from '../lib/inkGate';
import { scoreStub } from '../lib/scoreStub';
import { ddb } from '../lib/ddb';
import { DRAW_BUCKET, DRAW_TABLE, OPENAI_API_KEY_SECRET_ID, PRIMARY_MODEL_ID, PRIMARY_PROVIDER, RATE_LIMIT_SUBMIT, SUBMISSION_TTL_DAYS } from '../lib/env';
import { getClientIp } from '../lib/ip';
import type { SubmitResult } from '../types';
import { buildPrimaryUser, primarySystemPrompt } from '../lib/aiPrompts';
import { resolveDrawPrompt } from '../lib/prompt';
import { invokeOpenAIJson } from '../lib/openai';
import { estimateOpenAiUsd } from '../lib/pricing';

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
    rubric.promptMatch * 0.30 +
    rubric.shapeClarity * 0.22 +
    rubric.completeness * 0.16 +
    rubric.composition * 0.14 +
    rubric.creativity * 0.10 +
    rubric.lineStability * 0.08;
  return clampScore(Math.max(20, weighted * 14 - 10));
};

const toLegacyBreakdown = (rubric: PrimaryRubric) => ({
  likeness: clampScore((rubric.promptMatch * 0.6 + rubric.shapeClarity * 0.4) * 10),
  composition: clampScore((rubric.composition * 0.7 + rubric.completeness * 0.3) * 10),
  originality: clampScore((rubric.creativity * 0.7 + rubric.lineStability * 0.3) * 10),
});

const normalizePrimary = (input: any) => {
  const rubric = normalizeRubric(input);
  const breakdown = toLegacyBreakdown(rubric);
  const score = computeScoreFromRubric(rubric);
  const oneLiner = String(input?.oneLiner || '前向きで良い雰囲気です。').trim().slice(0, 220);
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
    let primaryProvider: string | null = null;
    let primaryModelId: string | null = null;
    let primaryInputTokens: number | null = null;
    let primaryOutputTokens: number | null = null;
    let primaryTotalTokens: number | null = null;
    let primaryLatencyMs: number | null = null;
    let primaryEstimatedCostUsd: number | null = null;
    let primaryRubric: PrimaryRubric | null = null;
    let aiFallbackUsed = false;

    if (isInkGateFail(inkRatio)) {
      result = gateResult(submissionId);
      scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
      aiFallbackUsed = true;
    } else {
      let scored = scoreStub();
      try {
        if (PRIMARY_PROVIDER !== 'openai') {
          throw new Error(`Unsupported PRIMARY_PROVIDER: ${PRIMARY_PROVIDER}`);
        }
        if (!OPENAI_API_KEY_SECRET_ID) {
          throw new Error('Missing OPENAI_API_KEY_SECRET_ID');
        }
        const imageBase64 = imageBuffer.toString('base64');
        const startedAt = Date.now();
        const ai = await invokeOpenAIJson<any>(
          PRIMARY_MODEL_ID,
          primarySystemPrompt,
          buildPrimaryUser(String(resolvedPromptText || promptText || 'お題不明'), imageBase64).map((part) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: `data:${part.source.media_type};base64,${part.source.data}` }
          ),
        );
        primaryLatencyMs = Date.now() - startedAt;
        primaryProvider = PRIMARY_PROVIDER;
        primaryModelId = ai.modelId;
        primaryInputTokens = ai.usage.inputTokens;
        primaryOutputTokens = ai.usage.outputTokens;
        primaryTotalTokens = ai.usage.totalTokens;
        primaryEstimatedCostUsd = estimateOpenAiUsd(primaryInputTokens, primaryOutputTokens);
        const normalized = normalizePrimary(ai.data);
        scored = { ...scored, ...normalized };
        primaryRubric = normalized.rubric;
      } catch (err) {
        console.error('primary_openai_failed', err);
        aiFallbackUsed = true;
      }
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
      secondaryStatus = 'skipped';
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
        primaryProvider,
        primaryModelId,
        primaryInputTokens,
        primaryOutputTokens,
        primaryTotalTokens,
        primaryLatencyMs,
        primaryEstimatedCostUsd,
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

    return json(200, result, origin);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json(status, { error: err?.message || 'failed' }, origin);
  }
};
