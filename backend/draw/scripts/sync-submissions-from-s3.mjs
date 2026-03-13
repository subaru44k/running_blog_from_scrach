import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PNG } from 'pngjs';
import { decodeTime } from 'ulid';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const CURRENT_TTL_DAYS = Number(process.env.SUBMISSION_TTL_DAYS || 45);
const ARCHIVE_TTL_DAYS = Number(process.env.ARCHIVE_TTL_DAYS || 3650);
const KEEP_LIMIT = Number(process.env.LEADERBOARD_KEEP_LIMIT || 20);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const bedrock = new BedrockRuntimeClient({ region: REGION });

const months = process.argv.slice(2);

const BASE_YEAR = 2026;
const BASE_MONTH = 2;
const TOPICS = [
  '熊', '猫', '犬', 'うさぎ', 'パンダ', 'きつね', 'ペンギン', 'フクロウ', 'イルカ', 'くじら',
  'ライオン', 'ゾウ', 'キリン', 'カメ', 'タコ', 'カニ', 'いちご', 'りんご', 'バナナ', 'コーヒーカップ',
  'ハンバーガー', 'おにぎり', '富士山', '雲', '雪だるま', '虹', '自転車', '電車', 'ロケット', '家',
  '観覧車', '桜', 'ひまわり', 'サボテン', 'ギター', 'ロボット',
];

const clampScore = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const clampRubric = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));

const jstMonthFromDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return year && month ? `${year}-${month}` : null;
};

const resolvePrompt = (month) => {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const diff = (year - BASE_YEAR) * 12 + (mon - BASE_MONTH);
  const idx = ((diff % TOPICS.length) + TOPICS.length) % TOPICS.length;
  const topic = TOPICS[idx];
  return {
    promptId: `prompt-${month}`,
    promptText: `30秒で${topic}を描いて`,
  };
};

const currentMonthJst = () => jstMonthFromDate(new Date());

const makeScoreSortKey = (score, createdAt, submissionId) => {
  const inv = String(100 - Math.min(100, Math.max(0, score))).padStart(3, '0');
  return `${inv}#${createdAt}#${submissionId}`;
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

const stripCodeFence = (text) => String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
const findJsonBlock = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
};
const sanitizeJsonText = (text) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
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

const parseByRegexFallback = (text) => {
  const num = (name) => {
    const m = text.match(new RegExp(`"${name}"\\s*:\\s*(-?\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  const oneLiner = (text.match(/"oneLiner"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/) || [])[1] || '';
  const tipsBlock = (text.match(/"tips"\s*:\s*\[([\s\S]*?)\]/) || [])[1] || '';
  const tips = [];
  const tipRe = /"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = tipRe.exec(tipsBlock)) !== null) {
    tips.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
  return {
    rubric: {
      promptMatch: num('promptMatch'),
      composition: num('composition'),
      shapeClarity: num('shapeClarity'),
      lineStability: num('lineStability'),
      creativity: num('creativity'),
      completeness: num('completeness'),
    },
    oneLiner: oneLiner.replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
    tips: tips.slice(0, 3),
  };
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

const normalizePrimary = (input) => {
  const rubric = {
    promptMatch: clampRubric(input?.rubric?.promptMatch),
    composition: clampRubric(input?.rubric?.composition),
    shapeClarity: clampRubric(input?.rubric?.shapeClarity),
    lineStability: clampRubric(input?.rubric?.lineStability),
    creativity: clampRubric(input?.rubric?.creativity),
    completeness: clampRubric(input?.rubric?.completeness),
  };
  return {
    rubric,
    score: computeScoreFromRubric(rubric),
    breakdown: toLegacyBreakdown(rubric),
    oneLiner: String(input?.oneLiner || '前向きで良い雰囲気です。').slice(0, 90),
    tips: Array.isArray(input?.tips) ? input.tips.map((v) => String(v).trim()).filter(Boolean).slice(0, 3) : [],
  };
};

const invokePrimary = async (promptText, imageBase64) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: primarySystemPrompt,
    messages: [{ role: 'user', content: buildPrimaryUser(promptText, imageBase64) }],
  };
  const out = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  }));
  const raw = await readBodyString(out.body);
  const parsed = raw ? JSON.parse(raw) : {};
  const text = extractText(parsed);
  return parseModelJson(text);
};

const getObjectBuffer = async (key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!out.Body) throw new Error('S3 body is empty');
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const listAllKeys = async () => {
  const result = [];
  let token;
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'draw/', ContinuationToken: token }));
    for (const item of out.Contents || []) {
      if (item.Key) result.push(item.Key);
    }
    token = out.NextContinuationToken;
  } while (token);
  return result;
};

const classifyKey = (key) => {
  const monthly = /^draw\/(prompt-\d{4}-\d{2})\/([0-9A-HJKMNP-TV-Z]{26})\.png$/.exec(key);
  if (monthly) return { key, promptIdFromKey: monthly[1], submissionId: monthly[2], legacy: false };
  const legacy = /^draw\/(prompt-\d{4}-\d{2}-\d{2})\/([0-9A-HJKMNP-TV-Z]{26})\.png$/.exec(key);
  if (legacy) return { key, promptIdFromKey: legacy[1], submissionId: legacy[2], legacy: true };
  return null;
};

const migrateKeyIfNeeded = async (row, targetPromptId) => {
  const targetKey = `draw/${targetPromptId}/${row.submissionId}.png`;
  if (targetKey === row.key) return row.key;
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${row.key}`,
    Key: targetKey,
  }));
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: row.key }));
  return targetKey;
};

const main = async () => {
  const currentMonth = currentMonthJst();
  const grouped = new Map();
  for (const key of await listAllKeys()) {
    const parsed = classifyKey(key);
    if (!parsed) continue;
    const createdAt = new Date(decodeTime(parsed.submissionId)).toISOString();
    const logicalMonth = jstMonthFromDate(new Date(createdAt));
    if (!logicalMonth) continue;
    if (months.length > 0 && !months.includes(logicalMonth)) continue;
    if (!grouped.has(logicalMonth)) grouped.set(logicalMonth, []);
    grouped.get(logicalMonth).push({ ...parsed, createdAt });
  }

  for (const month of [...grouped.keys()].sort()) {
    const prompt = resolvePrompt(month);
    const promptId = prompt.promptId;
    const archiveMonth = month < currentMonth;
    const existingMonthRows = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'promptId = :pk',
      ExpressionAttributeValues: { ':pk': promptId },
      ProjectionExpression: 'submissionId',
    }));
    const rows = [];

    for (const item of grouped.get(month)) {
      const existing = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { promptId, submissionId: item.submissionId },
      }));
      const imageKey = await migrateKeyIfNeeded(item, promptId);
      const buffer = await getObjectBuffer(imageKey);
      const inkRatio = computeInkRatio(buffer);
      const normalized = inkRatio < 0.001
        ? {
          rubric: null,
          score: 0,
          breakdown: { likeness: 0, composition: 0, originality: 0 },
          oneLiner: '線がほとんど見えないため、採点をスキップしました。',
          tips: [],
        }
        : normalizePrimary(await invokePrimary(prompt.promptText, buffer.toString('base64')));
      rows.push({
        submissionId: item.submissionId,
        createdAt: item.createdAt,
        imageKey,
        nickname: existing.Item?.nickname || '匿名',
        secondaryStatus: existing.Item?.secondaryStatus || 'skipped',
        enrichedComment: existing.Item?.enrichedComment ?? null,
        secondaryAttempts: existing.Item?.secondaryAttempts ?? 0,
        ...normalized,
      });
    }

    rows.sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.submissionId.localeCompare(b.submissionId));
    const keepRows = archiveMonth ? rows.slice(0, KEEP_LIMIT) : rows;
    const keepIds = new Set(keepRows.map((row) => row.submissionId));
    const expiresAt = Math.floor(Date.now() / 1000) + (archiveMonth ? ARCHIVE_TTL_DAYS : CURRENT_TTL_DAYS) * 86400;

    for (const [idx, row] of keepRows.entries()) {
      const scoreSortKey = makeScoreSortKey(row.score, row.createdAt, row.submissionId);
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          promptId,
          submissionId: row.submissionId,
          createdAt: row.createdAt,
          expiresAt,
          nickname: row.nickname,
          promptText: prompt.promptText,
          imageKey: row.imageKey,
          score: row.score,
          breakdown: row.breakdown,
          oneLiner: row.oneLiner,
          tips: row.tips,
          isRanked: idx < KEEP_LIMIT,
          rank: idx + 1,
          scoreSortKey,
          GSI1PK: promptId,
          GSI1SK: scoreSortKey,
          secondaryStatus: row.secondaryStatus,
          enrichedComment: row.enrichedComment,
          secondaryAttempts: row.secondaryAttempts,
          primaryRubric: row.rubric,
        },
      }));
    }

    if (archiveMonth) {
      for (const row of rows.filter((r) => !keepIds.has(r.submissionId))) {
        await ddb.send(new DeleteCommand({
          TableName: TABLE,
          Key: { promptId, submissionId: row.submissionId },
        }));
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: row.imageKey }));
      }
    }

    const staleIds = (existingMonthRows.Items || [])
      .map((item) => item.submissionId)
      .filter((submissionId) => submissionId && !keepIds.has(submissionId));
    for (const submissionId of staleIds) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { promptId, submissionId },
      }));
    }

    console.log(JSON.stringify({
      month,
      promptId,
      scanned: rows.length,
      kept: keepRows.length,
      archiveMonth,
      top5: keepRows.slice(0, 5).map((row, idx) => ({ rank: idx + 1, submissionId: row.submissionId, score: row.score })),
    }));
  }
};

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
