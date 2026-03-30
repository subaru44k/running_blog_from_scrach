import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const OUTPUT_DIR = resolve(process.cwd(), 'artifacts');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'dressup-preview-b.html');

const modelPath = resolve(process.cwd(), 'artifacts/dressup-model-variants/model-princess-base-b.png');
const assetDir = resolve(process.cwd(), 'artifacts/dressup-asset-samples-b');
const items = [
  { id: 'hair', label: 'ティアラ', file: 'item-hair-tiara.png' },
  { id: 'necklace', label: 'ハートネックレス', file: 'item-necklace-heart.png' },
  { id: 'top', label: 'フリルブラウス', file: 'item-top-frill-blouse.png' },
  { id: 'bottom', label: 'ふんわりスカート', file: 'item-bottom-fluffy-skirt.png' },
  { id: 'shoes', label: 'リボンシューズ', file: 'item-shoes-ribbon.png' },
];

if (!existsSync(modelPath)) {
  console.error(`Missing model asset: ${modelPath}`);
  process.exit(1);
}

for (const item of items) {
  const fullPath = resolve(assetDir, item.file);
  if (!existsSync(fullPath)) {
    console.error(`Missing item asset: ${fullPath}`);
    process.exit(1);
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const rel = (path) => relative(OUTPUT_DIR, path).replaceAll('\\', '/');

const modelSrc = rel(modelPath);
const itemCards = items
  .map((item) => {
    const src = rel(resolve(assetDir, item.file));
    return `
      <article class="asset-card">
        <div class="asset-thumb">
          <img src="${src}" alt="${item.label}" />
        </div>
        <div class="asset-meta">
          <strong>${item.label}</strong>
          <code>${item.file}</code>
        </div>
      </article>
    `;
  })
  .join('');

const stackLayers = items
  .map((item) => {
    const src = rel(resolve(assetDir, item.file));
    return `<img class="dressup-layer dressup-layer-${item.id}" src="${src}" alt="${item.label}" />`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Preview B</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #fff8fb;
        --panel: rgba(255, 255, 255, 0.88);
        --line: rgba(244, 114, 182, 0.16);
        --text: #1e293b;
        --muted: #64748b;
        --shadow: 0 24px 60px rgba(236, 72, 153, 0.14);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.85), transparent 42%),
          linear-gradient(180deg, #fff8fb 0%, #fff1f7 100%);
      }
      main {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }
      .hero {
        margin-bottom: 20px;
      }
      .kicker {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.22em;
        font-weight: 700;
        color: #db2777;
      }
      h1 {
        margin: 8px 0 10px;
        font-size: clamp(28px, 4vw, 44px);
      }
      .lead {
        margin: 0;
        max-width: 700px;
        color: var(--muted);
        line-height: 1.8;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(320px, 520px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .panel {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        backdrop-filter: blur(10px);
        box-shadow: var(--shadow);
      }
      .preview-panel {
        padding: 24px;
      }
      .preview-stage {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        overflow: hidden;
        border-radius: 24px;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.92), transparent 40%),
          linear-gradient(180deg, #fffdf5 0%, #fff4f8 100%);
        border: 1px solid rgba(244, 114, 182, 0.14);
      }
      .dressup-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        pointer-events: none;
      }
      .label-strip {
        margin-top: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .chip {
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.9);
        border: 1px solid rgba(148,163,184,0.24);
        font-size: 14px;
        font-weight: 700;
      }
      .sidebar {
        padding: 24px;
      }
      .sidebar h2 {
        margin: 0 0 12px;
        font-size: 20px;
      }
      .sidebar p {
        margin: 0 0 16px;
        color: var(--muted);
        line-height: 1.7;
      }
      .asset-grid {
        display: grid;
        gap: 12px;
      }
      .asset-card {
        display: grid;
        grid-template-columns: 96px minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,0.2);
        background: rgba(255,255,255,0.92);
        padding: 12px;
      }
      .asset-thumb {
        aspect-ratio: 1 / 1;
        border-radius: 14px;
        background: linear-gradient(180deg, #fffdf5, #fff6fa);
        border: 1px solid rgba(244,114,182,0.12);
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .asset-thumb img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .asset-meta {
        display: grid;
        gap: 6px;
      }
      .asset-meta strong {
        font-size: 15px;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        color: #475569;
        word-break: break-all;
      }
      .source {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.82);
        border: 1px solid rgba(148,163,184,0.2);
      }
      .source strong {
        display: block;
        margin-bottom: 6px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .preview-panel,
        .sidebar {
          padding: 18px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="kicker">DRESSUP PREVIEW</p>
        <h1>Bモデル向け PNG プレビュー</h1>
        <p class="lead">人物モデル B に、B 寄せで再生成した 5 アイテムを重ねた確認用プレビューです。実装前に、世界観と重ねたときの印象を見るための 1 枚です。</p>
      </section>

      <section class="layout">
        <article class="panel preview-panel">
          <div class="preview-stage">
            <img class="dressup-layer dressup-layer-model" src="${modelSrc}" alt="人物モデルB" />
            ${stackLayers}
          </div>
          <div class="label-strip">
            <span class="chip">人物: model-princess-base-b.png</span>
            <span class="chip">アイテム: B寄せ再生成 5種</span>
          </div>
        </article>

        <aside class="panel sidebar">
          <h2>使用した素材</h2>
          <p>下の 5 アイテムは、人物モデル B のテイストに寄せて再生成したものです。ゲーム実装ではなく、素材方向性の確認用です。</p>
          <div class="asset-grid">
            ${itemCards}
          </div>
          <div class="source">
            <strong>人物モデル</strong>
            <code>${modelSrc}</code>
          </div>
        </aside>
      </section>
    </main>
  </body>
</html>`;

writeFileSync(OUTPUT_PATH, html);
console.log(`preview: ${OUTPUT_PATH}`);
