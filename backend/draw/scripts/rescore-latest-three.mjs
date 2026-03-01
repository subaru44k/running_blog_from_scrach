import { DynamoDBClient, ExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const targetMonth = process.argv[2] || '2026-02';
const promptId = `prompt-${targetMonth}`;
const limit = Number(process.argv[3] || 3);

const ddb = new DynamoDBClient({ region: REGION });
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
      `注意: 数値は整数。rubricの各項目は0〜10。` +
      `rubricは1点刻み。5や10の多用を避け、曖昧なら6/7/8/9を優先すること。` +
      `oneLinerとtipsは日本語のみで出力し、英語表現は使わないこと。` +
      `tipsは体言止めの短い語句にすること。`,
  },
  {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
  },
]);

const toInt = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const clampScore = (v) => Math.max(0, Math.min(100, toInt(v)));

const normalizePrimary = (input) => {
  const rubric = input?.rubric
    ? {
      promptMatch: Math.max(0, Math.min(10, toInt(input.rubric.promptMatch))),
      composition: Math.max(0, Math.min(10, toInt(input.rubric.composition))),
      shapeClarity: Math.max(0, Math.min(10, toInt(input.rubric.shapeClarity))),
      lineStability: Math.max(0, Math.min(10, toInt(input.rubric.lineStability))),
      creativity: Math.max(0, Math.min(10, toInt(input.rubric.creativity))),
      completeness: Math.max(0, Math.min(10, toInt(input.rubric.completeness))),
    }
    : {
      promptMatch: Math.max(0, Math.min(10, toInt((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10))),
      composition: Math.max(0, Math.min(10, toInt((input?.breakdown?.composition ?? input?.composition ?? 50) / 10))),
      shapeClarity: Math.max(0, Math.min(10, toInt((input?.breakdown?.likeness ?? input?.likeness ?? 50) / 10))),
      lineStability: Math.max(0, Math.min(10, toInt(((input?.breakdown?.composition ?? input?.composition ?? 50) * 0.5 + (input?.breakdown?.originality ?? input?.originality ?? 50) * 0.5) / 10))),
      creativity: Math.max(0, Math.min(10, toInt((input?.breakdown?.originality ?? input?.originality ?? 50) / 10))),
      completeness: Math.max(0, Math.min(10, toInt(((input?.score ?? 60) * 0.8 + (input?.breakdown?.composition ?? input?.composition ?? 50) * 0.2) / 10))),
    };
  const breakdown = {
    likeness: clampScore((rubric.promptMatch * 0.6 + rubric.shapeClarity * 0.4) * 10),
    composition: clampScore((rubric.composition * 0.7 + rubric.completeness * 0.3) * 10),
    originality: clampScore((rubric.creativity * 0.7 + rubric.lineStability * 0.3) * 10),
  };
  const score = clampScore(
    (rubric.promptMatch * 24
      + rubric.composition * 16
      + rubric.shapeClarity * 18
      + rubric.lineStability * 12
      + rubric.creativity * 16
      + rubric.completeness * 14) / 10,
  );
  const oneLiner = String(input?.oneLiner || '').trim();
  const tips = Array.isArray(input?.tips) ? input.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 3) : [];
  return { score, breakdown, oneLiner, tips };
};

const readBodyString = async (body) => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }
  return '';
};

const extractText = (payload) => {
  const content = payload?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c?.type === 'text')
    .map((c) => c?.text || '')
    .join('\n')
    .trim();
};

const findJsonBlock = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
};

const sanitizeJsonText = (text) => {
  // Remove disallowed control chars while keeping tabs/newlines.
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
};

const stripCodeFence = (text) => String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

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
    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
};

const unquoteJsonString = (v) => {
  try {
    return JSON.parse(`"${String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  } catch {
    return String(v || '').trim();
  }
};

const parseByRegexFallback = (text) => {
  const score = Number((text.match(/"score"\s*:\s*(-?\d+)/) || [])[1]);
  const likeness = Number((text.match(/"likeness"\s*:\s*(-?\d+)/) || [])[1]);
  const composition = Number((text.match(/"composition"\s*:\s*(-?\d+)/) || [])[1]);
  const originality = Number((text.match(/"originality"\s*:\s*(-?\d+)/) || [])[1]);

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

  if (!Number.isFinite(score)) throw new Error('score parse failed');
  return {
    score,
    breakdown: {
      likeness: Number.isFinite(likeness) ? likeness : 0,
      composition: Number.isFinite(composition) ? composition : 0,
      originality: Number.isFinite(originality) ? originality : 0,
    },
    oneLiner: unquoteJsonString(oneLinerRaw),
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

const getObjectBuffer = async (bucket, key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error('S3 body is empty');
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const invokePrimary = async (promptText, imageBase64) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: primarySystemPrompt,
    messages: [{ role: 'user', content: buildPrimaryUser(promptText, imageBase64) }],
  };
  const out = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
  const raw = await readBodyString(out.body);
  const parsed = raw ? JSON.parse(raw) : {};
  const text = extractText(parsed);
  const json = parseModelJson(text);
  return normalizePrimary(json);
};

const fetchLatest = async () => {
  const statement =
    `SELECT submissionId, score, imageKey, promptText, createdAt ` +
    `FROM "${TABLE}" WHERE promptId='${promptId}' ORDER BY submissionId DESC`;
  const out = await ddb.send(new ExecuteStatementCommand({ Statement: statement }));
  const items = (out.Items || []).map((x) => unmarshall(x));
  return items.slice(0, limit);
};

const run = async () => {
  console.log(`Rescoring latest ${limit} items for ${promptId}`);
  console.log(`Region=${REGION} Table=${TABLE} Bucket=${BUCKET} Model=${MODEL_ID}`);

  const latest = await fetchLatest();
  if (latest.length === 0) {
    console.log('No items found.');
    return;
  }

  const results = [];
  for (const [idx, item] of latest.entries()) {
    const imageBuf = await getObjectBuffer(BUCKET, item.imageKey);
    const rescored = await invokePrimary(item.promptText || 'お題不明', imageBuf.toString('base64'));
    results.push({
      order: idx + 1,
      submissionId: item.submissionId,
      createdAt: item.createdAt,
      oldScore: toInt(item.score),
      newScore: rescored.score,
      diff: rescored.score - toInt(item.score),
      newOneLiner: rescored.oneLiner,
      newTips: rescored.tips,
    });
  }

  console.log('\n|#|submissionId|createdAt|old|new|diff|');
  console.log('|-:|---|---|--:|--:|--:|');
  for (const r of results) {
    console.log(`|${r.order}|${r.submissionId}|${r.createdAt}|${r.oldScore}|${r.newScore}|${r.diff}|`);
  }

  console.log('\nRESULT_JSON_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('RESULT_JSON_END');
};

run().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
