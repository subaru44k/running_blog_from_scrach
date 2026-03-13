import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PNG } from 'pngjs';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const months = process.argv.slice(2);
const targetMonths = months.length > 0 ? months : ['2026-02', '2026-03'];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const bedrock = new BedrockRuntimeClient({ region: REGION });

const primarySystemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。`;

const buildPrimaryUser = (promptText, imageBase64) => ([
  {
    type: 'text',
    text:
      `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
      `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
      `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
      `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は平均的、7はやや良い、8は明確に良い、9はかなり良い、10はごく少数の例外的に強い作品のみ。` +
      `平均的なユーザー作品に対して安易に7や8を付けないこと。` +
      `rubricは必ず1点刻みの整数で評価すること。` +
      `6項目のうち少なくとも3項目は同じ値にしないこと。` +
      `弱い点が見えたら4以下を使うこと。強みが明確なら9以上を使うこと。` +
      `oneLinerとtipsは日本語のみで出力し、英語表現は使わないこと。` +
      `tipsは体言止めの短い語句にすること。`,
  },
  {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
  },
]);

const toInt = (v, fallback = 0) => {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const clampScore = (v) => Math.max(0, Math.min(100, toInt(v)));
const clampRubric = (v) => Math.max(0, Math.min(10, toInt(v, 5)));

const normalizeRubric = (input) => {
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
  return {
    promptMatch: clampRubric((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10),
    composition: clampRubric((input?.breakdown?.composition ?? input?.composition ?? 50) / 10),
    shapeClarity: clampRubric((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10),
    lineStability: clampRubric(((input?.breakdown?.composition ?? input?.composition ?? 50) * 0.5 + (input?.breakdown?.originality ?? input?.originality ?? 50) * 0.5) / 10),
    creativity: clampRubric((input?.breakdown?.originality ?? input?.originality ?? 50) / 10),
    completeness: clampRubric(((input?.score ?? 60) * 0.8 + (input?.breakdown?.composition ?? input?.composition ?? 50) * 0.2) / 10),
  };
};

const toLegacyBreakdown = (rubric) => ({
  likeness: clampScore((rubric.promptMatch * 0.6 + rubric.shapeClarity * 0.4) * 10),
  composition: clampScore((rubric.composition * 0.7 + rubric.completeness * 0.3) * 10),
  originality: clampScore((rubric.creativity * 0.7 + rubric.lineStability * 0.3) * 10),
});

const computeLatentScoreFromRubric = (rubric) => {
  const values = [
    rubric.promptMatch,
    rubric.composition,
    rubric.shapeClarity,
    rubric.lineStability,
    rubric.creativity,
    rubric.completeness,
  ];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const strong = values.filter((v) => v >= 8).length;
  const weak = values.filter((v) => v <= 4).length;
  let score = 12 + avg * 8.8;
  score += strong * 3.2;
  score += rubric.promptMatch >= 8 && rubric.shapeClarity >= 7 ? 5 : 0;
  score += rubric.creativity >= 7 ? 2 : 0;
  score -= weak * 4.5;
  score -= rubric.promptMatch <= 4 ? 6 : 0;
  score -= rubric.completeness <= 4 ? 4 : 0;
  return Math.max(0, Math.min(100, score));
};

const stretchPrimaryScore = (latentScore) => {
  const normalized = Math.max(0, Math.min(1, (latentScore - 25) / 48));
  return clampScore(20 + normalized * 80);
};

const computeScoreFromRubric = (rubric) => {
  const latentScore = computeLatentScoreFromRubric(rubric);
  return stretchPrimaryScore(latentScore);
};

const makeScoreSortKey = (score, createdAt, submissionId) => {
  const inv = String(100 - Math.min(100, Math.max(0, score))).padStart(3, '0');
  return `${inv}#${createdAt}#${submissionId}`;
};

const readBodyString = async (body) => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  return '';
};

const extractText = (payload) => {
  const content = payload?.content;
  if (!Array.isArray(content)) return '';
  return content.filter((c) => c?.type === 'text').map((c) => c?.text || '').join('\n').trim();
};

const findJsonBlock = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
};

const stripCodeFence = (text) => String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

const sanitizeJsonText = (text) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const unquoteJsonString = (v) => {
  try {
    return JSON.parse(`"${String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  } catch {
    return String(v || '').trim();
  }
};

const parseByRegexFallback = (text) => {
  const score = Number((text.match(/"score"\s*:\s*(-?\d+)/) || [])[1]);
  const promptMatch = Number((text.match(/"promptMatch"\s*:\s*(-?\d+)/) || [])[1]);
  const composition = Number((text.match(/"composition"\s*:\s*(-?\d+)/) || [])[1]);
  const shapeClarity = Number((text.match(/"shapeClarity"\s*:\s*(-?\d+)/) || [])[1]);
  const lineStability = Number((text.match(/"lineStability"\s*:\s*(-?\d+)/) || [])[1]);
  const creativity = Number((text.match(/"creativity"\s*:\s*(-?\d+)/) || [])[1]);
  const completeness = Number((text.match(/"completeness"\s*:\s*(-?\d+)/) || [])[1]);

  const oneLinerRaw = (text.match(/"oneLiner"\s*:\s*"([\s\S]*?)"\s*,\s*"tips"/) || [])[1]
    || (text.match(/"oneLiner"\s*:\s*"([\s\S]*?)"/) || [])[1]
    || '';

  const tipsBlock = (text.match(/"tips"\s*:\s*\[([\s\S]*?)\]/) || [])[1] || '';
  const tips = [];
  const tipRe = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = tipRe.exec(tipsBlock)) !== null) {
    tips.push(unquoteJsonString(m[1]));
  }

  const hasRubric =
    Number.isFinite(promptMatch)
    || Number.isFinite(composition)
    || Number.isFinite(shapeClarity)
    || Number.isFinite(lineStability)
    || Number.isFinite(creativity)
    || Number.isFinite(completeness);

  if (!hasRubric && !Number.isFinite(score)) {
    throw new Error('regex fallback parse failed');
  }

  return {
    rubric: hasRubric
      ? {
        promptMatch: Number.isFinite(promptMatch) ? promptMatch : undefined,
        composition: Number.isFinite(composition) ? composition : undefined,
        shapeClarity: Number.isFinite(shapeClarity) ? shapeClarity : undefined,
        lineStability: Number.isFinite(lineStability) ? lineStability : undefined,
        creativity: Number.isFinite(creativity) ? creativity : undefined,
        completeness: Number.isFinite(completeness) ? completeness : undefined,
      }
      : undefined,
    score: Number.isFinite(score) ? score : undefined,
    oneLiner: unquoteJsonString(oneLinerRaw),
    tips: tips.slice(0, 3),
  };
};

const escapeControlsInJsonStrings = (text) => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
};

const parseModelJson = (text) => {
  const candidate = findJsonBlock(stripCodeFence(String(text || '').trim()));
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(sanitizeJsonText(candidate));
    } catch {
      try {
        return JSON.parse(escapeControlsInJsonStrings(candidate));
      } catch {
        return parseByRegexFallback(candidate);
      }
    }
  }
};

const getObjectBuffer = async (bucket, key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error('S3 body is empty');
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const computeInkRatio = (buffer) => {
  const png = PNG.sync.read(buffer);
  const { data, width, height } = png;
  const total = width * height;
  if (!total) return 0;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const notInk = a <= 10 || (r >= 245 && g >= 245 && b >= 245);
    if (!notInk) ink += 1;
  }
  return ink / total;
};

const invokePrimary = async (promptText, imageBase64) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: primarySystemPrompt,
    messages: [{ role: 'user', content: buildPrimaryUser(promptText, imageBase64) }],
  };
  const startedAt = Date.now();
  const out = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  }));
  const latencyMs = Date.now() - startedAt;
  const raw = await readBodyString(out.body);
  const parsed = raw ? JSON.parse(raw) : {};
  const text = extractText(parsed);
  const json = parseModelJson(text);
  const usage = parsed?.usage || {};
  return {
    data: json,
    usage: {
      inputTokens: toInt(usage.input_tokens),
      outputTokens: toInt(usage.output_tokens),
      totalTokens: toInt(usage.total_tokens ?? toInt(usage.input_tokens) + toInt(usage.output_tokens)),
    },
    latencyMs,
  };
};

const queryAllByPromptId = async (promptId) => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'promptId = :pk',
      ExpressionAttributeValues: { ':pk': promptId },
      ExclusiveStartKey,
    }));
    items.push(...(out.Items || []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const updateItem = async ({ promptId, submissionId, score, breakdown, oneLiner, tips, primaryRubric, primaryUsage, primaryLatencyMs, aiFallbackUsed, scoreSortKey, isRanked, rank }) => {
  const names = {
    '#s': 'score',
    '#b': 'breakdown',
    '#o': 'oneLiner',
    '#t': 'tips',
    '#g': 'GSI1PK',
    '#pr': 'primaryRubric',
    '#pm': 'primaryModelId',
    '#pit': 'primaryInputTokens',
    '#pot': 'primaryOutputTokens',
    '#ptt': 'primaryTotalTokens',
    '#pl': 'primaryLatencyMs',
    '#tr': 'tokenRecordedAt',
    '#af': 'aiFallbackUsed',
    '#ssk': 'scoreSortKey',
    '#ir': 'isRanked',
  };
  const values = {
    ':score': score,
    ':breakdown': breakdown,
    ':oneLiner': oneLiner,
    ':tips': tips,
    ':gsi1pk': promptId,
    ':rubric': primaryRubric,
    ':modelId': MODEL_ID,
    ':inputTokens': primaryUsage.inputTokens,
    ':outputTokens': primaryUsage.outputTokens,
    ':totalTokens': primaryUsage.totalTokens,
    ':latency': primaryLatencyMs,
    ':recordedAt': new Date().toISOString(),
    ':fallback': aiFallbackUsed,
    ':scoreSortKey': scoreSortKey,
    ':isRanked': isRanked,
  };

  let updateExpression = 'SET #s=:score, #b=:breakdown, #o=:oneLiner, #t=:tips, #g=:gsi1pk, #pr=:rubric, #pm=:modelId, #pit=:inputTokens, #pot=:outputTokens, #ptt=:totalTokens, #pl=:latency, #tr=:recordedAt, #af=:fallback, #ssk=:scoreSortKey, #ir=:isRanked';
  if (isRanked) {
    names['#rk'] = 'rank';
    values[':rank'] = rank;
    updateExpression += ', #rk=:rank';
  } else {
    updateExpression += ' REMOVE #rk';
    names['#rk'] = 'rank';
  }

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { promptId, submissionId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
};

const runMonth = async (month) => {
  const promptId = `prompt-${month}`;
  console.log(`\n=== Rescoring month ${month} (${promptId}) ===`);

  const items = await queryAllByPromptId(promptId);
  if (items.length === 0) {
    console.log('No items found.');
    return;
  }
  console.log(`Found items: ${items.length}`);

  const rescored = [];
  let fallbackCount = 0;

  for (const item of items) {
    const submissionId = String(item.submissionId);
    const createdAt = String(item.createdAt);
    const imageKey = String(item.imageKey);
    const oldScore = toInt(item.score);

    let score = 0;
    let breakdown = { likeness: 0, composition: 0, originality: 0 };
    let oneLiner = '線がほとんど見えないため、採点をスキップしました。';
    let tips = [];
    let primaryRubric = null;
    let aiFallbackUsed = false;
    let primaryUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let primaryLatencyMs = 0;

    try {
      const imageBuffer = await getObjectBuffer(BUCKET, imageKey);
      const inkRatio = computeInkRatio(imageBuffer);
      if (inkRatio < 0.001) {
        score = 0;
        breakdown = { likeness: 0, composition: 0, originality: 0 };
        oneLiner = '線がほとんど見えないため、採点をスキップしました。';
        tips = [];
        aiFallbackUsed = true;
      } else {
        const ai = await invokePrimary(String(item.promptText || 'お題不明'), imageBuffer.toString('base64'));
        primaryUsage = ai.usage;
        primaryLatencyMs = ai.latencyMs;
        const rubric = normalizeRubric(ai.data);
        score = computeScoreFromRubric(rubric);
        breakdown = toLegacyBreakdown(rubric);
        oneLiner = String(ai.data?.oneLiner || '前向きで良い雰囲気です。').slice(0, 90);
        const tipsRaw = Array.isArray(ai.data?.tips) ? ai.data.tips : [];
        tips = tipsRaw.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
        primaryRubric = rubric;
      }
    } catch (err) {
      aiFallbackUsed = true;
      fallbackCount += 1;
      console.error(`rescore_failed submissionId=${submissionId}`, err?.message || err);
      // keep previous values if rescoring failed
      score = oldScore;
      breakdown = item.breakdown || breakdown;
      oneLiner = item.oneLiner || oneLiner;
      tips = Array.isArray(item.tips) ? item.tips : [];
      primaryRubric = item.primaryRubric || null;
    }

    const scoreSortKey = makeScoreSortKey(score, createdAt, submissionId);
    rescored.push({
      promptId,
      submissionId,
      createdAt,
      oldScore,
      score,
      breakdown,
      oneLiner,
      tips,
      primaryRubric,
      primaryUsage,
      primaryLatencyMs,
      aiFallbackUsed,
      scoreSortKey,
    });
  }

  rescored.sort((a, b) => a.scoreSortKey.localeCompare(b.scoreSortKey));
  rescored.forEach((r, idx) => {
    r.isRanked = idx < 20;
    r.rank = idx < 20 ? idx + 1 : null;
  });

  for (const item of rescored) {
    await updateItem({
      promptId: item.promptId,
      submissionId: item.submissionId,
      score: item.score,
      breakdown: item.breakdown,
      oneLiner: item.oneLiner,
      tips: item.tips,
      primaryRubric: item.primaryRubric,
      primaryUsage: item.primaryUsage,
      primaryLatencyMs: item.primaryLatencyMs,
      aiFallbackUsed: item.aiFallbackUsed,
      scoreSortKey: item.scoreSortKey,
      isRanked: item.isRanked,
      rank: item.rank,
    });
  }

  console.log(`Updated items: ${rescored.length}`);
  console.log(`Fallback used: ${fallbackCount}`);
  console.log('\nTop 20 after rewrite:');
  console.log('|rank|submissionId|old|new|diff|');
  console.log('|-:|---|--:|--:|--:|');
  rescored.slice(0, 20).forEach((r, idx) => {
    console.log(`|${idx + 1}|${r.submissionId}|${r.oldScore}|${r.score}|${r.score - r.oldScore}|`);
  });
}

const main = async () => {
  console.log(`Region=${REGION} Table=${TABLE} Bucket=${BUCKET} Model=${MODEL_ID}`);
  for (const month of targetMonths) {
    await runMonth(month);
  }
};

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
