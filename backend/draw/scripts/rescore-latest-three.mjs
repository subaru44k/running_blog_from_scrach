import { DynamoDBClient, ExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
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
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
};

loadLocalEnv(resolve(process.cwd(), '.env.local'));

const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'gpt-5-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'minimal';

const targetMonth = process.argv[2] || '2026-02';
const promptId = `prompt-${targetMonth}`;
const limit = Number(process.argv[3] || 3);

const ddb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const primarySystemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。
講評はやさしく親しみのある口調にしてください。
読んだ人が「また描いてみたい」と思える、あたたかい雰囲気を大切にしてください。`;

const buildPrimaryUser = (promptText, imageBase64) => ([
  {
    type: 'text',
    text:
      `お題: ${promptText || 'お題不明'}\n画像を評価して、次のJSONスキーマで返してください。\n` +
      `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
      `"review":{"summary":"全体の印象を1文","goodPoint":"良い点を1文","improvement":"改善点を1文","nextStep":"次の一手を1文"},"tips":["短い名詞句を2-3個"]}\n` +
      `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は普通に伝わる、7は普通より明らかに良い、8はかなり珍しい、9はごく少数の強い作品、10は例外的な作品のみ。` +
      `rubricは必ず1点刻みの整数で評価すること。` +
      `各項目は自然に評価し、同じ値が複数あってもよい。` +
      `30秒お絵かきでは、普通に伝わる絵でも多くの項目は5-6に収まることが多い。認識できるだけで7-8を付けないこと。` +
      `promptMatch は最も厳しく評価すること。最初の一目でお題だと分からない場合は高くしないこと。` +
      `promptMatch の目安: 9-10は初見で迷わずお題だと分かる、7-8はお題だと分かるが曖昧さが残る、5-6は関連は感じるが別のものにも見える、3-4は別のものに見える、0-2はお題外れ。` +
      `shapeClarity, composition, completeness も甘くしないこと。形が粗い、輪郭が不安定、画面内でまとまりが弱い、未完成に見える場合は4-6を基本とすること。` +
      `creativity は珍しさだけで高くしないこと。見やすさや魅力につながる工夫がある場合だけ高くすること。` +
      `読みにくい絵や未完成の絵には低い点を付けてよい。` +
      `明確に良い点がある場合だけ高い点を付けること。` +
      `review の4項目はすべて必須で、日本語1文ずつにすること。` +
      `summary では絵全体の印象を1文で述べること。` +
      `goodPoint では良い点を1つ具体的に褒めること。` +
      `improvement では次に良くなる具体的な工夫を1つだけやさしく伝えること。` +
      `nextStep ではもう1つの改善点または次の一手を短く伝え、前向きに締めること。` +
      `4項目とも対象の絵に触れた具体的内容にし、汎用的な褒め言葉だけで済ませないこと。` +
      `review のどれかを省略したり、空文字にしたりしてはいけない。` +
      `review 全体では必ず4文になるようにすること。` +
      `summary と goodPoint は別内容にすること。 improvement と nextStep も別内容にすること。` +
      `先生の講評のように固すぎる言い方は避け、ゲームらしい親しみやすさを出すこと。` +
      `良い点は先にしっかり伝え、改善点も「次はこうするともっと楽しい」「こうするともっと伝わる」のように前向きに書くこと。` +
      `冷たく感じる表現、突き放す表現、事務的すぎる表現は避けること。` +
      `「かわいらしい」「たのしい」「いい感じ」など、やわらかい日本語を自然に使ってよい。` +
      `人格否定や断定的な否定語は使わないこと。` +
      `tipsは日本語のみで出力し、英語表現は使わないこと。` +
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

const computeScoreFromRubric = (rubric) => {
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
  const score = computeScoreFromRubric(rubric);
  const reviewParts = [
    String(input?.review?.summary || '').trim(),
    String(input?.review?.goodPoint || '').trim(),
    String(input?.review?.improvement || '').trim(),
    String(input?.review?.nextStep || '').trim(),
  ].filter(Boolean);
  const oneLiner = (reviewParts.length > 0 ? reviewParts.join(' ') : String(input?.oneLiner || '').trim());
  const tips = Array.isArray(input?.tips) ? input.tips.map((x) => String(x).trim()).filter(Boolean).slice(0, 3) : [];
  return { score, breakdown, oneLiner, tips };
};

const extractOpenAiText = (payload) => {
  const chunks = [];
  for (const block of payload?.output || []) {
    for (const content of block?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  if (chunks.length > 0) return chunks.join('\n').trim();
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  return '';
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
  const promptMatch = Number((text.match(/"promptMatch"\s*:\s*(-?\d+)/) || [])[1]);
  const compositionRubric = Number((text.match(/"composition"\s*:\s*(-?\d+)/) || [])[1]);
  const shapeClarity = Number((text.match(/"shapeClarity"\s*:\s*(-?\d+)/) || [])[1]);
  const lineStability = Number((text.match(/"lineStability"\s*:\s*(-?\d+)/) || [])[1]);
  const creativity = Number((text.match(/"creativity"\s*:\s*(-?\d+)/) || [])[1]);
  const completeness = Number((text.match(/"completeness"\s*:\s*(-?\d+)/) || [])[1]);
  const likeness = Number((text.match(/"likeness"\s*:\s*(-?\d+)/) || [])[1]);
  const compositionLegacy = Number((text.match(/"composition"\s*:\s*(-?\d+)/) || [])[1]);
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

  const hasRubric =
    Number.isFinite(promptMatch)
    || Number.isFinite(compositionRubric)
    || Number.isFinite(shapeClarity)
    || Number.isFinite(lineStability)
    || Number.isFinite(creativity)
    || Number.isFinite(completeness);

  const hasLegacyBreakdown =
    Number.isFinite(likeness)
    || Number.isFinite(compositionLegacy)
    || Number.isFinite(originality);

  if (!hasRubric && !hasLegacyBreakdown && !Number.isFinite(score)) {
    throw new Error('score parse failed');
  }

  return hasRubric
    ? {
      rubric: {
        promptMatch: Number.isFinite(promptMatch) ? promptMatch : undefined,
        composition: Number.isFinite(compositionRubric) ? compositionRubric : undefined,
        shapeClarity: Number.isFinite(shapeClarity) ? shapeClarity : undefined,
        lineStability: Number.isFinite(lineStability) ? lineStability : undefined,
        creativity: Number.isFinite(creativity) ? creativity : undefined,
        completeness: Number.isFinite(completeness) ? completeness : undefined,
      },
      score: Number.isFinite(score) ? score : undefined,
      oneLiner: unquoteJsonString(oneLinerRaw),
      tips: tips.slice(0, 3),
    }
    : {
      score: Number.isFinite(score) ? score : undefined,
      breakdown: {
        likeness: Number.isFinite(likeness) ? likeness : 0,
        composition: Number.isFinite(compositionLegacy) ? compositionLegacy : 0,
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
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const out = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      ...(OPENAI_REASONING_EFFORT ? { reasoning: { effort: OPENAI_REASONING_EFFORT } } : {}),
      input: [
        { role: 'system', content: [{ type: 'input_text', text: primarySystemPrompt }] },
        {
          role: 'user',
          content: buildPrimaryUser(promptText, imageBase64).map((part) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: `data:${part.source.media_type};base64,${part.source.data}` }
          ),
        },
      ],
    }),
  });
  if (!out.ok) throw new Error(`OpenAI ${out.status}: ${await out.text()}`);
  const parsed = await out.json();
  const text = extractOpenAiText(parsed);
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
    try {
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
    } catch (err) {
      const code = err?.Code || err?.name || 'Error';
      if (code === 'NoSuchKey') {
        results.push({
          order: idx + 1,
          submissionId: item.submissionId,
          createdAt: item.createdAt,
          oldScore: toInt(item.score),
          newScore: null,
          diff: null,
          newOneLiner: 'SKIPPED: NoSuchKey',
          newTips: [],
        });
        continue;
      }
      throw err;
    }
  }

  console.log('\n|#|submissionId|createdAt|old|new|diff|');
  console.log('|-:|---|---|--:|--:|--:|');
  for (const r of results) {
    console.log(`|${r.order}|${r.submissionId}|${r.createdAt}|${r.oldScore}|${r.newScore ?? 'SKIP'}|${r.diff ?? '-'}|`);
  }

  console.log('\nRESULT_JSON_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('RESULT_JSON_END');
};

run().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
