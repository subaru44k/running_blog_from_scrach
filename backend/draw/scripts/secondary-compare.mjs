import { DynamoDBClient, ExecuteStatementCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const TABLE = process.env.DRAW_TABLE || 'DrawSubmissions';
const BUCKET = process.env.DRAW_BUCKET || 'draw-uploads-20260124-58904f87';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const SECONDARY_MODEL_ID = process.env.SECONDARY_MODEL_ID || 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';
const month = process.argv[2] || '2026-02';
const limit = Number(process.argv[3] || 10);
const promptId = `prompt-${month}`;
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = resolve(process.cwd(), `artifacts/secondary-compare-${month}-${runTimestamp}.html`);
const outputJsonPath = outputPath.replace(/\.html?$/i, '.json');

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

const ddb = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({
  region: REGION,
  requestChecksumCalculation: 'never',
  responseChecksumValidation: 'never',
});
const bedrock = new BedrockRuntimeClient({ region: REGION });

const systemPrompt = `あなたは30秒お絵描きゲームの二次講評担当です。
丁寧で前向きな日本語で、短く実用的な講評を返してください。`;

const buildSecondaryInstruction = (params) =>
  `お題: ${params.promptText || 'お題不明'}\n` +
  `一次結果: score=${params.score}, breakdown=${JSON.stringify(params.breakdown)}, oneLiner=${params.oneLiner}, tips=${params.tips.join(',')}\n` +
  `日本語で2〜4文、220文字以内。\n` +
  `1文目: 良い点を1つ。2〜3文目: 具体的改善点を1〜2個。最後: 前向きに締める。`;

const getObjectBuffer = async (key) => {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!out.Body) throw new Error(`empty S3 body: ${key}`);
  const chunks = [];
  for await (const c of out.Body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
};

const queryRows = async () => {
  const out = await ddb.send(new ExecuteStatementCommand({
    Statement: `SELECT promptId, submissionId, createdAt, score, rank, imageKey, promptText, breakdown, oneLiner, tips, secondaryStatus FROM "${TABLE}" WHERE promptId = ?`,
    Parameters: [{ S: promptId }],
  }));
  return (out.Items || [])
    .map((item) => unmarshall(item))
    .filter((row) => row?.submissionId && row?.imageKey)
    .sort((a, b) => {
      const rankA = Number(a.rank || 999);
      const rankB = Number(b.rank || 999);
      if (rankA !== rankB) return rankA - rankB;
      if (Number(b.score || 0) !== Number(a.score || 0)) return Number(b.score || 0) - Number(a.score || 0);
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    })
    .slice(0, limit);
};

const readBodyString = async (body) => {
  if (!body) return '';
  if (typeof body.transformToString === 'function') return body.transformToString();
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  return '';
};

const invokeHaikuSecondary = async (params) => {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    temperature: 0.4,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: buildSecondaryInstruction(params) },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: params.imageBase64 } },
      ],
    }],
  };
  const out = await bedrock.send(new InvokeModelCommand({
    modelId: SECONDARY_MODEL_ID,
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
    text,
    usage: parsed?.usage || {},
  };
};

const invokeOpenAISecondary = async (params) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      input: [{
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      }, {
        role: 'user',
        content: [
          { type: 'input_text', text: buildSecondaryInstruction(params) },
          { type: 'input_image', image_url: `data:image/png;base64,${params.imageBase64}` },
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
    text,
    usage: payload?.usage || {},
  };
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const buildHtml = (rows) => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>二次コメント比較 ${escapeHtml(month)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f5f4ef; color: #1f2937; }
    main { max-width: 1320px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .lead,.muted { color: #6b7280; }
    .grid { display: grid; gap: 20px; }
    .card { background: rgba(255,255,255,0.88); border: 1px solid rgba(15,23,42,0.08); border-radius: 18px; padding: 16px; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .head { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:12px; color:#475569; font-size:0.88rem; }
    .rank { font-weight:700; color:#92400e; }
    .body { display:grid; grid-template-columns: minmax(220px, 320px) 1fr 1fr; gap: 16px; align-items:start; }
    img { width:100%; border-radius:14px; border:1px solid rgba(15,23,42,0.08); background:#fff; }
    .panel { border:1px solid rgba(15,23,42,0.08); border-radius:14px; padding:14px; background:#fff; }
    .panel h3 { margin:0 0 10px; font-size:1rem; }
    .comment { white-space:pre-wrap; line-height:1.7; }
    .meta { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .meta span { background:#fef3c7; color:#92400e; border-radius:999px; padding:4px 10px; font-size:0.78rem; }
    .small { font-size:0.82rem; color:#64748b; margin-top:10px; }
    @media (max-width: 960px) { .body { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>二次コメント比較 ${escapeHtml(month)}</h1>
    <p class="lead">同じ画像・同じ一次結果から、Haiku 4.5 と GPT-4.1 mini が生成した二次コメントを並べた比較です。</p>
    <div class="grid">
      ${rows.map((row) => `
        <article class="card">
          <div class="head">
            <span class="rank">#${escapeHtml(row.rank ?? '-')}</span>
            <span>${escapeHtml(row.submissionId)}</span>
            <span>score ${escapeHtml(row.score)}</span>
            <span>${escapeHtml(row.createdAt)}</span>
          </div>
          <div class="body">
            <div class="panel">
              <img src="${row.imageDataUrl}" alt="submission ${escapeHtml(row.submissionId)}" />
              <div class="meta">
                ${(row.tips || []).map((tip) => `<span>${escapeHtml(tip)}</span>`).join('')}
              </div>
              <p class="small">secondaryStatus: ${escapeHtml(row.secondaryStatus || '-')}</p>
            </div>
            <section class="panel">
              <h3>Haiku 4.5</h3>
              <p class="comment">${escapeHtml(row.haikuComment)}</p>
            </section>
            <section class="panel">
              <h3>GPT-4.1 mini</h3>
              <p class="comment">${escapeHtml(row.gptComment)}</p>
            </section>
          </div>
        </article>
      `).join('')}
    </div>
  </main>
</body>
</html>`;

const main = async () => {
  const rows = await queryRows();
  const results = [];
  for (const row of rows) {
    const imageBuffer = await getObjectBuffer(row.imageKey);
    const imageBase64 = imageBuffer.toString('base64');
    const params = {
      promptText: String(row.promptText || 'お題不明'),
      imageBase64,
      score: Number(row.score || 0),
      breakdown: row.breakdown || { likeness: 0, composition: 0, originality: 0 },
      oneLiner: String(row.oneLiner || ''),
      tips: Array.isArray(row.tips) ? row.tips : [],
    };
    const [haiku, gpt] = await Promise.all([
      invokeHaikuSecondary(params),
      invokeOpenAISecondary(params),
    ]);
    results.push({
      submissionId: row.submissionId,
      createdAt: row.createdAt,
      rank: row.rank,
      score: row.score,
      tips: Array.isArray(row.tips) ? row.tips : [],
      secondaryStatus: row.secondaryStatus,
      haikuComment: haiku.text,
      gptComment: gpt.text,
      haikuUsage: haiku.usage,
      gptUsage: gpt.usage,
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
    });
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputJsonPath, JSON.stringify({ month, promptId, results }, null, 2));
  writeFileSync(outputPath, buildHtml(results));
  console.log(`Saved report: ${outputPath}`);
  console.log(`Saved json: ${outputJsonPath}`);
};

main().catch((error) => {
  console.error('FAILED', error);
  process.exit(1);
});
