import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const MODEL = 'gpt-image-1.5';
const QUALITY = 'medium';
const SIZE = '1024x1024';
const BACKGROUND = 'transparent';
const OUTPUT_FORMAT = 'png';
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-asset-samples-b');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const commonStylePrompt =
  "cute princess encyclopedia style, dress-up game item, designed to match a princess dress-up doll style young girl base model, " +
  "front view, soft pastel palette, clean outlines, slightly more elegant princess feeling, polished 2D illustration, " +
  "child-friendly and tidy silhouette, paper doll friendly, transparent background, centered composition, high readability, " +
  "no background, no text, no watermark";

const negativePrompt =
  'photorealistic, realistic metal texture, realistic fabric photo, mature adult fashion illustration, sexy style, dark fantasy, horror, ' +
  'side view, 3/4 view, perspective angle, busy background, furniture, room, landscape, text, logo, watermark, attached to a character, ' +
  'messy linework, blurry transparent edges, oversized ornament, runway fashion editorial look';

const assets = [
  {
    id: 'item-hair-tiara',
    filename: 'item-hair-tiara.png',
    kind: 'item',
    prompt:
      `${commonStylePrompt}, isolated tiara accessory, front-facing, elegant gold tiara with pink and blue jewel accents, ` +
      "soft pastel gold, slim tidy shape, easy to place on top of a girl's fluffy brown hair",
  },
  {
    id: 'item-necklace-heart',
    filename: 'item-necklace-heart.png',
    kind: 'item',
    prompt:
      `${commonStylePrompt}, isolated heart necklace, front-facing, pink heart pendant with pearl chain, delicate but readable shape, ` +
      'clear silhouette for layering on a dress-up doll neck area',
  },
  {
    id: 'item-top-frill-blouse',
    filename: 'item-top-frill-blouse.png',
    kind: 'item',
    prompt:
      `${commonStylePrompt}, isolated frill blouse, front view, pastel pink frilly blouse with puff sleeves and ribbon detail, ` +
      'slim tidy torso fit, princess dress-up doll clothing, shape designed for layering onto a character torso',
  },
  {
    id: 'item-bottom-fluffy-skirt',
    filename: 'item-bottom-fluffy-skirt.png',
    kind: 'item',
    prompt:
      `${commonStylePrompt}, isolated fluffy skirt, front view, pastel lavender pink layered skirt with soft frills and gentle volume, ` +
      'slightly elegant princess style, designed for layering onto a dress-up doll waist and leg area',
  },
  {
    id: 'item-shoes-ribbon',
    filename: 'item-shoes-ribbon.png',
    kind: 'item',
    prompt:
      `${commonStylePrompt}, isolated ribbon shoes, front-facing pair of pastel pink princess shoes with ribbon decoration and small jewel accents, ` +
      'slim tidy child-friendly shape, designed for layering onto a dress-up doll feet area',
  },
];

const generateImage = async (asset) => {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${asset.prompt}\n\nnegative prompt: ${negativePrompt}`,
      size: SIZE,
      quality: QUALITY,
      background: BACKGROUND,
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

  const outputPath = resolve(OUTPUT_DIR, asset.filename);
  writeFileSync(outputPath, Buffer.from(data.b64_json, 'base64'));

  return {
    ...asset,
    outputPath,
    revisedPrompt: data.revised_prompt || null,
    createdAt: new Date().toISOString(),
  };
};

const results = [];

for (const asset of assets) {
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

writeFileSync(
  MANIFEST_PATH,
  JSON.stringify(
    {
      model: MODEL,
      quality: QUALITY,
      size: SIZE,
      background: BACKGROUND,
      outputFormat: OUTPUT_FORMAT,
      generatedAt: new Date().toISOString(),
      styleReference: 'model-princess-base-b',
      assets: results.map((item) => ({
        id: item.id,
        filename: item.filename,
        kind: item.kind,
        prompt: item.prompt,
        negativePrompt,
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

console.log(`manifest: ${MANIFEST_PATH}`);
