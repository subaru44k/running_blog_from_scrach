import { mkdirSync, readFileSync, existsSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = 'gpt-image-2';
const DEFAULT_QUALITY = 'medium';
const DEFAULT_OUTPUT_FORMAT = 'png';
const OUTPUT_DIR = resolve(process.cwd(), 'backend/draw/artifacts/balloon-catch-gpt-image-2');
const PUBLIC_DIR = resolve(process.cwd(), 'astro-blog/public/images/games/balloon-catch-gpt-image-2');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');
const PREVIEW_PATH = resolve(OUTPUT_DIR, 'preview.html');
const REQUESTED_ASSET_IDS = new Set(
  (process.env.ASSET_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(PUBLIC_DIR, { recursive: true });

const assets = [
  {
    id: 'dog-sprite-sheet',
    filename: 'dog-sprite-sheet-original-prompt.png',
    kind: 'character-sprite-sheet',
    size: '1536x1024',
    quality: DEFAULT_QUALITY,
    background: 'transparent',
    alphaKey: true,
    prompt: `Use case: illustration-story
Asset type: 2D side-scrolling game sprite sheet, transparent PNG
Primary request: Generate a cute small dog character sprite sheet in a single horizontal row.

Style:
ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, no harsh shadows, high readability.

Character:
cute small dog character, round body, short legs, big sparkling eyes, fluffy ears, light cream or pastel brown fur, gentle smile.

Sprite sheet layout:
All animation frames arranged horizontally in a single row.
Animations included in order from left to right:
1. idle: 2 frames, subtle breathing and slight tail movement
2. running: 4 frames, smooth loop with legs moving
3. catching: 3 frames, small jump and happy expression
Total: 9 frames in one row.

IMPORTANT CONSISTENCY RULES:
- fixed camera, no perspective change
- same character size and proportions across all frames
- same position in each frame, no shifting
- same ground level alignment, feet aligned perfectly
- equal spacing between frames
- character centered in each frame
- clean outline, minimal detail, high readability for children
- plain pure white background, no floor, no horizon, no background elements
- no text, no watermark, no extra objects`,
  },
  {
    id: 'cpu-man-throwing-balloon',
    filename: 'cpu-man-throwing-balloon.png',
    kind: 'character',
    size: '1024x1024',
    quality: DEFAULT_QUALITY,
    background: 'transparent',
    alphaKey: true,
    prompt: `Use case: illustration-story
Asset type: 2D mobile game character sprite, transparent PNG
Primary request: CPU character, a lightly bad-boy style man wearing sunglasses and throwing a balloon.
Subject: A child-safe cartoon man with dark sunglasses, a playful smug grin, a slightly naughty vibe, rounded face, soft hair, simple pastel street-fashion outfit, and one arm extended in a gentle balloon-throwing motion. He should read as a mischievous troublemaker, not a scary villain.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered full-body or near full-body sprite, throwing pose readable at small size, enough transparent padding around arm and balloon, no crop.
Lighting/mood: playful, cheeky, dreamy park-game mood.
Constraints: plain pure white background, no text, no watermark, no logo, no hard shadows, no realism, no intimidating villain look, no violence, no weapon, no horror, consistent style with the dog and balloon assets.`,
  },
  {
    id: 'balloon-normal',
    filename: 'balloon-normal.png',
    kind: 'item',
    size: '1024x1024',
    quality: DEFAULT_QUALITY,
    background: 'transparent',
    alphaKey: true,
    prompt: `Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Normal balloon item.
Subject: A simple round pastel balloon with a tiny tied knot and short soft string, cheerful and easy to recognize, clean silhouette.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, large readable shape, transparent padding, no crop.
Lighting/mood: gentle dreamy lighting, cute and calm.
Constraints: plain pure white background, no text, no watermark, no logo, no letters or symbols on the balloon, consistent style with all assets.`,
  },
  {
    id: 'balloon-rare-sparkling',
    filename: 'balloon-rare-sparkling.png',
    kind: 'item',
    size: '1024x1024',
    quality: DEFAULT_QUALITY,
    background: 'transparent',
    alphaKey: true,
    prompt: `Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Sparkling rare balloon item.
Subject: A special pastel balloon with small soft sparkles and a subtle magical glow, clearly rarer than a normal balloon but still simple and readable, tiny tied knot and short soft string.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, large readable balloon shape, sparkles close to the balloon, transparent padding, no crop.
Lighting/mood: dreamy, magical, cheerful.
Constraints: plain pure white background, no text, no watermark, no logo, no letters or symbols, no busy sparkle field, consistent style with all assets.`,
  },
  {
    id: 'balloon-dangerous',
    filename: 'balloon-dangerous.png',
    kind: 'item',
    size: '1024x1024',
    quality: DEFAULT_QUALITY,
    background: 'transparent',
    alphaKey: true,
    prompt: `Use case: illustration-story
Asset type: 2D mobile game item sprite, transparent PNG
Primary request: Slightly dangerous balloon item.
Subject: A pastel balloon that reads as a gentle hazard in a children's game, slightly darker warm pastel color, tiny soft thorn-like nubs or taped patches, cute but clearly different from the normal balloon, rounded and not scary, tiny tied knot and short soft string.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Centered item sprite, readable hazard silhouette, transparent padding, no crop.
Lighting/mood: playful caution, child-friendly, not frightening.
Constraints: plain pure white background, no text, no watermark, no logo, no skulls, no warning signs, no letters or symbols, no sharp realistic spikes, consistent style with all assets.`,
  },
  {
    id: 'park-background',
    filename: 'park-background.png',
    kind: 'background',
    size: '1536x1024',
    quality: DEFAULT_QUALITY,
    background: 'opaque',
    prompt: `Use case: illustration-story
Asset type: 2D mobile game background image
Primary request: Simple park scene background for a balloon catching game.
Scene/backdrop: A simple dreamy pastel park with soft green grass, rounded trees, a small path, gentle blue sky, tiny fluffy clouds, and open playable space in the center and foreground.
Subject: Background only, no characters, no balloons, no text.
Style/medium: ゆめかわ絵本風, pastel color palette, soft lighting, dreamy atmosphere, fluffy and cute style, children's picture book illustration, simple shapes, rounded design, soft outlines, clean outlines, no harsh shadows, high readability.
Composition/framing: Wide horizontal game background, uncluttered center area for gameplay, soft horizon, readable on mobile, no crop-sensitive details near edges.
Lighting/mood: calm sunny park, dreamy and cheerful.
Constraints: no text, no watermark, no logo, no characters, no balloons, no signs with writing, consistent style with the sprite assets.`,
  },
];

const currentPublicBase = '/images/games/balloon-catch';
const generatedPublicBase = '/images/games/balloon-catch-gpt-image-2';
const selectedAssets = REQUESTED_ASSET_IDS.size
  ? assets.filter((asset) => REQUESTED_ASSET_IDS.has(asset.id))
  : assets;

if (REQUESTED_ASSET_IDS.size && selectedAssets.length === 0) {
  console.error(`No assets matched ASSET_IDS=${Array.from(REQUESTED_ASSET_IDS).join(',')}`);
  process.exit(1);
}

const removeWhiteBackground = (path) => {
  const script = `
from PIL import Image
from collections import deque
from pathlib import Path
import sys

path = Path(sys.argv[1])
im = Image.open(path).convert('RGBA')
pixels = im.load()
w, h = im.size
threshold = 244
visited = [[False] * h for _ in range(w)]
queue = deque()

def near_white(px):
    r, g, b, a = px
    return a > 0 and r >= threshold and g >= threshold and b >= threshold

for x in range(w):
    queue.append((x, 0))
    queue.append((x, h - 1))
for y in range(h):
    queue.append((0, y))
    queue.append((w - 1, y))

while queue:
    x, y = queue.popleft()
    if x < 0 or x >= w or y < 0 or y >= h or visited[x][y]:
        continue
    visited[x][y] = True
    if not near_white(pixels[x, y]):
        continue
    pixels[x, y] = (255, 255, 255, 0)
    queue.append((x + 1, y))
    queue.append((x - 1, y))
    queue.append((x, y + 1))
    queue.append((x, y - 1))

for x in range(w):
    for y in range(h):
        r, g, b, a = pixels[x, y]
        if a == 0:
            continue
        whiteness = min(r, g, b)
        if whiteness >= 236:
            alpha = max(0, min(a, int((255 - whiteness) * 8)))
            pixels[x, y] = (r, g, b, alpha)

im.save(path)
`;

  const result = spawnSync('python3', ['-c', script, path], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to remove white background');
  }
};

const generateImage = async (asset) => {
  const requestBody = {
    model: MODEL,
    prompt: asset.prompt,
    size: asset.size,
    quality: asset.quality,
    output_format: DEFAULT_OUTPUT_FORMAT,
  };
  if (asset.background !== 'transparent') {
    requestBody.background = asset.background;
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const data = payload?.data?.[0];
  if (!data?.b64_json) throw new Error('Missing image payload');

  const outputPath = resolve(OUTPUT_DIR, asset.filename);
  const publicPath = resolve(PUBLIC_DIR, asset.filename);
  writeFileSync(outputPath, Buffer.from(data.b64_json, 'base64'));
  if (asset.alphaKey) {
    removeWhiteBackground(outputPath);
  }
  copyFileSync(outputPath, publicPath);

  return {
    ...asset,
    outputPath,
    publicPath,
    revisedPrompt: data.revised_prompt || null,
    createdAt: new Date().toISOString(),
  };
};

const renderPreview = (results) => {
  const relativePublicRoot = '../../../../astro-blog/public';
  const cards = results
    .map((item) => {
      const currentSrc = `${currentPublicBase}/${item.filename}`;
      const generatedSrc = `${generatedPublicBase}/${item.filename}`;
      const statusClass = item.status === 'ok' ? 'ok' : 'error';
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
      <figure>
        <figcaption>Current</figcaption>
        <img src="${relativePublicRoot}${currentSrc}" alt="current ${item.filename}" />
      </figure>
      <figure>
        <figcaption>Generated</figcaption>
        <img src="${relativePublicRoot}${generatedSrc}" alt="generated ${item.filename}" />
      </figure>
    </div>`
          : `<p class="error-message">${item.error}</p>`;

      return `<section class="card ${statusClass}">
  <h2>${item.filename}</h2>
  <p>${item.kind}</p>
  ${body}
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Balloon Catch Assets Preview</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #fffaf6;
        --panel: #ffffff;
        --border: #eadfd7;
        --text: #503f42;
        --muted: #8d7477;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
        background: linear-gradient(180deg, #fff8fc 0%, #fdf8f2 100%);
        color: var(--text);
      }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p.meta { margin: 0 0 24px; color: var(--muted); }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(190, 172, 177, 0.14);
      }
      .comparison {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      figure {
        margin: 0;
        background: #fffdfb;
        border: 1px solid #f0e7df;
        border-radius: 16px;
        padding: 12px;
      }
      figcaption {
        margin-bottom: 8px;
        font-weight: 700;
        color: var(--muted);
      }
      img {
        width: 100%;
        height: 220px;
        object-fit: contain;
        display: block;
        background:
          linear-gradient(45deg, #f8f1ec 25%, transparent 25%) 0 0 / 24px 24px,
          linear-gradient(-45deg, #f8f1ec 25%, transparent 25%) 0 0 / 24px 24px,
          linear-gradient(45deg, transparent 75%, #f8f1ec 75%) 0 0 / 24px 24px,
          linear-gradient(-45deg, transparent 75%, #f8f1ec 75%) 0 0 / 24px 24px,
          #fff;
        border-radius: 12px;
      }
      .error-message { color: #a34343; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Balloon Catch Asset Comparison</h1>
    <p class="meta">Current assets remain untouched in ${currentPublicBase}. Generated files are mirrored into ${generatedPublicBase}.</p>
    <div class="grid">
      ${cards}
    </div>
  </body>
</html>`;
};

const previousManifest = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  : null;
const previousAssetsById = new Map((previousManifest?.assets || []).map((asset) => [asset.id, asset]));
const results = [];

for (const asset of selectedAssets) {
  try {
    console.log(`generating ${asset.id}...`);
    const result = await generateImage(asset);
    results.push({ ...result, status: 'ok' });
    console.log(`saved ${asset.filename}`);
  } catch (error) {
    results.push({
      ...asset,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      createdAt: new Date().toISOString(),
    });
    console.error(`failed ${asset.id}:`, error instanceof Error ? error.message : String(error));
  }
}

for (const asset of assets) {
  if (selectedAssets.some((selected) => selected.id === asset.id)) continue;
  const previous = previousAssetsById.get(asset.id);
  if (previous) results.push(previous);
}

results.sort((left, right) => assets.findIndex((asset) => asset.id === left.id) - assets.findIndex((asset) => asset.id === right.id));

writeFileSync(
  MANIFEST_PATH,
  JSON.stringify(
    {
      model: MODEL,
      generatedAt: new Date().toISOString(),
      outputDir: OUTPUT_DIR,
      publicDir: PUBLIC_DIR,
      assets: results.map((item) => ({
        id: item.id,
        filename: item.filename,
        kind: item.kind,
        size: item.size,
        quality: item.quality,
        background: item.background,
        prompt: item.prompt,
        revisedPrompt: item.revisedPrompt || null,
        status: item.status,
        error: item.error || null,
        createdAt: item.createdAt,
      })),
    },
    null,
    2,
  ),
);

writeFileSync(PREVIEW_PATH, renderPreview(results));

console.log(`manifest: ${MANIFEST_PATH}`);
console.log(`preview: ${PREVIEW_PATH}`);
