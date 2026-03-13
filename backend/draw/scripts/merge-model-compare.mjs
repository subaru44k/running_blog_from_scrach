import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const leftPath = resolve(process.cwd(), process.argv[2] || '');
const rightPath = resolve(process.cwd(), process.argv[3] || '');
const outputPath = resolve(process.cwd(), process.argv[4] || `artifacts/model-compare-merged-${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
const outputJsonPath = outputPath.replace(/\.html?$/i, '.json');

if (!process.argv[2] || !process.argv[3]) {
  console.error('usage: node scripts/merge-model-compare.mjs <left.json> <right.json> [output.html]');
  process.exit(1);
}

const left = JSON.parse(readFileSync(leftPath, 'utf8'));
const right = JSON.parse(readFileSync(rightPath, 'utf8'));

const merged = {
  month: left.month || right.month,
  runTimestamp: new Date().toISOString(),
  promptText: left.promptText || right.promptText,
  recordsByProvider: {
    ...(left.recordsByProvider || {}),
    ...(right.recordsByProvider || {}),
  },
  durations: {
    ...(left.durations || {}),
    ...(right.durations || {}),
  },
  runDiffs: {
    ...(left.runDiffs || {}),
    ...(right.runDiffs || {}),
  },
  providerErrors: {
    ...(left.providerErrors || {}),
    ...(right.providerErrors || {}),
  },
  previousReport: `${basename(leftPath)} + ${basename(rightPath)}`,
};

const providers = [
  ['haiku3', 'Claude 3 Haiku'],
  ['gpt41mini', 'GPT-4.1 mini'],
  ['gemini25flash', 'Gemini 2.5 Flash'],
];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>モデル比較 ${escapeHtml(merged.month)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f5f4ef; color: #1f2937; }
    main { max-width: 1320px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .lead,.meta-run,.muted { color: #6b7280; }
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
  </style>
</head>
<body>
  <main>
    <h1>採点モデル比較 ${escapeHtml(merged.month)}</h1>
    <p class="lead">同じ画像を、現在の rubric とスコア式で各モデルに再採点させた比較です。上位順に並べています。</p>
    <p class="meta-run">統合元: ${escapeHtml(merged.previousReport)}</p>
    ${providers.map(([key, label]) => {
      const rows = merged.recordsByProvider[key] || [];
      const error = merged.providerErrors[key];
      const duration = merged.durations[key];
      const diff = merged.runDiffs[key];
      if (!rows.length) {
        return `<section class="model-block"><h2>${escapeHtml(label)}</h2><p class="muted">${escapeHtml(error || '結果がありません')}</p></section>`;
      }
      return `<section class="model-block">
        <h2>${escapeHtml(label)}</h2>
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
            </article>`).join('')}
        </div>
      </section>`;
    }).join('\n')}
  </main>
</body>
</html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputJsonPath, JSON.stringify(merged, null, 2));
writeFileSync(outputPath, html);
console.log(`Saved merged report: ${outputPath}`);
console.log(`Saved merged json: ${outputJsonPath}`);
