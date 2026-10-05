import { DynamoDBClient, ExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';

const loadLocalEnv = (path) => {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
};

loadLocalEnv(resolve(process.cwd(), '.env.local'));

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const MONTH = process.argv[2] || '2026-02';
const LIMIT = Number(process.argv[3] || 20);
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultBase = `artifacts/model-compare-${MONTH}-${runTimestamp}`;
const OUTPUT_PATH = resolve(process.cwd(), process.env.MODEL_COMPARE_OUT || `${defaultBase}.html`);
const JSON_OUTPUT_PATH = OUTPUT_PATH.replace(/\.html?$/i, '.json');
const RAW_OUTPUT_PATH = JSON_OUTPUT_PATH.replace(/\.json$/i, '.raw.json');
const TEXT_OUTPUT_PATH = JSON_OUTPUT_PATH.replace(/\.json$/i, '.txt');
const PROMPT_TEXT = process.env.MODEL_COMPARE_PROMPT
  || (MONTH === '2026-02' ? '30秒で熊を描いて' : MONTH === '2026-03' ? '30秒で猫を描いて' : '30秒でお題の絵を描いて');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || '';
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 90000);
const OPENAI_PRICING_USD_PER_MILLION = {
  'gpt-5-mini': { input: 0.25, cachedInput: 0.025, cacheWrite: 0.3125, output: 2.0, source: 'https://developers.openai.com/api/docs/models/gpt-5-mini' },
  'gpt-5.6-luna': { input: 0.20, cachedInput: 0.02, cacheWrite: 0.25, output: 1.20, source: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna' },
  'gpt-6-luna': { input: 0.10, cachedInput: 0.01, cacheWrite: 0.125, output: 0.50, source: 'https://developers.openai.com/api/docs/models/gpt-6-luna' },
};
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const OPENAI_MODELS = String(process.env.OPENAI_MODELS || 'gpt-4.1-mini,gpt-5-mini,gpt-5-nano')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const HAIKU_MODEL = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const PROVIDER_FILTER = new Set(
  String(process.env.MODEL_COMPARE_ONLY || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const OPENAI_MODEL_LABELS = {
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gpt-6-luna': 'GPT-6 Luna',
};

const ddb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const bedrock = new BedrockRuntimeClient({ region: REGION });

const PRIMARY_SYSTEM_PROMPT = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。
講評はやさしく親しみのある口調にしてください。
読んだ人が「また描いてみたい」と思える、あたたかい雰囲気を大切にしてください。`;

const buildPrimaryUserText = (promptText) =>
  `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
  `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
  `"review":{"summary":"全体の印象を1文","goodPoint":"良い点を1文","improvement":"改善点を1文","nextStep":"次の一手を1文"},"tips":["短い名詞句を2-3個"],` +
  `"childReview":{"summary":"4歳向けの全体の印象を1文","goodPoint":"4歳向けの良い点を1文","improvement":"4歳向けの工夫を1文","nextStep":"4歳向けの次の一手を1文"},"childTips":["4歳向けの短い語句を2-3個"]}\n` +
  `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は普通に伝わる、7は普通より明らかに良い、8はかなり珍しい、9はごく少数の強い作品、10は例外的な作品のみ。` +
  `rubricは必ず1点刻みの整数で評価すること。` +
  `各項目は自然に評価し、同じ値が複数あってもよい。` +
  `30秒お絵かきでは、普通に伝わる絵でも多くの項目は5-6に収まることが多い。認識できるだけで7-8を付けないこと。` +
  `promptMatch は最も厳しく評価すること。最初の一目でお題だと分からない場合は高くしないこと。` +
  `promptMatch の目安: 9-10は初見で迷わずお題だと分かる、7-8はお題だと分かるが曖昧さが残る、5-6は関連は感じるが別のものにも見える、3-4は別のものに見える、0-2はお題外れ。` +
  `shapeClarity, composition, completeness も甘くしないこと。形が粗い、輪郭が不安定、画面内でまとまりが弱い、未完成に見える場合は4-6を基本とすること。` +
  `creativity は珍しさだけで高くしないこと。見やすさや魅力につながる工夫がある場合だけ高くすること。` +
  `読みにくい絵や未完成の絵には低い点を付けてよい。明確に良い点がある場合だけ高い点を付けること。` +
  `review の4項目はすべて必須で、日本語1文ずつにすること。summary では絵全体の印象を1文で述べること。` +
  `goodPoint では良い点を1つ具体的に褒めること。improvement では次に良くなる具体的な工夫を1つだけやさしく伝えること。` +
  `nextStep ではもう1つの改善点または次の一手を短く伝え、前向きに締めること。` +
  `4項目とも対象の絵に触れた具体的内容にし、汎用的な褒め言葉だけで済ませないこと。review のどれかを省略したり、空文字にしたりしてはいけない。` +
  `review 全体では必ず4文になるようにすること。summary と goodPoint は別内容にすること。improvement と nextStep も別内容にすること。` +
  `先生の講評のように固すぎる言い方は避け、ゲームらしい親しみやすさを出すこと。` +
  `良い点は先にしっかり伝え、改善点も「次はこうするともっと楽しい」「こうするともっと伝わる」のように前向きに書くこと。` +
  `冷たく感じる表現、突き放す表現、事務的すぎる表現は避けること。` +
  `「かわいらしい」「たのしい」「いい感じ」など、やわらかい日本語を自然に使ってよい。人格否定や断定的な否定語は使わないこと。` +
  `tipsは日本語のみで出力し、英語表現は使わないこと。tipsは体言止めの短い語句にすること。` +
  `childReviewはreviewと同じ絵の内容を、4歳の子どもが自分で読めることばに言い換えること。` +
  `childReviewの4項目はすべて必須で、ひらがなだけの短い1文ずつにすること。漢字、カタカナ、英字、数字は一切使わないこと。` +
  `childReviewでは難しい美術用語を避け、「かたち」「せん」「おおきさ」「ばしょ」など日常的なことばを使うこと。` +
  `childReviewでも、よいところを先に伝え、直す指示ではなく「こうすると もっと たのしくなるよ」のように前向きに伝えること。` +
  `childTipsはひらがなだけの短い語句にすること。漢字、カタカナ、英字、数字は一切使わないこと。`;

const DRAW_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rubric', 'review', 'tips', 'childReview', 'childTips'],
  properties: {
    rubric: {
      type: 'object',
      additionalProperties: false,
      required: ['promptMatch', 'composition', 'shapeClarity', 'lineStability', 'creativity', 'completeness'],
      properties: Object.fromEntries(['promptMatch', 'composition', 'shapeClarity', 'lineStability', 'creativity', 'completeness'].map((key) => [key, { type: 'integer', minimum: 0, maximum: 10 }])),
    },
    review: {
      type: 'object', additionalProperties: false,
      required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
      properties: Object.fromEntries(['summary', 'goodPoint', 'improvement', 'nextStep'].map((key) => [key, { type: 'string' }])),
    },
    tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
    childReview: {
      type: 'object', additionalProperties: false,
      required: ['summary', 'goodPoint', 'improvement', 'nextStep'],
      properties: Object.fromEntries(['summary', 'goodPoint', 'improvement', 'nextStep'].map((key) => [key, { type: 'string' }])),
    },
    childTips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
  },
};

const toInt = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const clampRubric = (v) => {
  const numeric = Number(v ?? 5);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(10, Math.round(numeric))) : 5;
};
const clampScore = (v) => Math.max(0, Math.min(100, toInt(v)));

const normalizeRubric = (input) => ({
  promptMatch: clampRubric(input?.rubric?.promptMatch),
  composition: clampRubric(input?.rubric?.composition),
  shapeClarity: clampRubric(input?.rubric?.shapeClarity),
  lineStability: clampRubric(input?.rubric?.lineStability),
  creativity: clampRubric(input?.rubric?.creativity),
  completeness: clampRubric(input?.rubric?.completeness),
});

const computeScore = (r) => {
  const weighted =
    r.promptMatch * 0.30 +
    r.shapeClarity * 0.22 +
    r.completeness * 0.16 +
    r.composition * 0.14 +
    r.creativity * 0.10 +
    r.lineStability * 0.08;
  let score = weighted * 10;
  if (r.promptMatch >= 8) score += 5;
  if (r.shapeClarity >= 6) score += 2;
  if (r.completeness >= 6) score += 2;
  if (r.lineStability >= 6) score += 3;
  if (r.promptMatch >= 8 && r.shapeClarity >= 6 && r.completeness >= 6 && r.lineStability >= 6) score += 5;
  if (r.promptMatch <= 4) score -= 6;
  return clampScore(Math.max(20, score));
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

const parseJson = (text) => {
  const candidate = findJsonBlock(stripCodeFence(text));
  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(sanitizeJsonText(candidate));
    } catch {
      return JSON.parse(escapeControlsInJsonStrings(candidate));
    }
  }
};

const parseJsonLoose = (text) => {
  try {
    return parseJson(text);
  } catch (error) {
    const promptMatch = Number((text.match(/"promptMatch"\s*:\s*(-?\d+)/) || [])[1]);
    if (!Number.isFinite(promptMatch)) throw error;
    const composition = Number((text.match(/"composition"\s*:\s*(-?\d+)/) || [])[1]);
    const shapeClarity = Number((text.match(/"shapeClarity"\s*:\s*(-?\d+)/) || [])[1]);
    const lineStability = Number((text.match(/"lineStability"\s*:\s*(-?\d+)/) || [])[1]);
    const creativity = Number((text.match(/"creativity"\s*:\s*(-?\d+)/) || [])[1]);
    const completeness = Number((text.match(/"completeness"\s*:\s*(-?\d+)/) || [])[1]);
    const review = {
      summary: ((text.match(/"summary"\s*:\s*"([\s\S]*?)"/) || [])[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' '),
      goodPoint: ((text.match(/"goodPoint"\s*:\s*"([\s\S]*?)"/) || [])[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' '),
      improvement: ((text.match(/"improvement"\s*:\s*"([\s\S]*?)"/) || [])[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' '),
      nextStep: ((text.match(/"nextStep"\s*:\s*"([\s\S]*?)"/) || [])[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' '),
    };
    const tipsBlock = (text.match(/"tips"\s*:\s*\[([\s\S]*?)\]/) || [])[1] || '';
    const tips = Array.from(tipsBlock.matchAll(/"((?:\\.|[^"\\])*)"/g)).map((m) => m[1].replace(/\\"/g, '"'));
    return {
      rubric: { promptMatch, composition, shapeClarity, lineStability, creativity, completeness },
      review,
      tips,
    };
  }
};

const readBodyString = async (body) => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  return '';
};

const queryMonthRows = async () => {
  const promptId = `prompt-${MONTH}`;
  const out = await ddb.send(new ExecuteStatementCommand({
    Statement: `SELECT submissionId, createdAt, score, imageKey, promptText, oneLiner, aiFallbackUsed FROM "${TABLE}" WHERE promptId = ?`,
    Parameters: [{ S: promptId }],
  }));
  return (out.Items || [])
    .map((item) => unmarshall(item))
    .filter((item) => item?.submissionId && item?.imageKey)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, LIMIT);
};

const getObjectBuffer = async (key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!out.Body) throw new Error(`empty S3 body: ${key}`);
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const invokeHaiku = async (imageBase64, promptText) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: PRIMARY_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: buildPrimaryUserText(promptText) },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
      ],
    }],
  };
  const out = await bedrock.send(new InvokeModelCommand({
    modelId: HAIKU_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  }));
  const raw = await readBodyString(out.body);
  const parsed = raw ? JSON.parse(raw) : {};
  const text = Array.isArray(parsed?.content)
    ? parsed.content.filter((c) => c?.type === 'text').map((c) => c?.text || '').join('\n').trim()
    : '';
  return {
    provider: 'claude-3-haiku',
    usage: parsed?.usage || {},
    data: parseJsonLoose(text),
  };
};

const invokeOpenAI = async (modelId, imageBase64, promptText, reasoningEffort = '') => {
  const requestBody = {
    model: modelId,
    input: [{
      role: 'system',
      content: [{ type: 'input_text', text: PRIMARY_SYSTEM_PROMPT }],
    }, {
      role: 'user',
      content: [
        { type: 'input_text', text: buildPrimaryUserText(promptText) },
        { type: 'input_image', image_url: `data:image/png;base64,${imageBase64}` },
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'draw_primary_review',
        strict: true,
        schema: DRAW_REVIEW_SCHEMA,
      },
    },
  };
  if (reasoningEffort) {
    requestBody.reasoning = { effort: reasoningEffort };
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = Array.isArray(payload?.output)
    ? payload.output.flatMap((block) => block?.content || []).filter((c) => c?.type === 'output_text').map((c) => c?.text || '').join('\n').trim()
    : '';
  return {
    provider: modelId,
    usage: payload?.usage || {},
    data: parseJsonLoose(text),
    raw: payload,
  };
};

const invokeGemini = async (imageBase64, promptText) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: PRIMARY_SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
      contents: [{
        role: 'user',
        parts: [
          { text: buildPrimaryUserText(promptText) },
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n').trim() || '';
  return {
    provider: 'gemini-2.5-flash',
    usage: payload?.usageMetadata || {},
    data: parseJsonLoose(text),
  };
};

const openAiProviders = OPENAI_MODELS.map((modelId) => ({
  key: modelId.replace(/\./g, '').replace(/-/g, ''),
  modelId,
  label: `${OPENAI_MODEL_LABELS[modelId] || modelId}${OPENAI_REASONING_EFFORT ? ` (${OPENAI_REASONING_EFFORT})` : ''}`,
  enabled: Boolean(OPENAI_API_KEY),
  invoke: (imageBase64, promptText) => invokeOpenAI(modelId, imageBase64, promptText, OPENAI_REASONING_EFFORT),
}));

const providers = [
  { key: 'haiku3', label: 'Claude 3 Haiku', enabled: true, invoke: invokeHaiku },
  ...openAiProviders,
  { key: 'gemini25flash', label: 'Gemini 2.5 Flash', enabled: Boolean(GEMINI_API_KEY), invoke: invokeGemini },
].map((provider) => ({
  ...provider,
  enabled: provider.enabled && (PROVIDER_FILTER.size === 0 || PROVIDER_FILTER.has(provider.key)),
}));

const summarizeDurations = (values) => {
  if (!values.length) return null;
  const totalMs = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    totalMs,
    avgMs: Math.round(totalMs / values.length),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  };
};

const estimateOpenAiUsd = (modelId, usage = {}) => {
  const pricing = OPENAI_PRICING_USD_PER_MILLION[modelId];
  if (!pricing) return null;
  const inputTokens = Number(usage.input_tokens || 0);
  const cachedInputTokens = Number(usage.input_tokens_details?.cached_tokens || 0);
  const cacheWriteTokens = Number(usage.input_tokens_details?.cache_write_tokens || 0);
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens - cacheWriteTokens);
  const outputTokens = Number(usage.output_tokens || 0);
  return Number((
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (cachedInputTokens / 1_000_000) * pricing.cachedInput +
    (cacheWriteTokens / 1_000_000) * pricing.cacheWrite +
    (outputTokens / 1_000_000) * pricing.output
  ).toFixed(8));
};

const findPreviousJsonReport = () => {
  const dir = dirname(JSON_OUTPUT_PATH);
  const ext = extname(JSON_OUTPUT_PATH);
  const basePrefix = `model-compare-${MONTH}-`;
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((name) => name.startsWith(basePrefix) && name.endsWith(ext) && resolve(dir, name) !== JSON_OUTPUT_PATH)
    .sort()
    .pop() || null;
};

const computeRunDiff = (currentRows, previousRows) => {
  if (!Array.isArray(previousRows) || !previousRows.length) return null;
  const previousMap = new Map(previousRows.map((row) => [row.submissionId, row.newScore]));
  const diffs = currentRows
    .map((row) => {
      const previous = previousMap.get(row.submissionId);
      return previous == null ? null : row.newScore - previous;
    })
    .filter((value) => Number.isFinite(value));
  if (!diffs.length) return null;
  const abs = diffs.map((value) => Math.abs(value));
  return {
    compared: diffs.length,
    changed: diffs.filter((value) => value !== 0).length,
    avgAbsDelta: Number((abs.reduce((sum, value) => sum + value, 0) / abs.length).toFixed(2)),
    maxAbsDelta: Math.max(...abs),
  };
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const RUBRIC_LABELS = [
  ['promptMatch', 'お題一致'],
  ['composition', '構図'],
  ['shapeClarity', '形の分かりやすさ'],
  ['lineStability', '線の安定'],
  ['creativity', '工夫'],
  ['completeness', '完成度'],
];

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const sumUsage = (rows, getter) => rows.reduce((sum, row) => sum + (Number(getter(row.usage || {})) || 0), 0);
const fixed = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const dollars = (value) => Number.isFinite(value) ? `$${value.toFixed(6)}` : '—';

const summarizeProviderRows = (rows) => {
  if (!rows?.length) return null;
  const scores = rows.map((row) => Number(row.newScore)).filter(Number.isFinite);
  const rubric = Object.fromEntries(RUBRIC_LABELS.map(([key]) => [key, average(rows.map((row) => Number(row.rubric?.[key])).filter(Number.isFinite))]));
  const totalCostUsd = rows.reduce((sum, row) => sum + (Number(row.estimatedCostUsd) || 0), 0);
  const durations = summarizeDurations(rows.map((row) => Number(row.elapsedMs) || 0));
  const usage = {
    input: sumUsage(rows, (value) => value.input_tokens),
    cachedInput: sumUsage(rows, (value) => value.input_tokens_details?.cached_tokens),
    cacheWrite: sumUsage(rows, (value) => value.input_tokens_details?.cache_write_tokens),
    output: sumUsage(rows, (value) => value.output_tokens),
    total: sumUsage(rows, (value) => value.total_tokens),
  };
  return {
    count: rows.length,
    avgScore: average(scores),
    minScore: scores.length ? Math.min(...scores) : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    avgRubric: rubric,
    totalCostUsd,
    avgCostUsd: totalCostUsd / rows.length,
    durations,
    usage,
    avgInputTokens: usage.input / rows.length,
    avgOutputTokens: usage.output / rows.length,
  };
};

const buildHtml = (recordsByProvider, meta, images) => {
  const models = providers.filter((provider) => provider.enabled);
  const skippedImages = images.filter((image) => image.priorWasSkipped);
  const summaries = Object.fromEntries(models.map((provider) => [provider.key, summarizeProviderRows(recordsByProvider[provider.key] || [])]));
  const recordsById = Object.fromEntries(models.map((provider) => [
    provider.key,
    new Map((recordsByProvider[provider.key] || []).map((row) => [row.submissionId, row])),
  ]));
  const avgTable = models.map((provider) => {
    const summary = summaries[provider.key];
    if (!summary) return `<tr><th>${escapeHtml(provider.label)}</th><td colspan="8">${escapeHtml(meta.providerErrors?.[provider.key] || '結果なし')}</td></tr>`;
    return `<tr>
      <th>${escapeHtml(provider.label)}</th>
      <td>${fixed(summary.avgScore)}</td><td>${summary.minScore}–${summary.maxScore}</td>
      ${RUBRIC_LABELS.map(([key]) => `<td>${fixed(summary.avgRubric[key])}</td>`).join('')}
      <td>${fixed(summary.durations.avgMs, 0)} ms<br><small>${fixed(summary.durations.minMs, 0)}–${fixed(summary.durations.maxMs, 0)} ms</small></td>
      <td>${dollars(summary.totalCostUsd)}<br><small>${dollars(summary.avgCostUsd)} / 枚</small></td>
      <td>${summary.usage.input.toLocaleString()} / ${summary.usage.output.toLocaleString()}<br><small>入力 / 出力token</small></td>
    </tr>`;
  }).join('\n');
  const cards = images.map((image, index) => {
    const entries = models.map((provider) => ({ provider, row: recordsById[provider.key].get(image.submissionId) }));
    const oldScore = image.oldScore;
    const baseline = entries.find(({ provider }) => provider.modelId === 'gpt-5.6-luna')?.row;
    const current = entries.find(({ provider }) => provider.modelId === 'gpt-6-luna')?.row;
    const delta = baseline && current ? current.newScore - baseline.newScore : null;
    const imageResults = entries.map(({ provider, row }) => row ? `
      <section class="model-result">
        <h3>${escapeHtml(provider.label)} <strong>${row.newScore}点</strong></h3>
        <div class="metrics">${RUBRIC_LABELS.map(([key, label]) => `<span>${label} ${row.rubric[key]}</span>`).join('')}</div>
        <p class="timing">${fixed(row.elapsedMs, 0)} ms / ${dollars(row.estimatedCostUsd)} / 入力 ${Number(row.usage?.input_tokens || 0).toLocaleString()}・出力 ${Number(row.usage?.output_tokens || 0).toLocaleString()} token</p>
        <p>${escapeHtml(row.oneLiner || '')}</p>
        <p class="tips">${(row.tips || []).map((tip) => `<span>${escapeHtml(tip)}</span>`).join('')}</p>
        ${row.childOneLiner ? `<details><summary>子ども向け講評</summary><p>${escapeHtml(row.childOneLiner)}</p><p class="tips">${(row.childTips || []).map((tip) => `<span>${escapeHtml(tip)}</span>`).join('')}</p></details>` : ''}
      </section>` : `<section class="model-result muted"><h3>${escapeHtml(provider.label)}</h3><p>${escapeHtml(meta.providerErrors?.[provider.key] || '結果なし')}</p></section>`).join('');
    return `<article class="drawing-card">
      <header><div><strong>${index + 1}. ${escapeHtml(image.submissionId)}</strong><span>保存済み ${oldScore}点${image.priorWasSkipped ? '（本番AI採点スキップ）' : ''}</span></div><p>${escapeHtml(image.promptText || meta.promptText || '')}${delta == null ? '' : ` / GPT-6 Luna − GPT-5.6 Luna: ${delta > 0 ? '+' : ''}${delta}点`}</p></header>
      <img class="drawing" src="${escapeHtml(image.imageDataUrl)}" alt="${escapeHtml(image.submissionId)} のお絵かき" />
      <div class="model-grid">${imageResults}</div>
    </article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>お絵かき採点モデル比較 ${escapeHtml(MONTH)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f4f6f8;color:#172033;font:16px/1.55 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:28px 20px 64px}h1{margin:0 0 8px;font-size:2rem}.muted,small,.meta{color:#64748b}.lead{margin:0 0 10px}.meta{font-size:.9rem;margin-bottom:24px}.panel,.drawing-card{background:white;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 6px 24px #0f172a0a}.panel{padding:18px;overflow-x:auto;margin:24px 0}.panel h2{margin:0 0 14px}.summary{border-collapse:collapse;width:100%;min-width:1050px;font-size:.9rem}.summary th,.summary td{padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.summary th:first-child{white-space:nowrap}.summary small{font-size:.78rem}.drawing-card{padding:16px;margin:16px 0 22px}.drawing-card header{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:12px}.drawing-card header p{margin:0;color:#475569;text-align:right}.drawing-card header span{margin-left:12px;color:#64748b;font-size:.88rem}.drawing{display:block;width:min(100%,600px);margin:0 auto 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.model-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.model-result{border:1px solid #e2e8f0;border-radius:12px;padding:13px}.model-result h3{display:flex;justify-content:space-between;gap:10px;margin:0 0 9px;font-size:1.05rem}.model-result h3 strong{font-size:1.25rem;color:#14532d}.metrics{display:flex;flex-wrap:wrap;gap:6px}.metrics span,.tips span{border-radius:999px;background:#eef2ff;padding:4px 8px;font-size:.8rem}.timing{color:#475569;font-size:.86rem}.tips{display:flex;flex-wrap:wrap;gap:6px}.tips span{background:#fef3c7;color:#92400e}.model-result p{margin:9px 0}.model-result details{border-top:1px solid #e2e8f0;padding-top:8px}.model-result summary{cursor:pointer;color:#475569}.note{font-size:.9rem;color:#475569}code{background:#eef2f7;padding:2px 5px;border-radius:4px}@media(max-width:700px){main{padding:20px 12px 48px}.drawing-card header{display:block}.drawing-card header p{text-align:left;margin-top:6px}.drawing-card header span{display:block;margin:4px 0}}
</style></head><body><main>
  <h1>お絵かき採点モデル比較 ${escapeHtml(MONTH)}</h1>
  <p class="lead">同一の月次投稿画像を、GPT-5.6 Luna と GPT-6 Luna の <code>reasoning.effort=none</code> で採点。</p>
  <p class="meta">実行日時: ${escapeHtml(meta.runTimestamp)} / お題: ${escapeHtml(meta.promptText || '')} / 対象: ${images.length}枚 / 集計時間はAPI呼び出し時間 / 費用は利用token数と標準料金から算出</p>
  <section class="panel"><h2>モデル別の平均</h2><table class="summary"><thead><tr><th>モデル</th><th>平均点</th><th>点数幅</th>${RUBRIC_LABELS.map(([, label]) => `<th>${label}</th>`).join('')}<th>時間</th><th>推定費用</th><th>入力 / 出力token</th></tr></thead><tbody>${avgTable}</tbody></table>
    <p class="note">採点指標は本番の6軸rubric。点数は本番の重み付けとボーナス式で再計算しています。平均点の差は採点の正しさを示すものではなく、モデルの評価傾向の差です。</p>
    ${skippedImages.length ? `<p class="note">注意: ${images.length}枚中${skippedImages.length}枚は保存時に本番の線検出でAI採点をスキップしていました。この比較では同じ画像を両モデルに渡しています。該当画像の新しい点数は参考値で、推定費用・時間には比較用の追加呼び出し分が含まれます。</p>` : ''}
  </section>
  <section><h2>画像ごとの結果</h2>${cards}</section>
  <p class="note">料金表: GPT-5.6 Luna 入力 $0.20 / cached $0.02 / cache write $0.25 / 出力 $1.20、GPT-6 Luna 入力 $0.10 / cached $0.01 / cache write $0.125 / 出力 $0.50（100万tokenあたり、Standard）。</p>
</main></body></html>`;
};

const buildPlainTextReport = (recordsByProvider, meta, images) => {
  const models = providers.filter((provider) => provider.enabled);
  const skippedImages = images.filter((image) => image.priorWasSkipped);
  const summaries = Object.fromEntries(models.map((provider) => [provider.key, summarizeProviderRows(recordsByProvider[provider.key] || [])]));
  const baseline = models.find((provider) => provider.modelId === 'gpt-5.6-luna');
  const current = models.find((provider) => provider.modelId === 'gpt-6-luna');
  const scoreMap = (provider) => new Map((recordsByProvider[provider?.key] || []).map((row) => [row.submissionId, row]));
  const baselineRows = scoreMap(baseline);
  const currentRows = scoreMap(current);
  const summaryLines = models.map((provider) => {
    const summary = summaries[provider.key];
    if (!summary) return `${provider.label}: 結果なし (${meta.providerErrors?.[provider.key] || '不明'})`;
    const rubric = RUBRIC_LABELS.map(([key, label]) => `${label} ${fixed(summary.avgRubric[key])}`).join(' / ');
    return [
      `${provider.label}: ${summary.count}枚`,
      `平均 ${fixed(summary.avgScore)}点 (${summary.minScore}–${summary.maxScore}点)`,
      `平均時間 ${fixed(summary.durations.avgMs, 0)}ms (${fixed(summary.durations.minMs, 0)}–${fixed(summary.durations.maxMs, 0)}ms), 合計 ${(summary.durations.totalMs / 1000).toFixed(1)}秒`,
      `推定費用 ${dollars(summary.totalCostUsd)} (平均 ${dollars(summary.avgCostUsd)}/枚)`,
      `token 入力 ${summary.usage.input.toLocaleString()} / cached ${summary.usage.cachedInput.toLocaleString()} / cache write ${summary.usage.cacheWrite.toLocaleString()} / 出力 ${summary.usage.output.toLocaleString()}`,
      `rubric平均: ${rubric}`,
    ].join('\n  ');
  });
  const pairLines = images.map((image) => {
    const oldRow = baselineRows.get(image.submissionId);
    const newRow = currentRows.get(image.submissionId);
    const delta = oldRow && newRow ? newRow.newScore - oldRow.newScore : null;
    return `${image.submissionId}\t保存済み ${image.oldScore}点${image.priorWasSkipped ? '（本番AI採点スキップ）' : ''}\tGPT-5.6 Luna ${oldRow?.newScore ?? '—'}点\tGPT-6 Luna ${newRow?.newScore ?? '—'}点\t差 ${delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}点`;
  });
  const deltaAvg = baseline && current && summaries[baseline.key] && summaries[current.key]
    ? summaries[current.key].avgScore - summaries[baseline.key].avgScore
    : null;
  return [
    `お絵かきゲーム採点モデル比較 ${meta.month}`,
    `実行日時: ${meta.runTimestamp}`,
    `お題: ${meta.promptText || '不明'} / 対象: ${images.length}枚（月次評価画像）`,
    `条件: Responses API / reasoning.effort=none / 同じ画像・本番一次採点prompt・strict JSON Schema・本番6軸スコア式`,
    ...(skippedImages.length ? [
      `注意: ${images.length}枚中${skippedImages.length}枚は保存時に本番の線検出でAI採点をスキップ。今回は比較用に両モデルへ渡したため、該当画像の新しい点数は参考値。費用と時間の合計には比較用の追加呼び出し分が含まれる。`,
      `該当ID: ${skippedImages.map((image) => image.submissionId).join(', ')}`,
    ] : []),
    '',
    '概要',
    ...summaryLines,
    ...(deltaAvg == null ? [] : [`平均点差 (GPT-6 − GPT-5.6): ${deltaAvg > 0 ? '+' : ''}${fixed(deltaAvg)}点`]),
    '',
    '画像ごとの点数',
    ...pairLines,
    '',
    '費用算出',
    '利用token数×OpenAI公式Standard料金（短いprompt tier、100万token単価）から推定。入力画像tokenを含む。',
    'GPT-5.6 Luna: input $0.20 / cached input $0.02 / cache write $0.25 / output $1.20',
    'GPT-6 Luna: input $0.10 / cached input $0.01 / cache write $0.125 / output $0.50',
    '個別の画像・6指標・時間・費用・講評は、同じベース名のHTMLを参照。',
    `価格情報: ${OPENAI_PRICING_USD_PER_MILLION['gpt-5.6-luna'].source} / ${OPENAI_PRICING_USD_PER_MILLION['gpt-6-luna'].source}`,
  ].join('\n');
};

const main = async () => {
  const rows = await queryMonthRows();
  if (!rows.length) {
    throw new Error(`no rows found for prompt-${MONTH}`);
  }

  const images = await Promise.all(rows.map(async (row) => {
    const buffer = await getObjectBuffer(row.imageKey);
    return {
      submissionId: row.submissionId,
      createdAt: row.createdAt,
      promptText: row.promptText || PROMPT_TEXT,
      oldScore: Number(row.score || 0),
      priorWasSkipped: row.aiFallbackUsed === true && String(row.oneLiner || '').includes('採点をスキップ'),
      imageDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      imageBase64: buffer.toString('base64'),
    };
  }));

  const recordsByProvider = {};
  const durations = {};
  const providerErrors = {};
  const rawByProvider = {};
  for (const provider of providers) {
    if (!provider.enabled) continue;
    const providerRows = [];
    const providerDurations = [];
    try {
      console.log(`[${provider.label}] start ${images.length} images`);
      let index = 0;
      for (const image of images) {
        index += 1;
        console.log(`[${provider.label}] ${index}/${images.length} ${image.submissionId}`);
        const startedAt = Date.now();
        const ai = await provider.invoke(image.imageBase64, image.promptText);
        const elapsedMs = Date.now() - startedAt;
        providerDurations.push(elapsedMs);
        rawByProvider[provider.key] ??= {};
        rawByProvider[provider.key][image.submissionId] = ai.raw ?? null;
        const rubric = normalizeRubric(ai.data);
        const reviewParts = [
          String(ai.data?.review?.summary || '').trim(),
          String(ai.data?.review?.goodPoint || '').trim(),
          String(ai.data?.review?.improvement || '').trim(),
          String(ai.data?.review?.nextStep || '').trim(),
        ].filter(Boolean);
        const childReviewParts = [
          String(ai.data?.childReview?.summary || '').trim(),
          String(ai.data?.childReview?.goodPoint || '').trim(),
          String(ai.data?.childReview?.improvement || '').trim(),
          String(ai.data?.childReview?.nextStep || '').trim(),
        ].filter(Boolean);
        providerRows.push({
          submissionId: image.submissionId,
          createdAt: image.createdAt,
          promptText: image.promptText,
          oldScore: image.oldScore,
          priorWasSkipped: image.priorWasSkipped,
          newScore: computeScore(rubric),
          imageDataUrl: image.imageDataUrl,
          oneLiner: reviewParts.join(' '),
          tips: Array.isArray(ai.data?.tips) ? ai.data.tips.slice(0, 3) : [],
          childOneLiner: childReviewParts.join(' '),
          childTips: Array.isArray(ai.data?.childTips) ? ai.data.childTips.slice(0, 3) : [],
          rubric,
          review: ai.data?.review || null,
          usage: ai.usage || {},
          estimatedCostUsd: estimateOpenAiUsd(provider.modelId, ai.usage || {}),
          elapsedMs,
        });
      }
      providerRows.sort((a, b) => b.newScore - a.newScore || String(a.createdAt).localeCompare(String(b.createdAt)));
      recordsByProvider[provider.key] = providerRows;
      durations[provider.key] = summarizeDurations(providerDurations);
    } catch (error) {
      providerErrors[provider.key] = error instanceof Error ? error.message : String(error);
      recordsByProvider[provider.key] = [];
      durations[provider.key] = summarizeDurations(providerDurations);
    }
  }

  const previousReportName = findPreviousJsonReport();
  const previousReportPath = previousReportName ? resolve(dirname(JSON_OUTPUT_PATH), previousReportName) : null;
  const previousPayload = previousReportPath && existsSync(previousReportPath)
    ? JSON.parse(readFileSync(previousReportPath, 'utf8'))
    : null;
  const runDiffs = Object.fromEntries(
    providers
      .filter((provider) => provider.enabled)
      .map((provider) => [
        provider.key,
        computeRunDiff(recordsByProvider[provider.key], previousPayload?.recordsByProvider?.[provider.key]),
      ]),
  );

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const payload = {
    month: MONTH,
    runTimestamp,
    promptText: [...new Set(images.map((image) => image.promptText))].join(' / '),
    reasoningEffort: OPENAI_REASONING_EFFORT,
    sampleSize: images.length,
    recordsByProvider,
    durations,
    runDiffs,
    providerErrors,
    pricing: OPENAI_PRICING_USD_PER_MILLION,
    previousReport: previousReportName,
  };
  writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(payload, null, 2));
  writeFileSync(RAW_OUTPUT_PATH, JSON.stringify({
    month: MONTH,
    runTimestamp,
    promptText: payload.promptText,
    reasoningEffort: OPENAI_REASONING_EFFORT,
    providerErrors,
    previousReport: previousReportName,
    rawByProvider,
  }, null, 2));
  writeFileSync(OUTPUT_PATH, buildHtml(recordsByProvider, payload, images));
  writeFileSync(TEXT_OUTPUT_PATH, `${buildPlainTextReport(recordsByProvider, payload, images)}\n`);
  console.log(`Saved report: ${OUTPUT_PATH}`);
  console.log(`Saved json: ${JSON_OUTPUT_PATH}`);
  console.log(`Saved raw: ${RAW_OUTPUT_PATH}`);
  console.log(`Saved plain text: ${TEXT_OUTPUT_PATH}`);
  for (const provider of providers) {
    if (!provider.enabled || providerErrors[provider.key]) {
      if (!provider.enabled) {
        console.log(`${provider.label}: skipped (API key missing)`);
      } else {
        console.log(`${provider.label}: unavailable (${providerErrors[provider.key]})`);
      }
      continue;
    }
    const rowsForProvider = recordsByProvider[provider.key] || [];
    const top = rowsForProvider.slice(0, 5).map((row) => `${row.newScore}:${row.submissionId}`).join(', ');
    const duration = durations[provider.key];
    const diff = runDiffs[provider.key];
    const totalCost = rowsForProvider.reduce((sum, row) => sum + (Number(row.estimatedCostUsd) || 0), 0);
    console.log(`${provider.label}: ${rowsForProvider.length} images, top5=${top}, avg=${duration?.avgMs ?? '-'}ms, min=${duration?.minMs ?? '-'}ms, max=${duration?.maxMs ?? '-'}ms, totalCost=$${totalCost.toFixed(6)}${diff ? `, prevChanged=${diff.changed}/${diff.compared}, prevAvgAbs=${diff.avgAbsDelta}` : ''}`);
  }
};

main().catch((error) => {
  console.error('FAILED', error);
  process.exit(1);
});
