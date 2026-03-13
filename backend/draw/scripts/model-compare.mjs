import { DynamoDBClient, ExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

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
const PROMPT_TEXT = process.env.MODEL_COMPARE_PROMPT
  || (MONTH === '2026-02' ? '30秒で熊を描いて' : MONTH === '2026-03' ? '30秒で猫を描いて' : '30秒でお題の絵を描いて');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const HAIKU_MODEL = process.env.PRIMARY_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const PROVIDER_FILTER = new Set(
  String(process.env.MODEL_COMPARE_ONLY || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

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
必ずJSONのみで返してください。説明文や前置きは不要です。`;

const RUBRIC_INSTRUCTION =
  `お題: ${PROMPT_TEXT || 'お題不明'}\n` +
  `画像を評価して、次のJSONスキーマで返してください。\n` +
  `{"rubric":{"promptMatch":0-10,"composition":0-10,"shapeClarity":0-10,"lineStability":0-10,"creativity":0-10,"completeness":0-10},` +
  `"oneLiner":"90文字以内の前向き短評","tips":["短い名詞句を2-3個"]}\n` +
  `採点基準を固定する。0-2は成立していない、3-4はかなり弱い、5-6は平均的、7はやや良い、8は明確に良い、9はかなり良い、10はごく少数の例外的に強い作品のみ。` +
  `rubricは必ず1点刻みの整数で評価すること。` +
  `各項目は自然に評価し、同じ値が複数あってもよい。` +
  `お題と違うものを描いている場合は promptMatch を低くしてよい。` +
  `読みにくい絵や未完成の絵には低い点を付けてよい。` +
  `明確に良い点がある場合だけ高い点を付けること。` +
  `oneLinerとtipsは日本語のみで出力し、英語表現は使わないこと。` +
  `tipsは体言止めの短い語句にすること。`;

const toInt = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const clampRubric = (v) => Math.max(0, Math.min(10, toInt(v)));
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
  return clampScore(Math.max(20, weighted * 14));
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
    const oneLiner = ((text.match(/"oneLiner"\s*:\s*"([\s\S]*?)"/) || [])[1] || '').replace(/\\"/g, '"').replace(/\\n/g, ' ');
    const tipsBlock = (text.match(/"tips"\s*:\s*\[([\s\S]*?)\]/) || [])[1] || '';
    const tips = Array.from(tipsBlock.matchAll(/"((?:\\.|[^"\\])*)"/g)).map((m) => m[1].replace(/\\"/g, '"'));
    return {
      rubric: { promptMatch, composition, shapeClarity, lineStability, creativity, completeness },
      oneLiner,
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
    Statement: `SELECT submissionId, createdAt, score, imageKey, oneLiner FROM "${TABLE}" WHERE promptId = ?`,
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

const invokeHaiku = async (imageBase64) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.3,
    system: PRIMARY_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: RUBRIC_INSTRUCTION },
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

const invokeOpenAI = async (imageBase64) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      input: [{
        role: 'system',
        content: [{ type: 'input_text', text: PRIMARY_SYSTEM_PROMPT }],
      }, {
        role: 'user',
        content: [
          { type: 'input_text', text: RUBRIC_INSTRUCTION },
          { type: 'input_image', image_url: `data:image/png;base64,${imageBase64}` },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = Array.isArray(payload?.output)
    ? payload.output.flatMap((block) => block?.content || []).filter((c) => c?.type === 'output_text').map((c) => c?.text || '').join('\n').trim()
    : '';
  return {
    provider: 'gpt-4.1-mini',
    usage: payload?.usage || {},
    data: parseJsonLoose(text),
  };
};

const invokeGemini = async (imageBase64) => {
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
          { text: RUBRIC_INSTRUCTION },
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

const providers = [
  { key: 'haiku3', label: 'Claude 3 Haiku', enabled: true, invoke: invokeHaiku },
  { key: 'gpt41mini', label: 'GPT-4.1 mini', enabled: Boolean(OPENAI_API_KEY), invoke: invokeOpenAI },
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

const buildHtml = (recordsByProvider, meta) => {
  const sections = providers.map((provider) => {
    const providerError = meta?.providerErrors?.[provider.key];
    if (!provider.enabled || providerError) {
      return `
        <section class="model-block">
          <h2>${escapeHtml(provider.label)}</h2>
          <p class="muted">${providerError ? `比較未実行: ${escapeHtml(providerError)}` : '比較未実行: APIキーが設定されていません。'}</p>
        </section>`;
    }
    const rows = recordsByProvider[provider.key] || [];
    const duration = meta?.durations?.[provider.key];
    const diff = meta?.runDiffs?.[provider.key];
    return `
      <section class="model-block">
        <h2>${escapeHtml(provider.label)}</h2>
        <p class="muted">
          ${duration ? `平均 ${duration.avgMs}ms / 最小 ${duration.minMs}ms / 最大 ${duration.maxMs}ms / 合計 ${(duration.totalMs / 1000).toFixed(1)}秒` : ''}
          ${duration && diff ? ' / ' : ''}
          ${diff ? `前回との差: 変更 ${diff.changed}/${diff.compared}件, 平均差 ${diff.avgAbsDelta}, 最大差 ${diff.maxAbsDelta}` : ''}
        </p>
        <div class="grid">
          ${rows.map((row, index) => `
            <article class="card">
              <div class="meta">
                <span class="rank">#${index + 1}</span>
                <span>${escapeHtml(row.submissionId)}</span>
                <span>旧:${row.oldScore}</span>
                <span>新:${row.newScore}</span>
              </div>
              <img src="${row.imageDataUrl}" alt="submission ${escapeHtml(row.submissionId)}" />
              <p class="comment">${escapeHtml(row.oneLiner)}</p>
              <div class="tips">${(row.tips || []).map((tip) => `<span>${escapeHtml(tip)}</span>`).join('')}</div>
              <dl class="rubric">
                <div><dt>お題一致</dt><dd>${row.rubric.promptMatch}</dd></div>
                <div><dt>構図</dt><dd>${row.rubric.composition}</dd></div>
                <div><dt>形</dt><dd>${row.rubric.shapeClarity}</dd></div>
                <div><dt>線</dt><dd>${row.rubric.lineStability}</dd></div>
                <div><dt>工夫</dt><dd>${row.rubric.creativity}</dd></div>
                <div><dt>完成度</dt><dd>${row.rubric.completeness}</dd></div>
              </dl>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }).join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>モデル比較 ${escapeHtml(MONTH)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f5f4ef; color: #1f2937; }
    main { max-width: 1320px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .lead { color: #4b5563; margin-bottom: 1.5rem; }
    .meta-run { color: #6b7280; font-size: 0.95rem; margin-bottom: 1.75rem; }
    .model-block { margin-top: 2.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .card { background: rgba(255,255,255,0.88); border: 1px solid rgba(15,23,42,0.08); border-radius: 18px; padding: 14px; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.82rem; color: #475569; margin-bottom: 10px; }
    .rank { font-weight: 700; color: #92400e; }
    img { width: 100%; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,0.08); }
    .comment { min-height: 3.2em; line-height: 1.5; }
    .tips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .tips span { background: #fef3c7; color: #92400e; border-radius: 999px; padding: 4px 10px; font-size: 0.78rem; }
    .rubric { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; margin: 0; }
    .rubric div { display: flex; justify-content: space-between; gap: 8px; font-size: 0.84rem; }
    .rubric dt { color: #64748b; }
    .rubric dd { margin: 0; font-weight: 700; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
  <main>
    <h1>採点モデル比較 ${escapeHtml(MONTH)}</h1>
    <p class="lead">同じ画像を、現在の rubric とスコア式で各モデルに再採点させた比較です。上位順に並べています。</p>
    <p class="meta-run">実行日時: ${escapeHtml(meta?.runTimestamp || '')} / 出力ファイル: ${escapeHtml(basename(OUTPUT_PATH))}${meta?.previousReport ? ` / 前回比較: ${escapeHtml(meta.previousReport)}` : ''}</p>
    ${sections}
  </main>
</body>
</html>`;
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
      oldScore: Number(row.score || 0),
      imageDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      imageBase64: buffer.toString('base64'),
    };
  }));

  const recordsByProvider = {};
  const durations = {};
  const providerErrors = {};
  for (const provider of providers) {
    if (!provider.enabled) continue;
    const providerRows = [];
    const providerDurations = [];
    try {
      for (const image of images) {
        const startedAt = Date.now();
        const ai = await provider.invoke(image.imageBase64);
        const elapsedMs = Date.now() - startedAt;
        providerDurations.push(elapsedMs);
        const rubric = normalizeRubric(ai.data);
        providerRows.push({
          submissionId: image.submissionId,
          createdAt: image.createdAt,
          oldScore: image.oldScore,
          newScore: computeScore(rubric),
          imageDataUrl: image.imageDataUrl,
          oneLiner: String(ai.data?.oneLiner || '').trim(),
          tips: Array.isArray(ai.data?.tips) ? ai.data.tips.slice(0, 3) : [],
          rubric,
          usage: ai.usage || {},
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
    promptText: PROMPT_TEXT,
    recordsByProvider,
    durations,
    runDiffs,
    providerErrors,
    previousReport: previousReportName,
  };
  writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(payload, null, 2));
  writeFileSync(OUTPUT_PATH, buildHtml(recordsByProvider, payload));
  console.log(`Saved report: ${OUTPUT_PATH}`);
  console.log(`Saved json: ${JSON_OUTPUT_PATH}`);
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
    console.log(`${provider.label}: ${rowsForProvider.length} images, top5=${top}, avg=${duration?.avgMs ?? '-'}ms, min=${duration?.minMs ?? '-'}ms, max=${duration?.maxMs ?? '-'}ms${diff ? `, prevChanged=${diff.changed}/${diff.compared}, prevAvgAbs=${diff.avgAbsDelta}` : ''}`);
  }
};

main().catch((error) => {
  console.error('FAILED', error);
  process.exit(1);
});
