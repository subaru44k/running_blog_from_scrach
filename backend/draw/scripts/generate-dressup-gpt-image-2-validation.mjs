import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { PNG } from 'pngjs';

const resolveDrawDir = () => {
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, 'package.json')) && existsSync(resolve(cwd, 'scripts'))) return cwd;
  const nested = resolve(cwd, 'backend/draw');
  if (existsSync(resolve(nested, 'package.json')) && existsSync(resolve(nested, 'scripts'))) return nested;
  return cwd;
};

const DRAW_DIR = resolveDrawDir();
const OUTPUT_DIR = resolve(DRAW_DIR, 'artifacts/dressup-gpt-image-2-validation');
const MODEL_CANDIDATE_DIR = resolve(OUTPUT_DIR, 'model-candidates');
const MODEL_RAW_DIR = resolve(MODEL_CANDIDATE_DIR, 'raw');
const MODEL_CUTOUT_DIR = resolve(MODEL_CANDIDATE_DIR, 'cutout');
const STYLE_CANDIDATE_DIR = resolve(OUTPUT_DIR, 'style-candidates');
const STYLE_RAW_DIR = resolve(STYLE_CANDIDATE_DIR, 'raw');
const STYLE_CUTOUT_DIR = resolve(STYLE_CANDIDATE_DIR, 'cutout');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');
const MODEL_PREVIEW_PATH = resolve(OUTPUT_DIR, 'model-preview.html');
const MODEL_SCORECARD_PATH = resolve(OUTPUT_DIR, 'scorecard.md');
const STYLE_PREVIEW_PATH = resolve(OUTPUT_DIR, 'style-preview.html');
const STYLE_SCORECARD_PATH = resolve(OUTPUT_DIR, 'style-scorecard.md');
const SELECTED_STYLE_PATH = resolve(OUTPUT_DIR, 'selected-style-model.json');
const BASE_MODEL_PATH = resolve(DRAW_DIR, 'artifacts/dressup-model-variants/model-princess-base-b.png');

const MODEL = 'gpt-image-2';
const QUALITY = 'medium';
const SIZE = '1024x1536';
const OUTPUT_FORMAT = 'png';
const RENDER_ONLY = process.env.RENDER_ONLY === '1';
const STYLE_BATCH = process.env.STYLE_BATCH || '';
const REQUESTED_CANDIDATE_IDS = new Set((process.env.CANDIDATE_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
const REQUESTED_STYLE_CANDIDATE_IDS = new Set((process.env.STYLE_CANDIDATE_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));

const loadLocalEnv = (path) => {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
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

loadLocalEnv(resolve(DRAW_DIR, '.env.local'));

if (!RENDER_ONLY && !process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

for (const dir of [MODEL_RAW_DIR, MODEL_CUTOUT_DIR, STYLE_RAW_DIR, STYLE_CUTOUT_DIR]) {
  mkdirSync(dir, { recursive: true });
}

const negativePrompt =
  'side view, three-quarter view, cropped head, cropped feet, cropped ankles, cropped toes, cropped hands, cropped arms, ' +
  'arms glued to body, hair covering torso, hair covering shoulders, hair covering waist, occluded neck, occluded shoulders, ' +
  'occluded waist, busy background, furniture, room, props, text, logo, watermark, photorealistic, realistic skin texture, ' +
  'adult proportions, sexy pose, dramatic pose, perspective distortion, extra limbs, extra fingers, multiple characters, ' +
  'dark background, gradients, strong shadows, long hem hiding the feet';

const modelCandidates = [
  {
    id: 'model-princess-base-b-validation-a',
    filename: 'model-princess-base-b-validation-a.png',
    label: 'A: storybook paper doll',
    prompt:
      'cute storybook encyclopedia paper doll mannequin for a princess dress-up game, non-realistic 2D illustration, front view, full body, standing straight and centered, ' +
      'modest rounded proportions, soft friendly face, light brown short bob hair kept above the shoulders and away from the torso, arms slightly away from the body for clean outfit overlays, ' +
      'visible neck, shoulders, waist, ankles, and toes, simple pale cream-pink sleeveless inner dress with a modest round neckline below the neck so necklaces can be tested, ' +
      'clear silhouette for dress-up validation, plain pure white background, no props, no text, no watermark',
  },
  {
    id: 'model-princess-base-b-validation-b',
    filename: 'model-princess-base-b-validation-b.png',
    label: 'B: slightly softer pose',
    prompt:
      'dress-up game base model inspired by model-princess-base-b, exact front view, full body, standing straight, arms gently away from the body, ' +
      'neck, shoulders, waist, ankles, and toes clearly visible, hair not covering the torso, simple pale inner dress, tidy princess doll proportions, ' +
      'elegant but practical dress-up base silhouette, plain pure white background, no props, no text, no watermark',
  },
  {
    id: 'model-princess-base-b-validation-c',
    filename: 'model-princess-base-b-validation-c.png',
    label: 'C: flatter illustration feel',
    prompt:
      'dress-up game base model inspired by model-princess-base-b, front view, full body, centered and symmetrical, arms slightly away from the body, visible neck, shoulders, waist, ankles, and toes, ' +
      'hair arranged so it does not cover the torso, simple pale inner dress, clean 2D illustration with a clear dress-up silhouette, readable and stable for clothing overlays, ' +
      'plain pure white background, no props, no text, no watermark',
  },
];

const styleCandidates = [
  {
    id: 'style-a-encyclopedia',
    filename: 'style-a-encyclopedia.png',
    label: 'Style A: encyclopedia page',
    prompt:
      'pastel storybook encyclopedia illustration for a princess dress-up game, original non-realistic 2D paper doll mannequin, front view, full body, centered, ' +
      'compact Japanese children picture-book diagram feel, delicate simple line art, soft watercolor-like shading, gentle warm colors, small refined princess-fashion details, ' +
      'modest rounded proportions, friendly face, short tidy hair kept away from the torso, arms slightly away from the body, visible neck, shoulders, waist, ankles, and toes, ' +
      'simple pale pink sleeveless inner dress with a modest round neckline for necklace testing, plain pure white background, no props, no text, no watermark',
  },
  {
    id: 'style-b-princess-paper-doll',
    filename: 'style-b-princess-paper-doll.png',
    label: 'Style B: princess paper doll',
    prompt:
      'original princess paper doll for a children dress-up game, pastel picture-book encyclopedia style, flat 2D illustration, clean delicate outlines, soft airy coloring, ' +
      'slightly decorative but simple enough for clothing overlays, front view, full body, standing straight, arms gently separated from the torso, short bob hair clear of shoulders and waist, ' +
      'visible neck, shoulders, waist, ankles, and toes, simple cream-pink inner dress with round neckline, child-friendly modest proportions, plain pure white background, no props, no text, no watermark',
  },
  {
    id: 'style-c-dress-catalog',
    filename: 'style-c-dress-catalog.png',
    label: 'Style C: dress catalog',
    prompt:
      'children princess fashion encyclopedia base model, original flat 2D storybook diagram illustration, pastel colors, fine but readable linework, soft watercolor texture, ' +
      'dress catalog clarity with tiny elegant details kept subtle, front view, full body, symmetrical standing pose, arms slightly away for dress-up overlays, ' +
      'short neat hair not covering torso, visible neck, shoulders, waist, ankles, and toes, simple pale inner dress with necklace space at the neckline, plain pure white background, no props, no text, no watermark',
  },
  {
    id: 'style-d-encyclopedia-clean-base',
    filename: 'style-d-encyclopedia-clean-base.png',
    label: 'Style D: clean encyclopedia base',
    prompt:
      'pastel storybook encyclopedia illustration for a princess dress-up game, original non-realistic 2D paper doll mannequin, front view, full body, centered, ' +
      'compact Japanese children picture-book diagram feel, delicate simple line art, soft watercolor-like shading, gentle warm colors, refined but minimal princess feeling, ' +
      'no tiara, no earrings, no necklace, no hair accessories, no jewelry, no decorative props, short tidy bob hair kept away from the torso and neckline, ' +
      'arms slightly away from the body, visible neck, shoulders, waist, ankles, and toes, simple pale pink sleeveless inner dress with a modest round neckline for necklace testing, ' +
      'plain pure white background, no text, no watermark',
  },
];

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const toRelative = (path) => {
  if (!path) return null;
  const normalized = (isAbsolute(path) ? relative(OUTPUT_DIR, path) : path).replaceAll('\\', '/');
  for (const marker of ['model-candidates/', 'style-candidates/', 'selected/']) {
    const index = normalized.indexOf(marker);
    if (index >= 0) return normalized.slice(index);
  }
  return normalized;
};

const readManifest = () => (existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : null);

const pixelOffset = (png, x, y) => (png.width * y + x) * 4;

const isNearWhite = (png, x, y, threshold) => {
  const offset = pixelOffset(png, x, y);
  return png.data[offset + 3] > 0 && png.data[offset] >= threshold && png.data[offset + 1] >= threshold && png.data[offset + 2] >= threshold;
};

const removeWhiteBackground = (path) => {
  const png = PNG.sync.read(readFileSync(path));
  const visited = new Uint8Array(png.width * png.height);
  const queue = [];
  const threshold = 246;

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
    queue.push([x, y]);
  };

  for (let x = 0; x < png.width; x += 1) {
    push(x, 0);
    push(x, png.height - 1);
  }
  for (let y = 0; y < png.height; y += 1) {
    push(0, y);
    push(png.width - 1, y);
  }

  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    const index = png.width * y + x;
    if (visited[index]) continue;
    visited[index] = 1;
    if (!isNearWhite(png, x, y, threshold)) continue;
    png.data[pixelOffset(png, x, y) + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = pixelOffset(png, x, y);
      if (png.data[offset + 3] === 0) continue;
      const whiteness = Math.min(png.data[offset], png.data[offset + 1], png.data[offset + 2]);
      if (whiteness >= 236) {
        png.data[offset + 3] = Math.max(0, Math.min(png.data[offset + 3], Math.round((255 - whiteness) * 8)));
      }
    }
  }

  writeFileSync(path, PNG.sync.write(png));
};

const generateImage = async (candidate, rawDir, cutoutDir) => {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${candidate.prompt}\n\nnegative prompt: ${negativePrompt}`,
      size: SIZE,
      quality: QUALITY,
      output_format: OUTPUT_FORMAT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const data = payload?.data?.[0];
  if (!data?.b64_json) throw new Error('Missing image payload');

  const rawPath = resolve(rawDir, candidate.filename);
  const cutoutPath = resolve(cutoutDir, candidate.filename);
  writeFileSync(rawPath, Buffer.from(data.b64_json, 'base64'));
  copyFileSync(rawPath, cutoutPath);
  removeWhiteBackground(cutoutPath);

  return {
    ...candidate,
    rawPath: toRelative(rawPath),
    cutoutPath: toRelative(cutoutPath),
    revisedPrompt: data.revised_prompt || null,
    createdAt: new Date().toISOString(),
    status: 'ok',
    error: null,
  };
};

const runBatch = async ({ allCandidates, requestedIds, previousItems, rawDir, cutoutDir, label }) => {
  const selected = requestedIds.size ? allCandidates.filter((candidate) => requestedIds.has(candidate.id)) : allCandidates;
  if (requestedIds.size && selected.length === 0) {
    throw new Error(`No ${label} matched requested ids: ${Array.from(requestedIds).join(',')}`);
  }

  const previousById = new Map((previousItems || []).map((item) => [item.id, item]));
  const results = [];

  if (RENDER_ONLY) {
    results.push(...(previousItems || []));
  } else {
    for (const candidate of selected) {
      try {
        console.log(`generating ${candidate.id}...`);
        results.push(await generateImage(candidate, rawDir, cutoutDir));
        console.log(`saved ${candidate.filename}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          ...candidate,
          rawPath: null,
          cutoutPath: null,
          revisedPrompt: null,
          createdAt: new Date().toISOString(),
          status: 'error',
          error: message,
        });
        console.error(`failed ${candidate.id}:`, message);
      }
    }

    for (const candidate of allCandidates) {
      if (selected.some((item) => item.id === candidate.id)) continue;
      const previous = previousById.get(candidate.id);
      if (previous) results.push(previous);
    }
  }

  return results.sort((left, right) => allCandidates.findIndex((item) => item.id === left.id) - allCandidates.findIndex((item) => item.id === right.id));
};

const renderCards = (items) =>
  items
    .map((item) => {
      const prompt = item.revisedPrompt || item.prompt;
      const body =
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Raw</figcaption><img src="${toRelative(item.rawPath)}" alt="${escapeHtml(`${item.filename} raw`)}" /></figure><figure><figcaption>Cutout</figcaption><img src="${toRelative(item.cutoutPath)}" alt="${escapeHtml(`${item.filename} cutout`)}" /></figure></div>`
          : `<p class="error">Generation failed: ${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header class="card-head"><div><p class="eyebrow">${escapeHtml(item.label)}</p><h2>${escapeHtml(item.filename)}</h2></div><span class="status">${escapeHtml(item.status)}</span></header>${body}<p class="prompt">${escapeHtml(prompt)}</p></article>`;
    })
    .join('\n');

const renderPreview = ({ title, eyebrow, description, items }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#dbe4ee; --text:#132238; --muted:#5c7288; --accent:#2563eb; --error:#b42318; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:linear-gradient(180deg,#fff 0%,#f5f9ff 100%); }
      main { width:min(1200px,calc(100% - 32px)); margin:0 auto; padding:28px 0 40px; }
      .hero { display:grid; gap:10px; margin-bottom:20px; }
      .eyebrow { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.18em; }
      h1 { margin:0; font-size:32px; line-height:1.15; }
      .meta,.prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:18px; background:var(--panel); box-shadow:0 10px 30px rgba(18,38,63,.06); padding:16px; }
      .card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:18px; line-height:1.3; }
      .status { border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; background:#eef4ff; color:var(--accent); flex:none; }
      .card.error .status { background:#fff1f1; color:var(--error); }
      .comparison { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      figure { margin:0; border:1px solid #e7edf5; border-radius:14px; overflow:hidden; background:linear-gradient(45deg,#f4f7fb 25%,transparent 25%) 0 0/20px 20px,linear-gradient(-45deg,#f4f7fb 25%,transparent 25%) 0 0/20px 20px,linear-gradient(45deg,transparent 75%,#f4f7fb 75%) 0 0/20px 20px,linear-gradient(-45deg,transparent 75%,#f4f7fb 75%) 0 0/20px 20px,#fff; }
      figcaption { padding:10px 12px 0; font-size:12px; font-weight:800; color:var(--muted); }
      img { width:100%; height:420px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:14px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:860px) { .comparison { grid-template-columns:1fr; } img { height:320px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(description)}</p></section>
      <div class="grid">${renderCards(items)}</div>
    </main>
  </body>
</html>`;

const renderScorecard = (items, directory) => {
  const rows = items.map((item) => `| ${item.label} | [raw](${directory}/raw/${item.filename}) | [cutout](${directory}/cutout/${item.filename}) | ${item.status} |`).join('\n');
  const notes = items
    .map((item) => `### ${item.label}\n\n- File: \`${item.filename}\`\n- Prompt: ${item.revisedPrompt || item.prompt}\n- Notes:\n  - Target style: \n  - Front view: \n  - Full body: \n  - Neck/shoulders visible: \n  - Hair clear of torso: \n  - Background removal: \n  - Dress-up suitability: \n`)
    .join('\n');
  return `# Dressup GPT-Image-2 Validation Scorecard\n\n- Model: \`${MODEL}\`\n- Size: \`${SIZE}\`\n- Quality: \`${QUALITY}\`\n\n| Candidate | Raw | Cutout | Status |\n| --- | --- | --- | --- |\n${rows}\n\n${notes}`;
};

const writeManifest = (manifest) => {
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        ...manifest,
        model: MODEL,
        quality: QUALITY,
        size: SIZE,
        outputFormat: OUTPUT_FORMAT,
        generatedAt: new Date().toISOString(),
        outputDir: OUTPUT_DIR,
      },
      null,
      2,
    ),
  );
};

const main = async () => {
  const previousManifest = readManifest() || {};

  if (STYLE_BATCH === 'storybook-encyclopedia') {
    const styleResults = await runBatch({
      allCandidates: styleCandidates,
      requestedIds: REQUESTED_STYLE_CANDIDATE_IDS,
      previousItems: previousManifest.styleCandidates || [],
      rawDir: STYLE_RAW_DIR,
      cutoutDir: STYLE_CUTOUT_DIR,
      label: 'style candidates',
    });
    writeManifest({ ...previousManifest, styleRawDir: STYLE_RAW_DIR, styleCutoutDir: STYLE_CUTOUT_DIR, styleCandidates: styleResults });
    writeFileSync(
      STYLE_PREVIEW_PATH,
      renderPreview({
        title: 'Dressup Storybook Encyclopedia Style Candidates',
        eyebrow: 'DRESSUP STYLE VALIDATION',
        description: `Generated with ${MODEL}. Raw images live in style-candidates/raw; cutouts live in style-candidates/cutout.`,
        items: styleResults,
      }),
    );
    writeFileSync(STYLE_SCORECARD_PATH, renderScorecard(styleResults, 'style-candidates'));
    console.log(`manifest: ${MANIFEST_PATH}`);
    console.log(`style preview: ${STYLE_PREVIEW_PATH}`);
    console.log(`style scorecard: ${STYLE_SCORECARD_PATH}`);
    return;
  }

  const modelResults = await runBatch({
    allCandidates: modelCandidates,
    requestedIds: REQUESTED_CANDIDATE_IDS,
    previousItems: previousManifest.candidates || [],
    rawDir: MODEL_RAW_DIR,
    cutoutDir: MODEL_CUTOUT_DIR,
    label: 'model candidates',
  });
  writeManifest({ ...previousManifest, rawDir: MODEL_RAW_DIR, cutoutDir: MODEL_CUTOUT_DIR, candidates: modelResults });
  writeFileSync(
    MODEL_PREVIEW_PATH,
    renderPreview({
      title: 'Dressup GPT-Image-2 Model Candidates',
      eyebrow: 'DRESSUP GPT-IMAGE-2 VALIDATION',
      description: `Generated with ${MODEL}. Raw images live in model-candidates/raw; cutouts live in model-candidates/cutout.`,
      items: modelResults,
    }),
  );
  writeFileSync(MODEL_SCORECARD_PATH, renderScorecard(modelResults, 'model-candidates'));
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`model preview: ${MODEL_PREVIEW_PATH}`);
  console.log(`scorecard: ${MODEL_SCORECARD_PATH}`);
};

await main();
