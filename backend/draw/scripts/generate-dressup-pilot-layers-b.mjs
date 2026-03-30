import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-pilot-b/raw');
const MANIFEST_PATH = resolve(process.cwd(), 'artifacts/dressup-pilot-b/raw-manifest.json');

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const commonStylePrompt =
  'cute princess encyclopedia style, dress-up game layer asset, designed to match model-princess-base-b, ' +
  'front view, same 1024x1024 canvas as the base doll, transparent background, soft pastel palette, clean outlines, ' +
  'polished 2D illustration, paper doll friendly, child-friendly and tidy silhouette, no background, no text, no watermark, ' +
  'sized similarly to the approved pilot sample for the same slot, match the apparent scale and coverage of the existing pilot asset, ' +
  'do not make it noticeably smaller or larger than the approved pilot asset for this slot, keep clear empty space outside the intended body part area';

const negativePrompt =
  'isolated product shot, centered floating object, mannequin display, fashion catalog background, attached to a whole character, ' +
  'photorealistic, realistic fabric photo, realistic jewelry photo, mature adult fashion illustration, sexy style, runway editorial, ' +
  'dark fantasy, horror, side view, 3/4 view, perspective angle, busy background, furniture, room, landscape, text, logo, watermark, ' +
  'messy linework, blurry transparent edges, oversized ornament, too wide for the body, too small relative to the body, floating clothing, merged shoes, covering the face';

const slotConfig = {
  hair: {
    anchorGuide:
      'place the accessory at the top center of the 1024 canvas, aligned to sit naturally on the base doll head and hairline',
    compatibility:
      'keep the apparent width and height close to the approved gold tiara pilot asset, sized for the same head area',
  },
  necklace: {
    anchorGuide:
      'place the necklace around the upper chest and neck center of the 1024 canvas, aligned to the base doll neckline',
    compatibility:
      'keep the apparent width and height close to the approved heart necklace pilot asset, sized for the same neck area',
  },
  top: {
    anchorGuide:
      'place the top in the torso and shoulder area of the 1024 canvas, aligned to the base doll shoulders, chest, waist and upper arms',
    compatibility:
      'keep the apparent shoulder width, torso coverage and length close to the approved frill blouse pilot asset',
  },
  bottom: {
    anchorGuide:
      'place the bottom in the waist and upper leg area of the 1024 canvas, aligned directly below the doll waist so it overlaps naturally with the top',
    compatibility:
      'keep the apparent width and length close to the approved frill skirt pilot asset, staying in the same waist-to-knee band',
  },
  shoes: {
    anchorGuide:
      'place the pair of shoes at the bottom center of the 1024 canvas, aligned naturally to the doll feet and ankles',
    compatibility:
      'keep the apparent width, left-right spacing and foot coverage close to the approved ribbon shoes pilot asset',
  },
};

const assets = [
  {
    id: 'gold-tiara',
    slot: 'hair',
    filename: 'item-hair-gold-tiara.png',
    label: 'ティアラ',
    prompt:
      'elegant gold tiara with pink and blue jewel accents, small and refined width slightly narrower than the head, cute princess accessory, leave the rest of the canvas empty',
  },
  {
    id: 'pink-ribbon',
    slot: 'hair',
    filename: 'item-hair-pink-ribbon.png',
    label: 'ピンクのリボン',
    prompt:
      'pastel pink ribbon hair accessory with a soft double-loop silhouette, cute princess bow, similar visible size to the approved gold tiara pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'sun-flower',
    slot: 'hair',
    filename: 'item-hair-sun-flower.png',
    label: 'おはなのかざり',
    prompt:
      'bright yellow flower hair ornament with a warm orange center, cheerful but tidy princess accessory, similar visible size to the approved gold tiara pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'star-pin',
    slot: 'hair',
    filename: 'item-hair-star-pin.png',
    label: 'ほしのピン',
    prompt:
      'sky blue star hair pin with a tiny sparkle accent, clean and compact princess accessory, similar visible size to the approved gold tiara pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'pearl-band',
    slot: 'hair',
    filename: 'item-hair-pearl-band.png',
    label: 'パールカチューシャ',
    prompt:
      'white pearl headband with a gentle glossy bead row, delicate princess hair accessory, similar visible size to the approved gold tiara pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'heart-necklace',
    slot: 'necklace',
    filename: 'item-necklace-heart-necklace.png',
    label: 'ハートのネックレス',
    prompt:
      'pink heart pendant with pearl chain, delicate but readable shape, sized to sit neatly around the neck area, leave the rest of the canvas empty',
  },
  {
    id: 'pearl-necklace',
    slot: 'necklace',
    filename: 'item-necklace-pearl-necklace.png',
    label: 'パールのネックレス',
    prompt:
      'classic pearl necklace with a neat rounded bead chain, elegant princess accessory, similar visible size to the approved heart necklace pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'star-necklace',
    slot: 'necklace',
    filename: 'item-necklace-star-necklace.png',
    label: 'ほしのネックレス',
    prompt:
      'blue star pendant necklace with a light pearl chain, tidy centered pendant, similar visible size to the approved heart necklace pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'ribbon-choker',
    slot: 'necklace',
    filename: 'item-necklace-ribbon-choker.png',
    label: 'りぼんチョーカー',
    prompt:
      'lavender ribbon choker with a small centered bow, elegant but compact neckline accessory, similar visible size to the approved heart necklace pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'gem-necklace',
    slot: 'necklace',
    filename: 'item-necklace-gem-necklace.png',
    label: 'ほうせきネックレス',
    prompt:
      'purple gem pendant necklace with a fine gold chain, polished princess jewelry silhouette, similar visible size to the approved heart necklace pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'frill-blouse',
    slot: 'top',
    filename: 'item-top-frill-blouse.png',
    label: 'ふりふりブラウス',
    prompt:
      'pastel pink frilly blouse with puff sleeves and ribbon detail, fitted to the torso and not wider than the shoulders, princess dress-up doll clothing, leave the rest of the canvas empty',
  },
  {
    id: 'pink-blouse',
    slot: 'top',
    filename: 'item-top-pink-blouse.png',
    label: 'ピンクのブラウス',
    prompt:
      'soft pastel pink blouse with a gentle rounded collar and tidy sleeves, fitted to the torso, similar apparent size and coverage to the approved frill blouse pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'puff-blouse',
    slot: 'top',
    filename: 'item-top-puff-blouse.png',
    label: 'パフそでブラウス',
    prompt:
      'pastel pink blouse with slightly puffed sleeves and a neat waistline, fitted to the torso, similar apparent size and coverage to the approved frill blouse pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'lace-top',
    slot: 'top',
    filename: 'item-top-lace-top.png',
    label: 'レーストップス',
    prompt:
      'white lace princess top with soft trim and a refined neckline, fitted to the torso, similar apparent size and coverage to the approved frill blouse pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'cape-top',
    slot: 'top',
    filename: 'item-top-cape-top.png',
    label: 'ケープつきトップス',
    prompt:
      'lavender princess top with a small decorative cape over the shoulders, fitted to the torso and shoulder area, similar apparent size and coverage to the approved frill blouse pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'frill-skirt',
    slot: 'bottom',
    filename: 'item-bottom-frill-skirt.png',
    label: 'フリルスカート',
    prompt:
      'pastel pink tiered frill skirt with soft folds, waist-aligned princess skirt for a dress-up doll, gentle volume without becoming wider than the lower body, leave the rest of the canvas empty',
  },
  {
    id: 'pink-skirt',
    slot: 'bottom',
    filename: 'item-bottom-pink-skirt.png',
    label: 'ピンクのふんわりスカート',
    prompt:
      'soft pastel pink fluffy skirt with a rounded princess silhouette, waist-aligned and similar apparent size to the approved frill skirt pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'lavender-longskirt',
    slot: 'bottom',
    filename: 'item-bottom-lavender-longskirt.png',
    label: 'ラベンダースカート',
    prompt:
      'lavender long skirt with a gentle princess drape, slightly longer but similar apparent width to the approved frill skirt pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'denim-shorts',
    slot: 'bottom',
    filename: 'item-bottom-denim-shorts.png',
    label: 'デニムショート',
    prompt:
      'cute blue denim shorts for a princess dress-up doll, tidy and compact lower-body silhouette, similar apparent width to the approved frill skirt pilot asset but shorter in height, leave the rest of the canvas empty',
  },
  {
    id: 'rain-pants',
    slot: 'bottom',
    filename: 'item-bottom-rain-pants.png',
    label: 'レインパンツ',
    prompt:
      'sky blue rain pants for a child-friendly princess outfit, neat straight-leg silhouette, similar apparent width to the approved frill skirt pilot asset and staying in the same lower-body band, leave the rest of the canvas empty',
  },
  {
    id: 'ribbon-shoes',
    slot: 'shoes',
    filename: 'item-shoes-ribbon-shoes.png',
    label: 'リボンシューズ',
    prompt:
      'pair of pastel pink ribbon ballet shoes with small jewel accents, slim child-friendly shape sized to the feet, leave the rest of the canvas empty',
  },
  {
    id: 'pink-ballet',
    slot: 'shoes',
    filename: 'item-shoes-pink-ballet.png',
    label: 'ピンクのくつ',
    prompt:
      'pair of pastel pink ballet shoes with a soft rounded toe, similar width and left-right spacing to the approved ribbon shoes pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'white-pumps',
    slot: 'shoes',
    filename: 'item-shoes-white-pumps.png',
    label: 'しろいパンプス',
    prompt:
      'pair of neat white pumps with a gentle princess silhouette, similar width and left-right spacing to the approved ribbon shoes pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'yellow-rainboots',
    slot: 'shoes',
    filename: 'item-shoes-yellow-rainboots.png',
    label: 'レインブーツ',
    prompt:
      'pair of cute yellow rain boots sized only to the feet, similar width and left-right spacing to the approved ribbon shoes pilot asset, leave the rest of the canvas empty',
  },
  {
    id: 'blue-sneakers',
    slot: 'shoes',
    filename: 'item-shoes-blue-sneakers.png',
    label: 'スニーカー',
    prompt:
      'pair of light blue sneakers with a soft child-friendly princess game style, similar width and left-right spacing to the approved ribbon shoes pilot asset, leave the rest of the canvas empty',
  },
];

const generateImage = async (asset) => {
  const slot = slotConfig[asset.slot];
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${commonStylePrompt}, ${slot.anchorGuide}, ${slot.compatibility}, ${asset.prompt}\n\nnegative prompt: ${negativePrompt}`,
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
    anchorGuide: slot.anchorGuide,
    compatibility: slot.compatibility,
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
      anchorGuide: slotConfig[asset.slot].anchorGuide,
      compatibility: slotConfig[asset.slot].compatibility,
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
      promptReference: 'docs/prompts/dressup-asset-generation.md',
      assetType: 'pilot-layer',
      assets: results.map((item) => ({
        id: item.id,
        slot: item.slot,
        label: item.label,
        filename: item.filename,
        prompt: item.prompt,
        anchorGuide: item.anchorGuide,
        compatibility: item.compatibility,
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
