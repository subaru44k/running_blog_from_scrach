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
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-model-variants');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const negativePrompt =
  'photorealistic, realistic skin texture, mature adult proportions, sexy pose, dark fantasy, horror, side view, 3/4 view, ' +
  'perspective pose, busy background, furniture, room, landscape, text, logo, watermark, extra fingers, extra limbs, ' +
  'cropped head, cropped feet, blurry transparent edges, messy linework, oversized dress, dramatic pose, fashion model runway pose';

const variants = [
  {
    id: 'model-princess-base-a',
    filename: 'model-princess-base-a.png',
    label: 'A: きせかえ人形の王道',
    prompt:
      "cute princess encyclopedia style, dress-up game base model, dress-up doll style young girl, front view, full body, standing straight, arms gently down, " +
      'slightly taller proportions than a toddler illustration, clean torso and waist silhouette for outfit overlays, neat legs and feet placement, ' +
      'large sparkling eyes, soft smile, round cheeks, fluffy brown bob hair, pale cream pink simple base dress, minimal base clothing, ' +
      'paper doll friendly, clean outlines, soft pastel palette, high readability, transparent background, centered composition, no background, no text, no watermark',
  },
  {
    id: 'model-princess-base-b',
    filename: 'model-princess-base-b.png',
    label: 'B: 少しおひめさま寄り',
    prompt:
      "cute princess encyclopedia style, dress-up game base model, princess dress-up doll style young girl, front view, full body, standing straight, arms gently down, " +
      'slim and tidy child-friendly proportions for clothing overlays, pretty face, large sparkling eyes, soft blush, fluffy brown hair with gentle volume, ' +
      'slightly more elegant princess feeling, pale pink cream simple inner dress, minimal base clothing, paper doll friendly, transparent background, centered composition, ' +
      'clean outlines, polished 2D illustration, no background, no text, no watermark',
  },
  {
    id: 'model-princess-base-c',
    filename: 'model-princess-base-c.png',
    label: 'C: 少し図鑑イラスト寄り',
    prompt:
      "cute princess encyclopedia style, dress-up game base model, children's illustrated dress-up doll, front view, full body, standing straight, arms gently down, " +
      'organized silhouette, clear neck torso waist skirt legs and shoes separation, simple and readable linework, slightly flatter storybook encyclopedia feel, ' +
      'large eyes, gentle smile, brown soft bob hair, very light cream pink base dress, minimal base clothing, paper doll friendly, transparent background, centered composition, ' +
      'clean outlines, soft pastel palette, high readability, no background, no text, no watermark',
  },
];

const generateImage = async (variant) => {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${variant.prompt}\n\nnegative prompt: ${negativePrompt}`,
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

  const outputPath = resolve(OUTPUT_DIR, variant.filename);
  writeFileSync(outputPath, Buffer.from(data.b64_json, 'base64'));

  return {
    ...variant,
    outputPath,
    revisedPrompt: data.revised_prompt || null,
    createdAt: new Date().toISOString(),
  };
};

const results = [];

for (const variant of variants) {
  try {
    console.log(`generating ${variant.id}...`);
    const result = await generateImage(variant);
    results.push({ ...result, status: 'ok' });
    console.log(`saved ${variant.filename}`);
  } catch (error) {
    results.push({
      ...variant,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      createdAt: new Date().toISOString(),
    });
    console.error(`failed ${variant.id}:`, error instanceof Error ? error.message : String(error));
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
      variants: results.map((item) => ({
        id: item.id,
        label: item.label,
        filename: item.filename,
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
