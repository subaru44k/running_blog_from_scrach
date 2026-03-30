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
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-asset-layers-b');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const commonStylePrompt =
  "cute princess encyclopedia style, dress-up game layer asset, designed to match a princess dress-up doll style young girl base model, " +
  "front view, same 1024x1024 canvas as the base doll, transparent background, soft pastel palette, clean outlines, slightly more elegant princess feeling, " +
  "polished 2D illustration, child-friendly and tidy silhouette, paper doll friendly, no background, no text, no watermark";

const negativePrompt =
  'isolated product shot, centered object, floating object, fashion catalog background, mannequin display, photorealistic, realistic fabric photo, realistic jewelry photo, ' +
  'mature adult fashion illustration, sexy style, dark fantasy, horror, side view, 3/4 view, perspective angle, busy background, furniture, room, landscape, text, logo, watermark, ' +
  'attached to a whole character, messy linework, blurry transparent edges, oversized ornament, runway fashion editorial look';

const assets = [
  {
    id: 'item-hair-tiara-layer',
    filename: 'item-hair-tiara.png',
    slot: 'hair',
    anchorGuide: 'place the tiara at the top center of the 1024 canvas, aligned to sit naturally on the base doll head and hairline',
    prompt:
      'elegant gold tiara with pink and blue jewel accents, slim tidy shape, sized for a child-friendly princess doll head, leave the rest of the canvas empty',
  },
  {
    id: 'item-necklace-heart-layer',
    filename: 'item-necklace-heart.png',
    slot: 'necklace',
    anchorGuide: 'place the necklace around the upper chest and neck center of the 1024 canvas, aligned to the base doll neckline',
    prompt:
      'pink heart pendant with pearl chain, delicate but readable shape, sized for the neck area of a princess dress-up doll, leave the rest of the canvas empty',
  },
  {
    id: 'item-top-frill-blouse-layer',
    filename: 'item-top-frill-blouse.png',
    slot: 'top',
    anchorGuide: 'place the blouse in the torso and shoulder area of the 1024 canvas, aligned to the base doll shoulders, chest, waist and upper arms',
    prompt:
      'pastel pink frilly blouse with puff sleeves and ribbon detail, slim tidy torso fit, princess dress-up doll clothing, leave the rest of the canvas empty',
  },
  {
    id: 'item-bottom-fluffy-skirt-layer',
    filename: 'item-bottom-fluffy-skirt.png',
    slot: 'bottom',
    anchorGuide: 'place the skirt in the waist and upper leg area of the 1024 canvas, aligned directly below the doll waist so it overlaps naturally with the top',
    prompt:
      'pastel lavender pink layered fluffy skirt with soft frills and gentle volume, slightly elegant princess style, leave the rest of the canvas empty',
  },
  {
    id: 'item-shoes-ribbon-layer',
    filename: 'item-shoes-ribbon.png',
    slot: 'shoes',
    anchorGuide: 'place the pair of shoes at the bottom center of the 1024 canvas, aligned naturally to the doll feet and ankles',
    prompt:
      'pair of pastel pink princess ribbon shoes with small jewel accents, slim tidy child-friendly shape, leave the rest of the canvas empty',
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
      prompt: `${commonStylePrompt}, ${asset.anchorGuide}, ${asset.prompt}\n\nnegative prompt: ${negativePrompt}`,
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
      assetType: 'layer',
      assets: results.map((item) => ({
        id: item.id,
        filename: item.filename,
        kind: item.slot,
        prompt: item.prompt,
        anchorGuide: item.anchorGuide,
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
