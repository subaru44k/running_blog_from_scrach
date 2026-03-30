import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { PNG } from 'pngjs';

const ROOT_DIR = resolve(process.cwd(), 'artifacts/dressup-pilot-b');
const RAW_DIR = resolve(ROOT_DIR, 'raw');
const NORMALIZED_DIR = resolve(ROOT_DIR, 'normalized');
const SPLIT_DIR = resolve(ROOT_DIR, 'split');
const PREVIEW_PATH = resolve(ROOT_DIR, 'preview.html');
const VIEWER_PATH = resolve(ROOT_DIR, 'placement-viewer.html');
const PLACEMENT_PATH = resolve(ROOT_DIR, 'placement.json');
const NORMALIZED_MANIFEST_PATH = resolve(ROOT_DIR, 'normalized-manifest.json');
const SPLIT_MANIFEST_PATH = resolve(ROOT_DIR, 'split-manifest.json');

const THRESHOLD = 16;
const CANVAS_SIZE = 1024;

const placement = {
  hair: { label: 'ティアラ', visible: true, x: 0, y: -125, scale: 0.69, z: 5 },
  necklace: { label: 'ネックレス', visible: true, x: -4, y: 20, scale: 0.82, z: 4 },
  top: { label: 'トップス', visible: true, x: 0, y: -43, scale: 0.56, z: 3 },
  bottom: { label: 'ボトムス', visible: true, x: 2, y: 14, scale: 0.82, z: 2 },
  leftShoe: { label: '左くつ', visible: true, x: 9, y: 85, scale: 0.8, z: 1 },
  rightShoe: { label: '右くつ', visible: true, x: -7, y: 85, scale: 0.8, z: 1 },
};

const slots = {
  hair: {
    label: 'かみかざり',
    rect: { x: 344, y: 28, w: 340, h: 128 },
    alignY: 'bottom',
    items: [
      ['gold-tiara', 'ティアラ', 'item-hair-gold-tiara.png'],
      ['pink-ribbon', 'ピンクのリボン', 'item-hair-pink-ribbon.png'],
      ['sun-flower', 'おはなのかざり', 'item-hair-sun-flower.png'],
      ['star-pin', 'ほしのピン', 'item-hair-star-pin.png'],
      ['pearl-band', 'パールカチューシャ', 'item-hair-pearl-band.png'],
    ],
  },
  necklace: {
    label: 'ネックレス',
    rect: { x: 392, y: 178, w: 248, h: 120 },
    alignY: 'center',
    items: [
      ['heart-necklace', 'ハートのネックレス', 'item-necklace-heart-necklace.png'],
      ['pearl-necklace', 'パールのネックレス', 'item-necklace-pearl-necklace.png'],
      ['star-necklace', 'ほしのネックレス', 'item-necklace-star-necklace.png'],
      ['ribbon-choker', 'りぼんチョーカー', 'item-necklace-ribbon-choker.png'],
      ['gem-necklace', 'ほうせきネックレス', 'item-necklace-gem-necklace.png'],
    ],
  },
  top: {
    label: 'トップス',
    rect: { x: 244, y: 152, w: 536, h: 378 },
    alignY: 'center',
    items: [
      ['frill-blouse', 'ふりふりブラウス', 'item-top-frill-blouse.png'],
      ['pink-blouse', 'ピンクのブラウス', 'item-top-pink-blouse.png'],
      ['puff-blouse', 'パフそでブラウス', 'item-top-puff-blouse.png'],
      ['lace-top', 'レーストップス', 'item-top-lace-top.png'],
      ['cape-top', 'ケープつきトップス', 'item-top-cape-top.png'],
    ],
  },
  bottom: {
    label: 'ボトムス',
    rect: { x: 230, y: 430, w: 560, h: 328 },
    alignY: 'top',
    items: [
      ['frill-skirt', 'フリルスカート', 'item-bottom-frill-skirt.png'],
      ['pink-skirt', 'ピンクのふんわりスカート', 'item-bottom-pink-skirt.png'],
      ['lavender-longskirt', 'ラベンダースカート', 'item-bottom-lavender-longskirt.png'],
      ['denim-shorts', 'デニムショート', 'item-bottom-denim-shorts.png'],
      ['rain-pants', 'レインパンツ', 'item-bottom-rain-pants.png'],
    ],
  },
  shoes: {
    label: 'くつ',
    rect: { x: 388, y: 850, w: 244, h: 126 },
    alignY: 'bottom',
    items: [
      ['ribbon-shoes', 'リボンシューズ', 'item-shoes-ribbon-shoes.png'],
      ['pink-ballet', 'ピンクのくつ', 'item-shoes-pink-ballet.png'],
      ['white-pumps', 'しろいパンプス', 'item-shoes-white-pumps.png'],
      ['yellow-rainboots', 'レインブーツ', 'item-shoes-yellow-rainboots.png'],
      ['blue-sneakers', 'スニーカー', 'item-shoes-blue-sneakers.png'],
    ],
  },
};

const modelPath = resolve(process.cwd(), 'artifacts/dressup-model-variants/model-princess-base-b.png');
if (!existsSync(modelPath)) {
  console.error(`Missing model asset: ${modelPath}`);
  process.exit(1);
}
if (!existsSync(RAW_DIR)) {
  console.error(`Missing raw asset dir: ${RAW_DIR}`);
  process.exit(1);
}

const readPng = (path) => PNG.sync.read(readFileSync(path));
const getAlpha = (png, x, y) => png.data[(png.width * y + x) * 4 + 3];

const getBBox = (png, threshold) => {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (getAlpha(png, x, y) >= threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const cropPng = (png, bbox) => {
  const out = new PNG({ width: bbox.width, height: bbox.height });
  for (let y = 0; y < bbox.height; y += 1) {
    for (let x = 0; x < bbox.width; x += 1) {
      const srcIdx = ((png.width * (bbox.y + y)) + (bbox.x + x)) * 4;
      const dstIdx = ((out.width * y) + x) * 4;
      out.data[dstIdx + 0] = png.data[srcIdx + 0];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
};

const resizeNearest = (png, width, height) => {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(png.height - 1, Math.floor((y / height) * png.height));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(png.width - 1, Math.floor((x / width) * png.width));
      const srcIdx = ((png.width * srcY) + srcX) * 4;
      const dstIdx = ((out.width * y) + x) * 4;
      out.data[dstIdx + 0] = png.data[srcIdx + 0];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
};

const composite = (dst, src, offsetX, offsetY) => {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const dstX = offsetX + x;
      const dstY = offsetY + y;
      if (dstX < 0 || dstY < 0 || dstX >= dst.width || dstY >= dst.height) continue;
      const srcIdx = ((src.width * y) + x) * 4;
      const dstIdx = ((dst.width * dstY) + dstX) * 4;
      const srcA = src.data[srcIdx + 3] / 255;
      if (srcA === 0) continue;
      const dstA = dst.data[dstIdx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      const blend = (srcC, dstC) => Math.round((srcC * srcA + dstC * dstA * (1 - srcA)) / outA);
      dst.data[dstIdx + 0] = blend(src.data[srcIdx + 0], dst.data[dstIdx + 0]);
      dst.data[dstIdx + 1] = blend(src.data[srcIdx + 1], dst.data[dstIdx + 1]);
      dst.data[dstIdx + 2] = blend(src.data[srcIdx + 2], dst.data[dstIdx + 2]);
      dst.data[dstIdx + 3] = Math.round(outA * 255);
    }
  }
};

const placeWithinRect = (rect, width, height, alignY) => {
  const x = rect.x + Math.round((rect.w - width) / 2);
  let y = rect.y;
  if (alignY === 'center') y = rect.y + Math.round((rect.h - height) / 2);
  if (alignY === 'bottom') y = rect.y + rect.h - height;
  return { x, y };
};

mkdirSync(ROOT_DIR, { recursive: true });
mkdirSync(NORMALIZED_DIR, { recursive: true });
mkdirSync(SPLIT_DIR, { recursive: true });

const normalizedManifest = {
  threshold: THRESHOLD,
  canvasSize: CANVAS_SIZE,
  generatedAt: new Date().toISOString(),
  items: [],
};

for (const [slot, config] of Object.entries(slots)) {
  for (const [id, label, file] of config.items) {
    const inputPath = resolve(RAW_DIR, file);
    if (!existsSync(inputPath)) {
      console.error(`Missing raw asset: ${inputPath}`);
      process.exit(1);
    }
    const png = readPng(inputPath);
    const bbox = getBBox(png, THRESHOLD);
    if (!bbox) {
      console.error(`No alpha bbox found for ${file}`);
      process.exit(1);
    }
    const cropped = cropPng(png, bbox);
    const scale = Math.min(config.rect.w / cropped.width, config.rect.h / cropped.height);
    const targetWidth = Math.max(1, Math.round(cropped.width * scale));
    const targetHeight = Math.max(1, Math.round(cropped.height * scale));
    const resized = resizeNearest(cropped, targetWidth, targetHeight);
    const placed = placeWithinRect(config.rect, targetWidth, targetHeight, config.alignY);
    const out = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
    composite(out, resized, placed.x, placed.y);
    const outputPath = resolve(NORMALIZED_DIR, file);
    writeFileSync(outputPath, PNG.sync.write(out));
    normalizedManifest.items.push({
      id,
      label,
      file,
      slot,
      rawBBox: bbox,
      anchorRect: config.rect,
      alignY: config.alignY,
      scale,
      outputPlacement: { x: placed.x, y: placed.y, width: targetWidth, height: targetHeight },
    });
    console.log(`normalized ${file}`);
  }
}

writeFileSync(NORMALIZED_MANIFEST_PATH, JSON.stringify(normalizedManifest, null, 2));

const splitManifest = {
  threshold: THRESHOLD,
  generatedAt: new Date().toISOString(),
  items: [],
};

for (const [id, label, file] of slots.shoes.items) {
  const splitSourcePath = resolve(NORMALIZED_DIR, file);
  const shoePng = readPng(splitSourcePath);
  const activeColumns = [];
  for (let x = 0; x < shoePng.width; x += 1) {
    let active = false;
    for (let y = 0; y < shoePng.height; y += 1) {
      if (shoePng.data[(shoePng.width * y + x) * 4 + 3] >= THRESHOLD) {
        active = true;
        break;
      }
    }
    if (active) activeColumns.push(x);
  }
  if (activeColumns.length === 0) {
    console.error(`No non-transparent pixels found in shoe layer: ${file}`);
    process.exit(1);
  }
  const runs = [];
  let runStart = activeColumns[0];
  let prev = activeColumns[0];
  for (let i = 1; i < activeColumns.length; i += 1) {
    const value = activeColumns[i];
    if (value !== prev + 1) {
      runs.push({ start: runStart, end: prev });
      runStart = value;
    }
    prev = value;
  }
  runs.push({ start: runStart, end: prev });
  if (runs.length !== 2) {
    console.error(`Expected 2 shoe components for ${file}, found ${runs.length}`);
    process.exit(1);
  }
  const copyRange = (source, startX, endX) => {
    const out = new PNG({ width: source.width, height: source.height });
    for (let y = 0; y < source.height; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const srcIdx = ((source.width * y) + x) * 4;
        out.data[srcIdx + 0] = source.data[srcIdx + 0];
        out.data[srcIdx + 1] = source.data[srcIdx + 1];
        out.data[srcIdx + 2] = source.data[srcIdx + 2];
        out.data[srcIdx + 3] = source.data[srcIdx + 3];
      }
    }
    return out;
  };
  const left = copyRange(shoePng, runs[0].start, runs[0].end);
  const right = copyRange(shoePng, runs[1].start, runs[1].end);
  const base = file.replace(/\.png$/, '');
  const leftFile = `${base}-left.png`;
  const rightFile = `${base}-right.png`;
  writeFileSync(resolve(SPLIT_DIR, leftFile), PNG.sync.write(left));
  writeFileSync(resolve(SPLIT_DIR, rightFile), PNG.sync.write(right));
  splitManifest.items.push({
    id,
    label,
    source: relative(ROOT_DIR, splitSourcePath).replaceAll('\\', '/'),
    leftFile,
    rightFile,
    components: [
      { side: 'left', range: runs[0] },
      { side: 'right', range: runs[1] },
    ],
  });
}

writeFileSync(SPLIT_MANIFEST_PATH, JSON.stringify(splitManifest, null, 2));
writeFileSync(PLACEMENT_PATH, JSON.stringify(placement, null, 2));

const relFromRoot = (path) => relative(ROOT_DIR, path).replaceAll('\\', '/');
const normalizedItems = normalizedManifest.items;

const previewCards = normalizedItems
  .map(
    (item) => `
    <article class="asset-card">
      <div class="asset-thumb"><img src="${relFromRoot(resolve(NORMALIZED_DIR, item.file))}" alt="${item.label}" /></div>
      <div class="asset-meta"><strong>${item.label}</strong><span>${slots[item.slot].label}</span><code>${relFromRoot(resolve(NORMALIZED_DIR, item.file))}</code></div>
    </article>
  `,
  )
  .join('');

const defaultStack = {
  hair: 'item-hair-gold-tiara.png',
  necklace: 'item-necklace-heart-necklace.png',
  top: 'item-top-frill-blouse.png',
  bottom: 'item-bottom-frill-skirt.png',
  shoes: 'item-shoes-ribbon-shoes.png',
};

const stackLayers = [
  `<img class="dressup-layer" src="${relFromRoot(modelPath)}" alt="人物モデルB" />`,
  `<img class="dressup-layer" src="${relFromRoot(resolve(NORMALIZED_DIR, defaultStack.hair))}" alt="ティアラ" />`,
  `<img class="dressup-layer" src="${relFromRoot(resolve(NORMALIZED_DIR, defaultStack.necklace))}" alt="ネックレス" />`,
  `<img class="dressup-layer" src="${relFromRoot(resolve(NORMALIZED_DIR, defaultStack.top))}" alt="トップス" />`,
  `<img class="dressup-layer" src="${relFromRoot(resolve(NORMALIZED_DIR, defaultStack.bottom))}" alt="ボトムス" />`,
  `<img class="dressup-layer" src="${relFromRoot(resolve(NORMALIZED_DIR, defaultStack.shoes))}" alt="くつ" />`,
].join('\n');

writeFileSync(
  PREVIEW_PATH,
  `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Pilot Preview B</title>
    <style>
      :root { color-scheme: light; --line: rgba(244,114,182,.16); --text:#1e293b; --muted:#64748b; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:linear-gradient(180deg,#fff8fb 0%,#fff1f7 100%); }
      main { width:min(1200px,calc(100% - 32px)); margin:0 auto; padding:32px 0 48px; }
      .layout { display:grid; grid-template-columns:minmax(320px,520px) minmax(0,1fr); gap:24px; align-items:start; }
      .panel { border:1px solid var(--line); border-radius:28px; background:rgba(255,255,255,.9); box-shadow:0 24px 60px rgba(236,72,153,.14); }
      .preview-panel,.sidebar { padding:24px; }
      .preview-stage { position:relative; width:100%; aspect-ratio:1/1; overflow:hidden; border-radius:24px; background:radial-gradient(circle at top, rgba(255,255,255,.92), transparent 40%), linear-gradient(180deg,#fffdf5 0%,#fff4f8 100%); border:1px solid rgba(244,114,182,.14); }
      .dressup-layer { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; pointer-events:none; }
      .asset-grid { display:grid; gap:12px; max-height:900px; overflow:auto; }
      .asset-card { display:grid; grid-template-columns:96px minmax(0,1fr); gap:12px; align-items:center; border-radius:18px; border:1px solid rgba(148,163,184,.2); background:rgba(255,255,255,.92); padding:12px; }
      .asset-thumb { aspect-ratio:1/1; border-radius:14px; background:linear-gradient(180deg,#fffdf5,#fff6fa); border:1px solid rgba(244,114,182,.12); display:grid; place-items:center; overflow:hidden; }
      .asset-thumb img { width:100%; height:100%; object-fit:contain; }
      .asset-meta { display:grid; gap:6px; }
      .asset-meta span { color:#db2777; font-size:13px; font-weight:700; }
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; color:#475569; word-break:break-all; }
      @media (max-width:900px){ .layout{grid-template-columns:1fr;} .preview-panel,.sidebar{padding:18px;} }
    </style>
  </head>
  <body>
    <main>
      <p style="margin:0;font-size:12px;letter-spacing:.22em;font-weight:700;color:#db2777;">DRESSUP PILOT PREVIEW</p>
      <h1>Bモデル向け 25点パイロットプレビュー</h1>
      <p style="margin:0 0 20px;color:#64748b;line-height:1.8;">各部位5点ずつに広げた PNG パイロットです。左は基準コーデ、右は生成済み normalized レイヤー一覧です。</p>
      <section class="layout">
        <article class="panel preview-panel">
          <div class="preview-stage">${stackLayers}</div>
        </article>
        <aside class="panel sidebar">
          <h2>生成したレイヤー</h2>
          <div class="asset-grid">${previewCards}</div>
        </aside>
      </section>
    </main>
  </body>
</html>`,
);

const viewerCatalog = {
  hair: slots.hair.items.map(([id, label, file]) => ({ id, label, src: relFromRoot(resolve(NORMALIZED_DIR, file)) })),
  necklace: slots.necklace.items.map(([id, label, file]) => ({ id, label, src: relFromRoot(resolve(NORMALIZED_DIR, file)) })),
  top: slots.top.items.map(([id, label, file]) => ({ id, label, src: relFromRoot(resolve(NORMALIZED_DIR, file)) })),
  bottom: slots.bottom.items.map(([id, label, file]) => ({ id, label, src: relFromRoot(resolve(NORMALIZED_DIR, file)) })),
  shoes: slots.shoes.items.map(([id, label, file]) => {
    const base = file.replace(/\.png$/, '');
    return {
      id,
      label,
      leftSrc: relFromRoot(resolve(SPLIT_DIR, `${base}-left.png`)),
      rightSrc: relFromRoot(resolve(SPLIT_DIR, `${base}-right.png`)),
    };
  }),
};

writeFileSync(
  VIEWER_PATH,
  `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Pilot Placement Viewer B</title>
    <style>
      :root { color-scheme: light; --text:#1e293b; --muted:#64748b; --line:rgba(244,114,182,.16); --panel:rgba(255,255,255,.92); }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:linear-gradient(180deg,#fff8fb 0%,#fff1f7 100%); }
      main { width:min(1280px,calc(100% - 32px)); margin:0 auto; padding:24px 0 40px; }
      h1 { margin:8px 0 10px; font-size:clamp(28px,4vw,40px); }
      .lead { margin:0 0 20px; color:var(--muted); line-height:1.8; }
      .layout { display:grid; grid-template-columns:minmax(320px,720px) minmax(340px,1fr); gap:20px; align-items:start; }
      .panel { border:1px solid var(--line); border-radius:24px; background:var(--panel); box-shadow:0 24px 60px rgba(236,72,153,.12); }
      .stage-panel { padding:18px; }
      .stage { position:relative; width:min(100%,720px); aspect-ratio:1/1; margin:0 auto; overflow:hidden; border-radius:20px; background:radial-gradient(circle at top, rgba(255,255,255,.92), transparent 40%), linear-gradient(180deg, #fffdf5 0%, #fff4f8 100%); border:1px solid rgba(244,114,182,.14); }
      .layer { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:block; pointer-events:none; transform-origin:center center; }
      .layer.selected { filter: drop-shadow(0 0 10px rgba(244,114,182,.46)); }
      .crosshair { position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(to right, transparent calc(50% - .5px), rgba(244,114,182,.16) calc(50% - .5px), rgba(244,114,182,.16) calc(50% + .5px), transparent calc(50% + .5px)), linear-gradient(to bottom, transparent calc(50% - .5px), rgba(244,114,182,.16) calc(50% - .5px), rgba(244,114,182,.16) calc(50% + .5px), transparent calc(50% + .5px)); }
      .controls { padding:18px; display:grid; gap:14px; }
      .control-group { border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:12px; background:rgba(255,255,255,.88); display:grid; gap:10px; }
      .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .slot-btn,.mini-btn,.arrow-btn,select { border:1px solid rgba(51,65,85,.18); border-radius:12px; background:white; color:var(--text); padding:9px 12px; font-weight:700; cursor:pointer; }
      .slot-btn.is-active { background:#0f172a; color:white; border-color:#0f172a; }
      .slot-selects { display:grid; gap:8px; }
      .slot-selects label { display:grid; gap:6px; font-size:13px; color:#64748b; }
      .arrow-grid { display:grid; grid-template-columns:repeat(3,48px); grid-template-rows:repeat(2,44px); gap:8px; justify-content:center; }
      .arrow-btn { padding:0; }
      .arrow-up { grid-column:2; grid-row:1; }
      .arrow-left { grid-column:1; grid-row:2; }
      .arrow-down { grid-column:2; grid-row:2; }
      .arrow-right { grid-column:3; grid-row:2; }
      input[type="range"] { width:100%; }
      textarea { width:100%; min-height:220px; resize:vertical; border-radius:16px; border:1px solid rgba(148,163,184,.24); padding:12px; font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#334155; }
      .hint { margin:0; font-size:13px; color:var(--muted); line-height:1.7; }
      @media (max-width:980px) { .layout { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <main>
      <p style="margin:0;font-size:12px;letter-spacing:.22em;font-weight:700;color:#db2777;">DRESSUP PILOT PLACEMENT</p>
      <h1>おしゃれゲーム 25点パイロット位置合わせビューアー</h1>
      <p class="lead">各部位5点ずつのレイヤーを、同じ default 配置値で切り替え確認するビューアーです。部位ごとにアイテムを選び、画像クリックで選択、ドラッグ、微調整、scale、重なり順の調整ができます。</p>
      <section class="layout">
        <article class="panel stage-panel">
          <div class="stage" id="stage">
            <div class="crosshair"></div>
            <img class="layer" src="${relFromRoot(modelPath)}" alt="人物モデルB" />
            <img class="layer" data-slot="hair" alt="かみかざり" />
            <img class="layer" data-slot="necklace" alt="ネックレス" />
            <img class="layer" data-slot="top" alt="トップス" />
            <img class="layer" data-slot="bottom" alt="ボトムス" />
            <img class="layer" data-slot="leftShoe" alt="左くつ" />
            <img class="layer" data-slot="rightShoe" alt="右くつ" />
          </div>
        </article>
        <aside class="panel controls">
          <div class="control-group">
            <div class="slot-selects" id="slotSelects"></div>
          </div>
          <div class="control-group">
            <div class="row" id="slotButtons"></div>
            <label class="row"><input id="visibleToggle" type="checkbox" checked /> 表示する</label>
          </div>
          <div class="control-group">
            <strong>ドラッグ / 微調整</strong>
            <p class="hint">ステージ上でドラッグするか、下の矢印で1pxずつ動かせます。Shift + 矢印キーでも動かせます。</p>
            <div class="arrow-grid">
              <button class="arrow-btn arrow-up" data-dx="0" data-dy="-1" type="button">↑</button>
              <button class="arrow-btn arrow-left" data-dx="-1" data-dy="0" type="button">←</button>
              <button class="arrow-btn arrow-down" data-dx="0" data-dy="1" type="button">↓</button>
              <button class="arrow-btn arrow-right" data-dx="1" data-dy="0" type="button">→</button>
            </div>
          </div>
          <div class="control-group">
            <strong>サイズ</strong>
            <input id="scaleRange" type="range" min="0.4" max="1.8" step="0.01" value="1" />
            <div class="row">
              <button class="mini-btn" id="scaleDown" type="button">- 0.01</button>
              <button class="mini-btn" id="scaleUp" type="button">+ 0.01</button>
              <span id="scaleText">1.00</span>
            </div>
          </div>
          <div class="control-group">
            <strong>重なり順</strong>
            <div class="row">
              <button class="mini-btn" id="bringForward" type="button">前へ</button>
              <button class="mini-btn" id="sendBackward" type="button">後ろへ</button>
              <span id="zText">z: 0</span>
            </div>
          </div>
          <div class="control-group">
            <strong>JSON</strong>
            <div class="row">
              <button class="mini-btn" id="refreshJson" type="button">JSON を更新</button>
              <button class="mini-btn" id="copyJson" type="button">コピー</button>
            </div>
            <textarea id="jsonOutput"></textarea>
          </div>
        </aside>
      </section>
    </main>
    <script>
      const state = ${JSON.stringify(placement, null, 2)};
      const labels = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, value.label]));
      const slotCatalog = ${JSON.stringify(viewerCatalog, null, 2)};
      const selectedItems = {
        hair: slotCatalog.hair[0].id,
        necklace: slotCatalog.necklace[0].id,
        top: slotCatalog.top[0].id,
        bottom: slotCatalog.bottom[0].id,
        shoes: slotCatalog.shoes[0].id,
      };
      const stage = document.getElementById('stage');
      const layerEls = Object.fromEntries([...stage.querySelectorAll('[data-slot]')].map((el) => [el.dataset.slot, el]));
      const slotButtons = document.getElementById('slotButtons');
      const slotSelects = document.getElementById('slotSelects');
      const visibleToggle = document.getElementById('visibleToggle');
      const scaleRange = document.getElementById('scaleRange');
      const scaleText = document.getElementById('scaleText');
      const zText = document.getElementById('zText');
      const jsonOutput = document.getElementById('jsonOutput');
      const refreshJsonBtn = document.getElementById('refreshJson');
      const copyJsonBtn = document.getElementById('copyJson');
      const bringForwardBtn = document.getElementById('bringForward');
      const sendBackwardBtn = document.getElementById('sendBackward');
      let activeSlot = 'hair';
      let dragState = null;
      const layerBitmaps = {};
      const DRAG_THRESHOLD = 5;

      function setSlotSources() {
        const hairItem = slotCatalog.hair.find((item) => item.id === selectedItems.hair);
        const necklaceItem = slotCatalog.necklace.find((item) => item.id === selectedItems.necklace);
        const topItem = slotCatalog.top.find((item) => item.id === selectedItems.top);
        const bottomItem = slotCatalog.bottom.find((item) => item.id === selectedItems.bottom);
        const shoeItem = slotCatalog.shoes.find((item) => item.id === selectedItems.shoes);
        layerEls.hair.src = hairItem.src;
        layerEls.necklace.src = necklaceItem.src;
        layerEls.top.src = topItem.src;
        layerEls.bottom.src = bottomItem.src;
        layerEls.leftShoe.src = shoeItem.leftSrc;
        layerEls.rightShoe.src = shoeItem.rightSrc;
      }

      function renderSlotSelects() {
        const sections = [
          ['hair', 'かみかざり'],
          ['necklace', 'ネックレス'],
          ['top', 'トップス'],
          ['bottom', 'ボトムス'],
          ['shoes', 'くつ'],
        ];
        slotSelects.innerHTML = sections.map(([slot, label]) => {
          const options = slotCatalog[slot].map((item) => '<option value="' + item.id + '"' + (selectedItems[slot] === item.id ? ' selected' : '') + '>' + item.label + '</option>').join('');
          return '<label>' + label + '<select data-slot-select="' + slot + '">' + options + '</select></label>';
        }).join('');
        slotSelects.querySelectorAll('[data-slot-select]').forEach((select) => {
          select.addEventListener('change', async () => {
            selectedItems[select.dataset.slotSelect] = select.value;
            setSlotSources();
            await primeBitmaps();
            render();
          });
        });
      }

      function renderSlotButtons() {
        slotButtons.innerHTML = Object.entries(labels).map(([key, label]) =>
          '<button class="slot-btn' + (key === activeSlot ? ' is-active' : '') + '" data-slot-btn="' + key + '" type="button">' + label + '</button>'
        ).join('');
        slotButtons.querySelectorAll('[data-slot-btn]').forEach((button) => {
          button.addEventListener('click', () => {
            activeSlot = button.dataset.slotBtn;
            syncControls();
            render();
          });
        });
      }

      function applyTransform(slot) {
        const cfg = state[slot];
        const el = layerEls[slot];
        el.style.display = cfg.visible ? 'block' : 'none';
        el.style.zIndex = String(cfg.z);
        el.style.transform = 'translate(' + cfg.x + 'px,' + cfg.y + 'px) scale(' + cfg.scale + ')';
        el.classList.toggle('selected', slot === activeSlot);
      }

      function render() {
        Object.keys(layerEls).forEach(applyTransform);
        renderSlotButtons();
        jsonOutput.value = JSON.stringify({ placement: state, selectedItems }, null, 2);
      }

      function syncControls() {
        const cfg = state[activeSlot];
        visibleToggle.checked = cfg.visible;
        scaleRange.value = cfg.scale;
        scaleText.textContent = cfg.scale.toFixed(2);
        zText.textContent = 'z: ' + cfg.z;
      }

      function moveActive(dx, dy) {
        state[activeSlot].x += dx;
        state[activeSlot].y += dy;
        render();
      }

      function updateScale(delta) {
        const cfg = state[activeSlot];
        cfg.scale = Number(Math.max(0.4, Math.min(1.8, cfg.scale + delta)).toFixed(2));
        syncControls();
        render();
      }

      function sortSlotsByZ() {
        return Object.keys(layerEls).sort((a, b) => state[b].z - state[a].z);
      }

      function swapZ(direction) {
        const ordered = Object.keys(layerEls).sort((a, b) => state[a].z - state[b].z);
        const index = ordered.indexOf(activeSlot);
        const targetIndex = direction === 'forward' ? index + 1 : index - 1;
        if (targetIndex < 0 || targetIndex >= ordered.length) return;
        const otherSlot = ordered[targetIndex];
        const currentZ = state[activeSlot].z;
        state[activeSlot].z = state[otherSlot].z;
        state[otherSlot].z = currentZ;
        syncControls();
        render();
      }

      function canvasCoordinates(event) {
        const rect = stage.getBoundingClientRect();
        return {
          x: Math.round(((event.clientX - rect.left) / rect.width) * 1024),
          y: Math.round(((event.clientY - rect.top) / rect.height) * 1024),
        };
      }

      function isHit(slot, x, y) {
        const bitmap = layerBitmaps[slot];
        const cfg = state[slot];
        if (!bitmap || !cfg.visible) return false;
        const scale = cfg.scale;
        const localX = Math.floor((x - cfg.x) / scale);
        const localY = Math.floor((y - cfg.y) / scale);
        if (localX < 0 || localY < 0 || localX >= bitmap.width || localY >= bitmap.height) return false;
        const alpha = bitmap.data[(bitmap.width * localY + localX) * 4 + 3];
        return alpha >= 16;
      }

      async function primeBitmaps() {
        await Promise.all(Object.entries(layerEls).map(async ([slot, img]) => {
          await img.decode().catch(() => {});
          const canvas = document.createElement('canvas');
          canvas.width = 1024;
          canvas.height = 1024;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, 1024, 1024);
          context.drawImage(img, 0, 0, 1024, 1024);
          layerBitmaps[slot] = context.getImageData(0, 0, 1024, 1024);
        }));
      }

      function pickTopSlot(x, y) {
        for (const slot of sortSlotsByZ()) {
          if (isHit(slot, x, y)) return slot;
        }
        return null;
      }

      visibleToggle.addEventListener('change', () => {
        state[activeSlot].visible = visibleToggle.checked;
        render();
      });
      scaleRange.addEventListener('input', () => {
        state[activeSlot].scale = Number(scaleRange.value);
        syncControls();
        render();
      });
      document.getElementById('scaleDown').addEventListener('click', () => updateScale(-0.01));
      document.getElementById('scaleUp').addEventListener('click', () => updateScale(0.01));
      bringForwardBtn.addEventListener('click', () => swapZ('forward'));
      sendBackwardBtn.addEventListener('click', () => swapZ('backward'));
      stage.addEventListener('pointerdown', (event) => {
        const point = canvasCoordinates(event);
        const slot = pickTopSlot(point.x, point.y);
        if (!slot) return;
        activeSlot = slot;
        syncControls();
        render();
        dragState = { slot, startX: event.clientX, startY: event.clientY, originX: state[slot].x, originY: state[slot].y, dragging: false };
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointermove', (event) => {
        if (!dragState) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (!dragState.dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) dragState.dragging = true;
        if (!dragState.dragging) return;
        state[dragState.slot].x = dragState.originX + Math.round(dx * (1024 / stage.getBoundingClientRect().width));
        state[dragState.slot].y = dragState.originY + Math.round(dy * (1024 / stage.getBoundingClientRect().height));
        render();
      });
      const finishDrag = (event) => {
        if (!dragState) return;
        if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
        dragState = null;
      };
      stage.addEventListener('pointerup', finishDrag);
      stage.addEventListener('pointercancel', finishDrag);
      document.querySelectorAll('[data-dx]').forEach((button) => {
        button.addEventListener('click', () => moveActive(Number(button.dataset.dx), Number(button.dataset.dy)));
      });
      window.addEventListener('keydown', (event) => {
        if (!event.shiftKey) return;
        if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(0, -1); }
        if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(0, 1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveActive(-1, 0); }
        if (event.key === 'ArrowRight') { event.preventDefault(); moveActive(1, 0); }
      });
      refreshJsonBtn.addEventListener('click', () => { jsonOutput.value = JSON.stringify({ placement: state, selectedItems }, null, 2); });
      copyJsonBtn.addEventListener('click', async () => {
        jsonOutput.value = JSON.stringify({ placement: state, selectedItems }, null, 2);
        try {
          await navigator.clipboard.writeText(jsonOutput.value);
          copyJsonBtn.textContent = 'コピーした';
          setTimeout(() => { copyJsonBtn.textContent = 'コピー'; }, 1200);
        } catch (_error) {
          copyJsonBtn.textContent = '手でコピー';
          setTimeout(() => { copyJsonBtn.textContent = 'コピー'; }, 1200);
        }
      });

      renderSlotSelects();
      setSlotSources();
      primeBitmaps().then(() => { syncControls(); render(); });
    </script>
  </body>
</html>`,
);

console.log(`normalized manifest: ${NORMALIZED_MANIFEST_PATH}`);
console.log(`split manifest: ${SPLIT_MANIFEST_PATH}`);
console.log(`preview: ${PREVIEW_PATH}`);
console.log(`viewer: ${VIEWER_PATH}`);
