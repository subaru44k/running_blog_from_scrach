import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const MODEL_ID = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const month = process.argv[2] || '2026-02';
const promptText = process.argv[3] || (month === '2026-02' ? '30秒で熊を描いて' : '30秒で猫を描いて');
const promptVariant = process.argv[4] || 'baseline';
const formulaVariant = process.argv[5] || 'current';
const outputPath = process.env.SCORE_EXPERIMENT_OUT || '';
const inputPath = process.env.SCORE_EXPERIMENT_IN || '';

const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const bedrock = new BedrockRuntimeClient({ region: REGION });

const clampScore = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const clampRubric = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));

const prompts = {
  baseline:
    `画像を評価して、次のJSONスキーマで返してください。\n` +
    `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
    `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
    `注意: 数値は整数。rubricは1点刻み。5や10の多用を避け、曖昧なら6/7/8/9を優先すること。` +
    `oneLinerとtipsは日本語のみ。`,
  spread_v1:
    `画像を評価して、次のJSONスキーマで返してください。\n` +
    `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
    `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
    `rubricは1点刻みの整数。各項目は他作品と区別できるように評価し、同じ6項目セットを繰り返さないこと。` +
    `0-3はかなり弱い、4-5は不足、6-7は平均的、8は良い、9はかなり良い、10は例外的に優秀な場合のみ。` +
    `特に promptMatch と shapeClarity は甘くしすぎないこと。`,
  spread_v2:
    `画像を評価して、次のJSONスキーマで返してください。\n` +
    `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
    `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
    `採点は厳しめに行い、平均的な作品を7前後に集めすぎないこと。` +
    `弱点がある場合は該当項目を4-6まで下げる。強みが明確なら8-10を使う。` +
    `6項目のうち最低2項目は、画像固有の特徴を反映して他画像との差が出る値にすること。`,
  spread_v3:
    `画像を評価して、次のJSONスキーマで返してください。\n` +
    `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
    `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
    `平均的な作品は各項目5-7、良い作品は8-9、非常に良い作品は10を使う。` +
    `ただし「無難だから7」は禁止。弱い項目は4以下まで下げ、突出した項目は9以上を積極的に使うこと。` +
    `特に creativity と composition は差が出やすいように細かく評価すること。`,
  spread_v4:
    `画像を評価して、次のJSONスキーマで返してください。\n` +
    `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
    `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
    `採点の基準を次のように固定すること。0-2は成立していない、3-4はかなり弱い、5-6は平均的、7はやや良い、8は明確に良い、9はかなり良い、10はごく少数の例外的に強い作品のみ。` +
    `平均的なユーザー作品に対して安易に7や8を付けないこと。` +
    `6項目のうち少なくとも3項目は同じ値にしないこと。弱い点が見えたら4以下を使うこと。強みが明確なら9以上を使うこと。`,
};

const systemPrompt = `あなたは30秒お絵描きゲームの一次採点担当です。
返答は必ず日本語で作成してください。
英語・ローマ字・英単語は一切使わないでください。
必ずJSONのみで返してください。説明文や前置きは不要です。`;

const buildUser = (text, imageBase64) => ([
  {
    type: 'text',
    text: `お題: ${text}\n${prompts[promptVariant] || prompts.baseline}`,
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

const getObjectBuffer = async (key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!out.Body) throw new Error('S3 body is empty');
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const listKeys = async (prefix) => {
  const keys = [];
  let ContinuationToken;
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken }));
    for (const item of out.Contents || []) keys.push(item.Key);
    ContinuationToken = out.NextContinuationToken;
  } while (ContinuationToken);
  return keys.filter(Boolean).sort();
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

const normalizeRubric = (input) => ({
  promptMatch: clampRubric(input?.rubric?.promptMatch),
  composition: clampRubric(input?.rubric?.composition),
  shapeClarity: clampRubric(input?.rubric?.shapeClarity),
  lineStability: clampRubric(input?.rubric?.lineStability),
  creativity: clampRubric(input?.rubric?.creativity),
  completeness: clampRubric(input?.rubric?.completeness),
});

const formulas = {
  current: (r) => {
    const weighted = r.promptMatch * 24 + r.composition * 16 + r.shapeClarity * 18 + r.lineStability * 12 + r.creativity * 16 + r.completeness * 14;
    const base = weighted / 10;
    const values = [r.promptMatch, r.composition, r.shapeClarity, r.lineStability, r.creativity, r.completeness];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    const spread = Math.sqrt(variance) * 2.2;
    const synergy = Math.max(0, r.promptMatch - 7) * Math.max(0, r.creativity - 7) * 0.8;
    const penalty = Math.max(0, 6 - r.completeness) * 1.8;
    return clampScore(base + spread + synergy - penalty);
  },
  wide_a: (r) => {
    const core = r.promptMatch * 30 + r.shapeClarity * 18 + r.composition * 14 + r.lineStability * 10 + r.creativity * 12 + r.completeness * 16;
    const base = 30 + core / 10;
    const top2 = [r.promptMatch, r.shapeClarity, r.composition, r.lineStability, r.creativity, r.completeness].sort((a, b) => b - a).slice(0, 2);
    const bonus = Math.max(0, top2[0] - 7) * 3.2 + Math.max(0, top2[1] - 7) * 2.2;
    const promptPenalty = Math.max(0, 7 - r.promptMatch) * 5.5;
    const weakPenalty = [r.promptMatch, r.shapeClarity, r.composition, r.lineStability, r.creativity, r.completeness]
      .filter((v) => v < 6)
      .reduce((acc, v) => acc + (6 - v) * 3.2, 0);
    const excellence = r.promptMatch >= 9 && r.shapeClarity >= 9 && r.creativity >= 8 ? 10 : 0;
    return clampScore(base + bonus + excellence - promptPenalty - weakPenalty);
  },
  wide_b: (r) => {
    const weighted = r.promptMatch * 4.2 + r.shapeClarity * 2.6 + r.composition * 1.8 + r.lineStability * 1.3 + r.creativity * 2.2 + r.completeness * 2.4;
    const values = [r.promptMatch, r.shapeClarity, r.composition, r.lineStability, r.creativity, r.completeness];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const rangeBonus = (max - min) * 2.4;
    const creativeLift = r.creativity >= 8 ? (r.creativity - 7) * 4 : 0;
    const eliteLift = r.promptMatch >= 9 && r.shapeClarity >= 8 ? 8 : 0;
    const floorPenalty = min < 5 ? (5 - min) * 7 : 0;
    return clampScore(18 + weighted + rangeBonus + creativeLift + eliteLift - floorPenalty);
  },
  prod_candidate: (r) => {
    const values = [r.promptMatch, r.composition, r.shapeClarity, r.lineStability, r.creativity, r.completeness];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const strong = values.filter((v) => v >= 8).length;
    const weak = values.filter((v) => v <= 4).length;
    let latent = 12 + avg * 8.8;
    latent += strong * 3.2;
    latent += r.promptMatch >= 8 && r.shapeClarity >= 7 ? 5 : 0;
    latent += r.creativity >= 7 ? 2 : 0;
    latent -= weak * 4.5;
    latent -= r.promptMatch <= 4 ? 6 : 0;
    latent -= r.completeness <= 4 ? 4 : 0;
    latent = Math.max(0, Math.min(100, latent));
    const normalized = Math.max(0, Math.min(1, (latent - 25) / 48));
    return clampScore(20 + normalized * 80);
  },
};

const summarize = (scores) => {
  const sorted = [...scores].sort((a, b) => a - b);
  const bins = {
    lt60: sorted.filter((s) => s < 60).length,
    s60_69: sorted.filter((s) => s >= 60 && s < 70).length,
    s70_79: sorted.filter((s) => s >= 70 && s < 80).length,
    s80_89: sorted.filter((s) => s >= 80 && s < 90).length,
    s90_99: sorted.filter((s) => s >= 90 && s < 100).length,
    s100: sorted.filter((s) => s === 100).length,
  };
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
    unique: new Set(sorted).size,
    bins,
  };
};

const invokePrimary = async (imageBase64) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildUser(promptText, imageBase64) }],
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
  return {
    data: parseJson(text),
    usage: parsed?.usage || {},
  };
};

const main = async () => {
  if (inputPath) {
    const cached = JSON.parse(readFileSync(inputPath, 'utf8'));
    const rows = (cached.rows || []).map((row) => ({
      ...row,
      score: row.rubric ? formulas[formulaVariant](row.rubric) : 0,
    })).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

    console.log(JSON.stringify({
      month: cached.month,
      promptText: cached.promptText,
      promptVariant: cached.promptVariant,
      formulaVariant,
      objectCount: rows.length,
      tokenUsage: cached.tokenUsage || null,
      summary: summarize(rows.map((row) => row.score)),
    }, null, 2));
    console.log('\nTop 10');
    rows.slice(0, 10).forEach((row, index) => {
      console.log(`${index + 1}. ${row.score} ${row.key} ${row.oneLiner}`);
    });
    console.log('\nBottom 10');
    rows.slice(-10).forEach((row) => {
      console.log(`${row.score} ${row.key} ${row.oneLiner}`);
    });
    return;
  }

  const keys = await listKeys(`draw/prompt-${month}/`);
  const rows = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const key of keys) {
    const imageBuffer = await getObjectBuffer(key);
    const inkRatio = computeInkRatio(imageBuffer);
    if (inkRatio < 0.001) {
      rows.push({ key, score: 0, rubric: null, inkRatio, oneLiner: 'gate', tips: [] });
      continue;
    }
    const ai = await invokePrimary(imageBuffer.toString('base64'));
    totalInputTokens += Number(ai.usage.input_tokens || 0);
    totalOutputTokens += Number(ai.usage.output_tokens || 0);
    const rubric = normalizeRubric(ai.data);
    const score = formulas[formulaVariant](rubric);
    rows.push({
      key,
      score,
      rubric,
      inkRatio,
      oneLiner: String(ai.data?.oneLiner || '').trim(),
      tips: Array.isArray(ai.data?.tips) ? ai.data.tips.slice(0, 3) : [],
    });
  }

  rows.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  console.log(JSON.stringify({
    month,
    promptText,
    promptVariant,
    formulaVariant,
    objectCount: rows.length,
    tokenUsage: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    summary: summarize(rows.map((row) => row.score)),
  }, null, 2));
  console.log('\nTop 10');
  rows.slice(0, 10).forEach((row, index) => {
    console.log(`${index + 1}. ${row.score} ${row.key} ${row.oneLiner}`);
  });
  console.log('\nBottom 10');
  rows.slice(-10).forEach((row) => {
    console.log(`${row.score} ${row.key} ${row.oneLiner}`);
  });

  if (outputPath) {
    writeFileSync(outputPath, JSON.stringify({
      month,
      promptText,
      promptVariant,
      formulaVariant,
      tokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      rows,
    }, null, 2));
    console.log(`\nSaved raw rows to ${outputPath}`);
  }
};

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
