import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { json, options, parseJson } from '../lib/http.js';
import { rateLimit } from '../lib/rateLimit.js';
import { getObjectBuffer } from '../lib/s3.js';
import { computeInkRatio, isInkGateFail } from '../lib/inkGate.js';
import { scoreStub } from '../lib/scoreStub.js';
import { ddb } from '../lib/ddb.js';
import { DRAW_BUCKET, DRAW_TABLE, OPENAI_API_KEY_SECRET_ID, PRIMARY_MODEL_ID, PRIMARY_PROVIDER, PRACTICE_SUBMISSION_TTL_DAYS, RATE_LIMIT_SUBMIT, SUBMISSION_TTL_DAYS } from '../lib/env.js';
import { getClientIp } from '../lib/ip.js';
import type { SubmitResult } from '../types.js';
import { buildPrimaryUser, primarySystemPrompt } from '../lib/aiPrompts.js';
import { getCurrentMonthJst, resolveDrawPrompt } from '../lib/prompt.js';
import { invokeOpenAIJson } from '../lib/openai.js';
import { estimateOpenAiUsd } from '../lib/pricing.js';
import { getCurrentRank } from '../lib/ranking.js';

const gateResult = (submissionId: string, rankingEligible: boolean): SubmitResult => ({
  submissionId,
  score: 0,
  breakdown: { likeness: 0, composition: 0, originality: 0 },
  oneLiner: '線がほとんど見えないため、採点をスキップしました。',
  tips: [],
  childOneLiner: 'せんが ほとんど みえなかったので、てんすうは つけなかったよ。',
  childTips: [],
  rankingEligible,
  isRanked: false,
});

const makeScoreSortKey = (score: number, createdAt: string, submissionId: string) => {
  const inv = String(100 - Math.min(100, Math.max(0, score))).padStart(3, '0');
  return `${inv}#${createdAt}#${submissionId}`;
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
  let score = weighted * 10;
  if (rubric.promptMatch >= 8) score += 5;
  if (rubric.shapeClarity >= 6) score += 2;
  if (rubric.completeness >= 6) score += 2;
  if (rubric.lineStability >= 6) score += 3;
  if (rubric.promptMatch >= 8 && rubric.shapeClarity >= 6 && rubric.completeness >= 6 && rubric.lineStability >= 6) score += 5;
  if (rubric.promptMatch <= 4) score -= 6;
  return clampScore(Math.max(20, score));
};

const toLegacyBreakdown = (rubric: PrimaryRubric) => ({
  likeness: clampScore((rubric.promptMatch * 0.6 + rubric.shapeClarity * 0.4) * 10),
  composition: clampScore((rubric.composition * 0.7 + rubric.completeness * 0.3) * 10),
  originality: clampScore((rubric.creativity * 0.7 + rubric.lineStability * 0.3) * 10),
});

const CHILD_TEXT_PATTERN = /^[\u3040-\u309f\u3000 、。！？・\s]+$/u;

const normalizeChildText = (value: unknown, fallback: string) => {
  const text = String(value || '').trim();
  return text && CHILD_TEXT_PATTERN.test(text) ? text : fallback;
};

const normalizeChildTip = (value: unknown) => {
  const text = normalizeChildText(value, '');
  return text && text.length <= 16 && !/[。！？]/u.test(text) ? text : '';
};

const normalizePrimary = (input: any) => {
  const rubric = normalizeRubric(input);
  const breakdown = toLegacyBreakdown(rubric);
  const score = computeScoreFromRubric(rubric);
  const reviewParts = [
    String(input?.review?.summary || '').trim(),
    String(input?.review?.goodPoint || '').trim(),
    String(input?.review?.improvement || '').trim(),
    String(input?.review?.nextStep || '').trim(),
  ].filter(Boolean);
  const fallbackOneLiner = String(input?.oneLiner || '前向きで良い雰囲気です。').trim();
  const oneLiner = (reviewParts.length > 0 ? reviewParts.join(' ') : fallbackOneLiner).slice(0, 220);
  const tipsRaw = Array.isArray(input?.tips) ? input.tips : [];
  const tips = tipsRaw.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 3);
  const childReviewParts = [
    input?.childReview?.summary,
    input?.childReview?.goodPoint,
    input?.childReview?.improvement,
    input?.childReview?.nextStep,
  ].map((part) => normalizeChildText(part, '')).filter(Boolean);
  const childOneLiner = childReviewParts.length === 4
    ? childReviewParts.join(' ').slice(0, 220)
    : 'えの かたちが よく みえるね。げんきな せんが すてきだよ。つぎは もっと おおきく かくと、もっと わかりやすくなるよ。たのしく かいてみよう。';
  const childTipsRaw = Array.isArray(input?.childTips) ? input.childTips : [];
  const childTips = childTipsRaw
    .map((tip: unknown) => normalizeChildTip(tip))
    .filter(Boolean)
    .slice(0, 3);
  return {
    score,
    breakdown,
    oneLiner,
    tips,
    childOneLiner,
    childTips: childTips.length >= 2 ? childTips : ['おおきな かたち', 'げんきな せん'],
    rubric,
  };
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
      const m = /^draw\/(?:practice\/)?(prompt-\d{4}-\d{2})\/[^/]+\.png$/.exec(String(imageKey));
      return m ? m[1] : undefined;
    })();
    const prompt = resolveDrawPrompt({ promptId: imagePromptId || promptIdRaw, month });
    const promptId = prompt.promptId;
    const resolvedPromptText = prompt.promptText;
    const rankingEligible = prompt.month === getCurrentMonthJst();
    const ip = getClientIp(event);
    await rateLimit(`ip#submit#${ip}`, RATE_LIMIT_SUBMIT);

    const imageBuffer = await getObjectBuffer(DRAW_BUCKET, imageKey);
    const inkRatio = computeInkRatio(imageBuffer);
    const createdAt = new Date().toISOString();
    const submissionTtlDays = rankingEligible ? SUBMISSION_TTL_DAYS : PRACTICE_SUBMISSION_TTL_DAYS;
    const expiresAt = Math.floor(Date.now() / 1000) + submissionTtlDays * 86400;

    let result: SubmitResult;
    let isRanked = false;
    let rank: number | undefined = undefined;
    let scoreSortKey: string | undefined;
    let secondaryStatus: 'pending' | 'skipped' | 'failed' | 'done' = 'skipped';
    const tokenRecordedAt = new Date().toISOString();
    let primaryProvider: string | null = null;
    let primaryModelId: string | null = null;
    let primaryInputTokens: number | null = null;
    let primaryCachedInputTokens: number | null = null;
    let primaryCacheWriteTokens: number | null = null;
    let primaryOutputTokens: number | null = null;
    let primaryTotalTokens: number | null = null;
    let primaryLatencyMs: number | null = null;
    let primaryEstimatedCostUsd: number | null = null;
    let primaryRubric: PrimaryRubric | null = null;
    let aiFallbackUsed = false;

    if (isInkGateFail(inkRatio)) {
      result = gateResult(submissionId, rankingEligible);
      if (rankingEligible) scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
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
          buildPrimaryUser(String(resolvedPromptText || promptText || 'お題不明'), imageBase64).map((part: any) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: `data:${part.source.media_type};base64,${part.source.data}` }
          ),
        );
        primaryLatencyMs = Date.now() - startedAt;
        primaryProvider = PRIMARY_PROVIDER;
        primaryModelId = ai.modelId;
        primaryInputTokens = ai.usage.inputTokens;
        primaryCachedInputTokens = ai.usage.cachedInputTokens;
        primaryCacheWriteTokens = ai.usage.cacheWriteTokens;
        primaryOutputTokens = ai.usage.outputTokens;
        primaryTotalTokens = ai.usage.totalTokens;
        primaryEstimatedCostUsd = estimateOpenAiUsd(ai.usage, ai.modelId);
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
        childOneLiner: scored.childOneLiner,
        childTips: scored.childTips,
        rankingEligible,
        isRanked: false,
      };

      if (rankingEligible) {
        scoreSortKey = makeScoreSortKey(result.score, createdAt, submissionId);
        rank = await getCurrentRank(promptId, scoreSortKey);
        isRanked = typeof rank === 'number' && rank <= 20;
        result.isRanked = isRanked;
        if (isRanked) result.rank = rank;
      }
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
        childOneLiner: result.childOneLiner,
        childTips: result.childTips,
        childReviewVersion: 'v1-four-sentence',
        rankingEligible,
        rankingStatus: rankingEligible ? 'active' : 'practice',
        isRanked: result.isRanked,
        rank: result.rank,
        secondaryStatus,
        enrichedComment: null,
        secondaryAttempts: 0,
        primaryProvider,
        primaryModelId,
        primaryInputTokens,
        primaryCachedInputTokens,
        primaryCacheWriteTokens,
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
        ...(rankingEligible && scoreSortKey
          ? { GSI1PK: promptId, scoreSortKey }
          : {}),
      },
    }));

    return json(200, result, origin);
  } catch (err: any) {
    const status = err?.statusCode || 500;
    return json(status, { error: err?.message || 'failed' }, origin);
  }
};
