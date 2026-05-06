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
const ITEM_FIT_DIR = resolve(OUTPUT_DIR, 'item-fit');
const ITEM_FIT_RAW_DIR = resolve(ITEM_FIT_DIR, 'raw');
const ITEM_FIT_CUTOUT_DIR = resolve(ITEM_FIT_DIR, 'cutout');
const ITEM_FIT_NORMALIZED_DIR = resolve(ITEM_FIT_DIR, 'normalized');
const ITEM_FIT_SPLIT_DIR = resolve(ITEM_FIT_DIR, 'split');
const ITEM_FIT_COMPOSITE_DIR = resolve(ITEM_FIT_DIR, 'composite');
const ITEM_FIT_PREVIEW_PATH = resolve(ITEM_FIT_DIR, 'item-fit-preview.html');
const ITEM_FIT_REVIEW_PATH = resolve(ITEM_FIT_DIR, 'item-fit-review.md');
const ITEM_FIT_V2_DIR = resolve(OUTPUT_DIR, 'item-fit-v2');
const ITEM_FIT_V2_RAW_DIR = resolve(ITEM_FIT_V2_DIR, 'raw');
const ITEM_FIT_V2_CUTOUT_DIR = resolve(ITEM_FIT_V2_DIR, 'cutout');
const ITEM_FIT_V2_NORMALIZED_DIR = resolve(ITEM_FIT_V2_DIR, 'normalized');
const ITEM_FIT_V2_MASKED_COMPOSITE_DIR = resolve(ITEM_FIT_V2_DIR, 'masked-composite');
const ITEM_FIT_V2_PREVIEW_PATH = resolve(ITEM_FIT_V2_DIR, 'item-fit-v2-preview.html');
const ITEM_FIT_V2_GENERATED_REVIEW_PATH = resolve(ITEM_FIT_V2_DIR, 'item-fit-v2-generated-review.md');
const ITEM_FIT_V2_REVIEW_PATH = resolve(ITEM_FIT_V2_DIR, 'item-fit-v2-review.md');
const ITEM_FIT_V3_DIR = resolve(OUTPUT_DIR, 'item-fit-v3');
const ITEM_FIT_V3_RAW_DIR = resolve(ITEM_FIT_V3_DIR, 'raw');
const ITEM_FIT_V3_CUTOUT_DIR = resolve(ITEM_FIT_V3_DIR, 'cutout');
const ITEM_FIT_V3_NORMALIZED_DIR = resolve(ITEM_FIT_V3_DIR, 'normalized');
const ITEM_FIT_V3_SPLIT_DIR = resolve(ITEM_FIT_V3_DIR, 'split');
const ITEM_FIT_V3_COMPOSITE_DIR = resolve(ITEM_FIT_V3_DIR, 'composite');
const ITEM_FIT_V3_PREVIEW_PATH = resolve(ITEM_FIT_V3_DIR, 'item-fit-v3-preview.html');
const ITEM_FIT_V3_GENERATED_REVIEW_PATH = resolve(ITEM_FIT_V3_DIR, 'item-fit-v3-generated-review.md');
const ITEM_FIT_V3_REVIEW_PATH = resolve(ITEM_FIT_V3_DIR, 'item-fit-v3-review.md');
const ITEM_FIT_V4_DIR = resolve(OUTPUT_DIR, 'item-fit-v4');
const ITEM_FIT_V4_RAW_DIR = resolve(ITEM_FIT_V4_DIR, 'raw');
const ITEM_FIT_V4_CUTOUT_DIR = resolve(ITEM_FIT_V4_DIR, 'cutout');
const ITEM_FIT_V4_NORMALIZED_DIR = resolve(ITEM_FIT_V4_DIR, 'normalized');
const ITEM_FIT_V4_SPLIT_DIR = resolve(ITEM_FIT_V4_DIR, 'split');
const ITEM_FIT_V4_COMPOSITE_DIR = resolve(ITEM_FIT_V4_DIR, 'composite');
const ITEM_FIT_V4_PREVIEW_PATH = resolve(ITEM_FIT_V4_DIR, 'item-fit-v4-preview.html');
const ITEM_FIT_V4_GENERATED_REVIEW_PATH = resolve(ITEM_FIT_V4_DIR, 'item-fit-v4-generated-review.md');
const ITEM_FIT_V4_REVIEW_PATH = resolve(ITEM_FIT_V4_DIR, 'item-fit-v4-review.md');
const ANCHOR_AUDIT_DIR = resolve(OUTPUT_DIR, 'anchor-audit');
const ANCHOR_AUDIT_JSON_PATH = resolve(ANCHOR_AUDIT_DIR, 'measured-style-model.json');
const ANCHOR_AUDIT_PREVIEW_PATH = resolve(ANCHOR_AUDIT_DIR, 'anchor-audit-preview.html');
const ANCHOR_AUDIT_REVIEW_PATH = resolve(ANCHOR_AUDIT_DIR, 'anchor-audit-review.md');
const ITEM_FIT_V5_DIR = resolve(OUTPUT_DIR, 'item-fit-v5-measured');
const ITEM_FIT_V5_NORMALIZED_DIR = resolve(ITEM_FIT_V5_DIR, 'normalized');
const ITEM_FIT_V5_SPLIT_DIR = resolve(ITEM_FIT_V5_DIR, 'split');
const ITEM_FIT_V5_COMPOSITE_DIR = resolve(ITEM_FIT_V5_DIR, 'composite');
const ITEM_FIT_V5_PREVIEW_PATH = resolve(ITEM_FIT_V5_DIR, 'item-fit-v5-preview.html');
const ITEM_FIT_V5_REVIEW_PATH = resolve(ITEM_FIT_V5_DIR, 'item-fit-v5-review.md');
const SHOULDER_LINE_AUDIT_DIR = resolve(OUTPUT_DIR, 'shoulder-line-audit');
const SHOULDER_LINE_AUDIT_JSON_PATH = resolve(SHOULDER_LINE_AUDIT_DIR, 'measured-shoulder-line.json');
const SHOULDER_LINE_AUDIT_PREVIEW_PATH = resolve(SHOULDER_LINE_AUDIT_DIR, 'shoulder-line-audit-preview.html');
const SHOULDER_LINE_AUDIT_REVIEW_PATH = resolve(SHOULDER_LINE_AUDIT_DIR, 'shoulder-line-audit-review.md');
const ITEM_FIT_V6_DIR = resolve(OUTPUT_DIR, 'item-fit-v6-shoulder-necklace');
const ITEM_FIT_V6_NORMALIZED_DIR = resolve(ITEM_FIT_V6_DIR, 'normalized');
const ITEM_FIT_V6_COMPOSITE_DIR = resolve(ITEM_FIT_V6_DIR, 'composite');
const ITEM_FIT_V6_PREVIEW_PATH = resolve(ITEM_FIT_V6_DIR, 'item-fit-v6-preview.html');
const ITEM_FIT_V6_REVIEW_PATH = resolve(ITEM_FIT_V6_DIR, 'item-fit-v6-review.md');
const ITEM_FIT_V7_DIR = resolve(OUTPUT_DIR, 'item-fit-v7-necklace');
const ITEM_FIT_V7_RAW_DIR = resolve(ITEM_FIT_V7_DIR, 'raw');
const ITEM_FIT_V7_CUTOUT_DIR = resolve(ITEM_FIT_V7_DIR, 'cutout');
const ITEM_FIT_V7_NORMALIZED_DIR = resolve(ITEM_FIT_V7_DIR, 'normalized');
const ITEM_FIT_V7_COMPOSITE_DIR = resolve(ITEM_FIT_V7_DIR, 'composite');
const ITEM_FIT_V7_PREVIEW_PATH = resolve(ITEM_FIT_V7_DIR, 'item-fit-v7-preview.html');
const ITEM_FIT_V7_REVIEW_PATH = resolve(ITEM_FIT_V7_DIR, 'item-fit-v7-review.md');
const NECKLACE_ANCHOR_AUDIT_DIR = resolve(OUTPUT_DIR, 'necklace-anchor-audit');
const NECKLACE_ANCHOR_AUDIT_JSON_PATH = resolve(NECKLACE_ANCHOR_AUDIT_DIR, 'measured-necklace-anchors.json');
const NECKLACE_ANCHOR_AUDIT_PREVIEW_PATH = resolve(NECKLACE_ANCHOR_AUDIT_DIR, 'necklace-anchor-audit-preview.html');
const NECKLACE_ANCHOR_AUDIT_REVIEW_PATH = resolve(NECKLACE_ANCHOR_AUDIT_DIR, 'necklace-anchor-audit-review.md');
const ITEM_FIT_V8_DIR = resolve(OUTPUT_DIR, 'item-fit-v8-necklace-reanchor');
const ITEM_FIT_V8_NORMALIZED_DIR = resolve(ITEM_FIT_V8_DIR, 'normalized');
const ITEM_FIT_V8_COMPOSITE_DIR = resolve(ITEM_FIT_V8_DIR, 'composite');
const ITEM_FIT_V8_PREVIEW_PATH = resolve(ITEM_FIT_V8_DIR, 'item-fit-v8-preview.html');
const ITEM_FIT_V8_REVIEW_PATH = resolve(ITEM_FIT_V8_DIR, 'item-fit-v8-review.md');
const ITEM_FIT_V9_DIR = resolve(OUTPUT_DIR, 'item-fit-v9-accessory-stability');
const ITEM_FIT_V9_RAW_DIR = resolve(ITEM_FIT_V9_DIR, 'raw');
const ITEM_FIT_V9_CUTOUT_DIR = resolve(ITEM_FIT_V9_DIR, 'cutout');
const ITEM_FIT_V9_NORMALIZED_DIR = resolve(ITEM_FIT_V9_DIR, 'normalized');
const ITEM_FIT_V9_SPLIT_DIR = resolve(ITEM_FIT_V9_DIR, 'split');
const ITEM_FIT_V9_COMPOSITE_DIR = resolve(ITEM_FIT_V9_DIR, 'composite');
const ITEM_FIT_V9_PREVIEW_PATH = resolve(ITEM_FIT_V9_DIR, 'item-fit-v9-preview.html');
const ITEM_FIT_V9_REVIEW_PATH = resolve(ITEM_FIT_V9_DIR, 'item-fit-v9-review.md');
const ITEM_FIT_V10_DIR = resolve(OUTPUT_DIR, 'item-fit-v10-boots-alpha');
const ITEM_FIT_V10_SPLIT_DIR = resolve(ITEM_FIT_V10_DIR, 'split');
const ITEM_FIT_V10_NORMALIZED_DIR = resolve(ITEM_FIT_V10_DIR, 'normalized');
const ITEM_FIT_V10_COMPOSITE_DIR = resolve(ITEM_FIT_V10_DIR, 'composite');
const ITEM_FIT_V10_PREVIEW_PATH = resolve(ITEM_FIT_V10_DIR, 'item-fit-v10-preview.html');
const ITEM_FIT_V10_REVIEW_PATH = resolve(ITEM_FIT_V10_DIR, 'item-fit-v10-review.md');
const ITEM_FIT_V11_DIR = resolve(OUTPUT_DIR, 'item-fit-v11-hair-accessory');
const ITEM_FIT_V11_RAW_DIR = resolve(ITEM_FIT_V11_DIR, 'raw');
const ITEM_FIT_V11_CUTOUT_DIR = resolve(ITEM_FIT_V11_DIR, 'cutout');
const ITEM_FIT_V11_NORMALIZED_DIR = resolve(ITEM_FIT_V11_DIR, 'normalized');
const ITEM_FIT_V11_COMPOSITE_DIR = resolve(ITEM_FIT_V11_DIR, 'composite');
const ITEM_FIT_V11_PREVIEW_PATH = resolve(ITEM_FIT_V11_DIR, 'item-fit-v11-preview.html');
const ITEM_FIT_V11_REVIEW_PATH = resolve(ITEM_FIT_V11_DIR, 'item-fit-v11-review.md');
const ITEM_FIT_V12_DIR = resolve(OUTPUT_DIR, 'item-fit-v12-hair-accessory-stability');
const ITEM_FIT_V12_RAW_DIR = resolve(ITEM_FIT_V12_DIR, 'raw');
const ITEM_FIT_V12_CUTOUT_DIR = resolve(ITEM_FIT_V12_DIR, 'cutout');
const ITEM_FIT_V12_NORMALIZED_DIR = resolve(ITEM_FIT_V12_DIR, 'normalized');
const ITEM_FIT_V12_COMPOSITE_DIR = resolve(ITEM_FIT_V12_DIR, 'composite');
const ITEM_FIT_V12_PREVIEW_PATH = resolve(ITEM_FIT_V12_DIR, 'item-fit-v12-preview.html');
const ITEM_FIT_V12_REVIEW_PATH = resolve(ITEM_FIT_V12_DIR, 'item-fit-v12-review.md');
const ITEM_FIT_V13_DIR = resolve(OUTPUT_DIR, 'item-fit-v13-clothing');
const ITEM_FIT_V13_RAW_DIR = resolve(ITEM_FIT_V13_DIR, 'raw');
const ITEM_FIT_V13_CUTOUT_DIR = resolve(ITEM_FIT_V13_DIR, 'cutout');
const ITEM_FIT_V13_NORMALIZED_DIR = resolve(ITEM_FIT_V13_DIR, 'normalized');
const ITEM_FIT_V13_COMPOSITE_DIR = resolve(ITEM_FIT_V13_DIR, 'composite');
const ITEM_FIT_V13_PREVIEW_PATH = resolve(ITEM_FIT_V13_DIR, 'item-fit-v13-preview.html');
const ITEM_FIT_V13_REVIEW_PATH = resolve(ITEM_FIT_V13_DIR, 'item-fit-v13-review.md');
const ITEM_FIT_V14_DIR = resolve(OUTPUT_DIR, 'item-fit-v14-long-bottom');
const ITEM_FIT_V14_RAW_DIR = resolve(ITEM_FIT_V14_DIR, 'raw');
const ITEM_FIT_V14_CUTOUT_DIR = resolve(ITEM_FIT_V14_DIR, 'cutout');
const ITEM_FIT_V14_NORMALIZED_DIR = resolve(ITEM_FIT_V14_DIR, 'normalized');
const ITEM_FIT_V14_COMPOSITE_DIR = resolve(ITEM_FIT_V14_DIR, 'composite');
const ITEM_FIT_V14_PREVIEW_PATH = resolve(ITEM_FIT_V14_DIR, 'item-fit-v14-preview.html');
const ITEM_FIT_V14_REVIEW_PATH = resolve(ITEM_FIT_V14_DIR, 'item-fit-v14-review.md');
const ITEM_FIT_V15_DIR = resolve(OUTPUT_DIR, 'item-fit-v15-layer-stack');
const ITEM_FIT_V15_COMPOSITE_DIR = resolve(ITEM_FIT_V15_DIR, 'composite');
const ITEM_FIT_V15_PREVIEW_PATH = resolve(ITEM_FIT_V15_DIR, 'item-fit-v15-preview.html');
const ITEM_FIT_V15_REVIEW_PATH = resolve(ITEM_FIT_V15_DIR, 'item-fit-v15-review.md');
const ITEM_FIT_V16_DIR = resolve(OUTPUT_DIR, 'item-fit-v16-flat-cuff-boots');
const ITEM_FIT_V16_RAW_DIR = resolve(ITEM_FIT_V16_DIR, 'raw');
const ITEM_FIT_V16_CUTOUT_DIR = resolve(ITEM_FIT_V16_DIR, 'cutout');
const ITEM_FIT_V16_SPLIT_DIR = resolve(ITEM_FIT_V16_DIR, 'split');
const ITEM_FIT_V16_NORMALIZED_DIR = resolve(ITEM_FIT_V16_DIR, 'normalized');
const ITEM_FIT_V16_COMPOSITE_DIR = resolve(ITEM_FIT_V16_DIR, 'composite');
const ITEM_FIT_V16_PREVIEW_PATH = resolve(ITEM_FIT_V16_DIR, 'item-fit-v16-preview.html');
const ITEM_FIT_V16_REVIEW_PATH = resolve(ITEM_FIT_V16_DIR, 'item-fit-v16-review.md');
const ITEM_FIT_V17_DIR = resolve(OUTPUT_DIR, 'item-fit-v17-game-catalog');
const ITEM_FIT_V17_RAW_DIR = resolve(ITEM_FIT_V17_DIR, 'raw');
const ITEM_FIT_V17_CUTOUT_DIR = resolve(ITEM_FIT_V17_DIR, 'cutout');
const ITEM_FIT_V17_SPLIT_DIR = resolve(ITEM_FIT_V17_DIR, 'split');
const ITEM_FIT_V17_NORMALIZED_DIR = resolve(ITEM_FIT_V17_DIR, 'normalized');
const ITEM_FIT_V17_COMPOSITE_DIR = resolve(ITEM_FIT_V17_DIR, 'composite');
const ITEM_FIT_V17_PREVIEW_PATH = resolve(ITEM_FIT_V17_DIR, 'item-fit-v17-preview.html');
const ITEM_FIT_V17_REVIEW_PATH = resolve(ITEM_FIT_V17_DIR, 'item-fit-v17-review.md');
const ITEM_FIT_V18_DIR = resolve(OUTPUT_DIR, 'item-fit-v18-expanded-catalog');
const ITEM_FIT_V18_RAW_DIR = resolve(ITEM_FIT_V18_DIR, 'raw');
const ITEM_FIT_V18_CUTOUT_DIR = resolve(ITEM_FIT_V18_DIR, 'cutout');
const ITEM_FIT_V18_SPLIT_DIR = resolve(ITEM_FIT_V18_DIR, 'split');
const ITEM_FIT_V18_NORMALIZED_DIR = resolve(ITEM_FIT_V18_DIR, 'normalized');
const ITEM_FIT_V18_COMPOSITE_DIR = resolve(ITEM_FIT_V18_DIR, 'composite');
const ITEM_FIT_V18_PREVIEW_PATH = resolve(ITEM_FIT_V18_DIR, 'item-fit-v18-preview.html');
const ITEM_FIT_V18_REVIEW_PATH = resolve(ITEM_FIT_V18_DIR, 'item-fit-v18-review.md');

const MODEL = 'gpt-image-2';
const QUALITY = 'medium';
const SIZE = '1024x1536';
const OUTPUT_FORMAT = 'png';
const RENDER_ONLY = process.env.RENDER_ONLY === '1';
const STYLE_BATCH = process.env.STYLE_BATCH || '';
const ITEM_BATCH = process.env.ITEM_BATCH || '';
const REQUESTED_CANDIDATE_IDS = new Set((process.env.CANDIDATE_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
const REQUESTED_STYLE_CANDIDATE_IDS = new Set((process.env.STYLE_CANDIDATE_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));
const REQUESTED_ITEM_IDS = new Set((process.env.ITEM_IDS || '').split(',').map((value) => value.trim()).filter(Boolean));

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

for (const dir of [
  MODEL_RAW_DIR,
  MODEL_CUTOUT_DIR,
  STYLE_RAW_DIR,
  STYLE_CUTOUT_DIR,
  ITEM_FIT_RAW_DIR,
  ITEM_FIT_CUTOUT_DIR,
  ITEM_FIT_NORMALIZED_DIR,
  ITEM_FIT_SPLIT_DIR,
  ITEM_FIT_COMPOSITE_DIR,
  ITEM_FIT_V2_RAW_DIR,
  ITEM_FIT_V2_CUTOUT_DIR,
  ITEM_FIT_V2_NORMALIZED_DIR,
  ITEM_FIT_V2_MASKED_COMPOSITE_DIR,
  ITEM_FIT_V3_RAW_DIR,
  ITEM_FIT_V3_CUTOUT_DIR,
  ITEM_FIT_V3_NORMALIZED_DIR,
  ITEM_FIT_V3_SPLIT_DIR,
  ITEM_FIT_V3_COMPOSITE_DIR,
  ITEM_FIT_V4_RAW_DIR,
  ITEM_FIT_V4_CUTOUT_DIR,
  ITEM_FIT_V4_NORMALIZED_DIR,
  ITEM_FIT_V4_SPLIT_DIR,
  ITEM_FIT_V4_COMPOSITE_DIR,
  ANCHOR_AUDIT_DIR,
  ITEM_FIT_V5_NORMALIZED_DIR,
  ITEM_FIT_V5_SPLIT_DIR,
  ITEM_FIT_V5_COMPOSITE_DIR,
  SHOULDER_LINE_AUDIT_DIR,
  ITEM_FIT_V6_NORMALIZED_DIR,
  ITEM_FIT_V6_COMPOSITE_DIR,
  ITEM_FIT_V7_RAW_DIR,
  ITEM_FIT_V7_CUTOUT_DIR,
  ITEM_FIT_V7_NORMALIZED_DIR,
  ITEM_FIT_V7_COMPOSITE_DIR,
  NECKLACE_ANCHOR_AUDIT_DIR,
  ITEM_FIT_V8_NORMALIZED_DIR,
  ITEM_FIT_V8_COMPOSITE_DIR,
  ITEM_FIT_V9_RAW_DIR,
  ITEM_FIT_V9_CUTOUT_DIR,
  ITEM_FIT_V9_NORMALIZED_DIR,
  ITEM_FIT_V9_SPLIT_DIR,
  ITEM_FIT_V9_COMPOSITE_DIR,
  ITEM_FIT_V10_SPLIT_DIR,
  ITEM_FIT_V10_NORMALIZED_DIR,
  ITEM_FIT_V10_COMPOSITE_DIR,
  ITEM_FIT_V11_RAW_DIR,
  ITEM_FIT_V11_CUTOUT_DIR,
  ITEM_FIT_V11_NORMALIZED_DIR,
  ITEM_FIT_V11_COMPOSITE_DIR,
  ITEM_FIT_V12_RAW_DIR,
  ITEM_FIT_V12_CUTOUT_DIR,
  ITEM_FIT_V12_NORMALIZED_DIR,
  ITEM_FIT_V12_COMPOSITE_DIR,
  ITEM_FIT_V13_RAW_DIR,
  ITEM_FIT_V13_CUTOUT_DIR,
  ITEM_FIT_V13_NORMALIZED_DIR,
  ITEM_FIT_V13_COMPOSITE_DIR,
  ITEM_FIT_V14_RAW_DIR,
  ITEM_FIT_V14_CUTOUT_DIR,
  ITEM_FIT_V14_NORMALIZED_DIR,
  ITEM_FIT_V14_COMPOSITE_DIR,
  ITEM_FIT_V15_COMPOSITE_DIR,
  ITEM_FIT_V16_RAW_DIR,
  ITEM_FIT_V16_CUTOUT_DIR,
  ITEM_FIT_V16_SPLIT_DIR,
  ITEM_FIT_V16_NORMALIZED_DIR,
  ITEM_FIT_V16_COMPOSITE_DIR,
  ITEM_FIT_V17_RAW_DIR,
  ITEM_FIT_V17_CUTOUT_DIR,
  ITEM_FIT_V17_SPLIT_DIR,
  ITEM_FIT_V17_NORMALIZED_DIR,
  ITEM_FIT_V17_COMPOSITE_DIR,
  ITEM_FIT_V18_RAW_DIR,
  ITEM_FIT_V18_CUTOUT_DIR,
  ITEM_FIT_V18_SPLIT_DIR,
  ITEM_FIT_V18_NORMALIZED_DIR,
  ITEM_FIT_V18_COMPOSITE_DIR,
]) {
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

const itemFitCandidates = [
  {
    id: 'necklace-heart-pearl-fit',
    type: 'necklace',
    filename: 'necklace-heart-pearl-fit.png',
    label: 'Necklace: tiny heart pearl fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'tiny pearl chain with one very small heart charm, front view, centered on a pure white 1024 by 1536 canvas, draw only the necklace and no body, no neck, no dress, no mannequin, ' +
      'place the necklace near canvas center x 512 y 405, keep the whole necklace inside x 400 to 624 and y 360 to 480, total width no more than 224 pixels, ' +
      'small enough to fit inside the model shoulders and around the neckline, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'shoes-ribbon-ballet-fit',
    type: 'shoes',
    filename: 'shoes-ribbon-ballet-fit.png',
    label: 'Shoes: ribbon ballet fit',
    prompt:
      'pair of simple ribbon ballet shoes layer for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only two shoes and no legs, no socks, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'place the left shoe near canvas area x 394 to 526 and y 1308 to 1478 with toe near x 450 y 1436, place the right shoe near canvas area x 508 to 640 and y 1308 to 1478 with toe near x 572 y 1436, ' +
      'keep the shoes small and aligned as a matched pair for a front-facing paper doll, no text, no watermark',
  },
];

const itemFitV2Candidates = [
  {
    id: 'necklace-symmetric-heart-pearl-fit',
    type: 'necklace',
    filename: 'necklace-symmetric-heart-pearl-fit.png',
    label: 'Necklace: symmetric heart pearl fit',
    prompt:
      'perfectly symmetrical small princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view U-shaped pearl chain, left and right chain ends at exactly the same height, one tiny heart pendant exactly on the vertical center line, ' +
      'draw only the necklace and no body, no neck, no dress, no mannequin, pure white 1024 by 1536 canvas, ' +
      'place the pendant at canvas x 512 y 430 and keep the entire necklace inside x 410 to 614 and y 365 to 475, total width no more than 204 pixels, ' +
      'balanced and centered for a front-facing paper doll neckline, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'footwear-patch-mary-jane-fit',
    type: 'footwearPatch',
    filename: 'footwear-patch-mary-jane-fit.png',
    label: 'Footwear patch: Mary Jane fit',
    prompt:
      'footwear replacement patch for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view pair of lower ankles and feet wearing low pink Mary Jane flat shoes, draw the visible skin ankles above the shoes and the shoes covering toes naturally, ' +
      'draw only the lower ankles, feet, and shoes, no knees, no full legs, no dress, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'place the patch near the bottom center: left ankle near x 456 y 1350 and left toe/shoe tip near x 450 y 1436, right ankle near x 568 y 1350 and right toe/shoe tip near x 572 y 1436, ' +
      'keep the complete replacement patch inside x 382 to 662 and y 1298 to 1503, maintain the same front-facing stance and spacing as a paper doll base, no text, no watermark',
  },
];

const itemFitV3Candidates = [
  {
    id: 'necklace-shoulder-aligned-fit',
    type: 'necklace',
    filename: 'necklace-shoulder-aligned-fit.png',
    label: 'Necklace: shoulder aligned fit',
    prompt:
      'small princess necklace fitted to this front-facing paper doll neckline, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'draw only the necklace and no body, no neck, no dress, no mannequin, pure white 1024 by 1536 canvas, ' +
      'symmetrical U-shaped fine chain with one tiny heart pendant exactly on the body center line at x 512, left and right chain ends at the same height near x 430 and x 594 around y 405, ' +
      'chain follows a shallow round neckline curve and stays just inside the shoulder line, not floating above the shoulders, not sloping toward either shoulder, total width no more than 190 pixels, ' +
      'small enough for a child paper doll neckline, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'boots-high-coverage-fit',
    type: 'boots',
    filename: 'boots-high-coverage-fit.png',
    label: 'Boots: high coverage overlay fit',
    prompt:
      'pair of short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'high coverage rounded toe boots that completely cover toes and the top of each foot, soft pink with simple princess ribbon detail kept small, ' +
      'place left boot inside x 394 to 526 and y 1308 to 1478 with toe near x 450 y 1436, place right boot inside x 508 to 640 and y 1308 to 1478 with toe near x 572 y 1436, ' +
      'matched pair for a front-facing paper doll, same size left and right, no text, no watermark',
  },
];

const itemFitV4Candidates = [
  {
    id: 'necklace-short-collarbone-fit',
    type: 'necklace',
    filename: 'necklace-short-collarbone-fit.png',
    label: 'Necklace: short collarbone fit',
    prompt:
      'very short collarbone princess necklace fitted inside a front-facing paper doll neckline, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'draw only the necklace and no body, no neck, no dress, no mannequin, pure white 1024 by 1536 canvas, ' +
      'tiny symmetrical shallow U-shaped chain with one small heart pendant exactly on the body center line at x 512, chain ends near x 452 and x 572 around y 392, ' +
      'the chain stays inside the dress neckline opening, does not touch shoulder straps, does not extend toward shoulders, total width no more than 150 pixels, ' +
      'small delicate child paper doll accessory, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'boots-ankle-scale-fit',
    type: 'boots',
    filename: 'boots-ankle-scale-fit.png',
    label: 'Boots: ankle scale overlay fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'narrow boot opening matching a small ankle width, rounded toe covers toes but the boot is not oversized, each boot about as wide as a child paper doll foot, ' +
      'soft pink simple ankle boots with minimal decoration, place left boot near toe x 450 y 1436 and right boot near toe x 572 y 1436, matched pair, same size left and right, no text, no watermark',
  },
];

const itemFitV7Candidates = [
  {
    id: 'necklace-inner-shoulder-line-fit',
    type: 'necklace',
    filename: 'necklace-inner-shoulder-line-fit.png',
    label: 'Necklace: inner shoulder line fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped fine gold chain with one tiny pink heart pendant, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain end at canvas x 444 y 376 and right chain end at canvas x 564 y 376, chain follows the inner shoulder and collarbone line from the neck toward the shoulders, ' +
      'total visible necklace width between 120 and 140 pixels, total height between 60 and 85 pixels, keep the whole necklace inside x 434 to 574 and y 360 to 452, ' +
      'do not make a wide shoulder-draped necklace, do not extend to the dress shoulder straps, do not follow a dress neckline, no earrings, no tiara, no text, no watermark',
  },
];

const itemFitV9Candidates = [
  {
    id: 'necklace-tiny-ribbon-stability-fit',
    type: 'necklace',
    filename: 'necklace-tiny-ribbon-stability-fit.png',
    label: 'Necklace: tiny ribbon stability fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped fine gold chain with one tiny pale pink ribbon charm, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
      'small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, do not make a wide shoulder-draped necklace, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'necklace-moon-pearl-stability-fit',
    type: 'necklace',
    filename: 'necklace-moon-pearl-stability-fit.png',
    label: 'Necklace: moon pearl stability fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped pearl chain with one tiny crescent moon charm, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
      'small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, do not make a wide shoulder-draped necklace, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'boots-ribbon-ankle-stability-fit',
    type: 'boots',
    filename: 'boots-ribbon-ankle-stability-fit.png',
    label: 'Boots: ribbon ankle stability fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'narrow boot openings matching a small ankle width, rounded toes that cover the full toes, soft rose pink ankle boots with a tiny ribbon detail on each boot, ' +
      'left boot and right boot are the same size, separated as a matched front-facing pair, not oversized, no text, no watermark',
  },
  {
    id: 'boots-pearl-button-stability-fit',
    type: 'boots',
    filename: 'boots-pearl-button-stability-fit.png',
    label: 'Boots: pearl button stability fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, pure white 1024 by 1536 canvas, ' +
      'narrow boot openings matching a small ankle width, rounded toes that cover the full toes, cream white ankle boots with tiny pearl button details kept very small, ' +
      'left boot and right boot are the same size, separated as a matched front-facing pair, not oversized, no text, no watermark',
  },
];

const itemFitV11Candidates = [
  {
    id: 'hairband-tiny-ribbon-fit',
    type: 'hairAccessory',
    placement: 'headband',
    filename: 'hairband-tiny-ribbon-fit.png',
    label: 'Hair accessory: tiny ribbon headband',
    prompt:
      'single small ribbon headband layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a slim pale pink headband arc with one tiny centered bow, symmetrical and lightweight, suitable for placing across the upper hair of a front-facing paper doll, ' +
      'keep the whole accessory compact, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
  {
    id: 'hairpin-small-flower-fit',
    type: 'hairAccessory',
    placement: 'hairpinRight',
    filename: 'hairpin-small-flower-fit.png',
    label: 'Hair accessory: small flower hairpin',
    prompt:
      'single small flower hairpin layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'one tiny pale pink flower clip with a short simple pin, compact enough to sit on the side of a bob haircut without covering the eye or face, ' +
      'keep the whole accessory small and readable, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
];

const itemFitV16Candidates = [
  {
    id: 'boots-ribbon-flat-cuff-fit',
    type: 'boots',
    filename: 'boots-ribbon-flat-cuff-fit.png',
    label: 'Boots: ribbon flat cuff fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'soft rose pink ankle boots with a tiny ribbon detail on each boot, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
  {
    id: 'boots-pearl-flat-cuff-fit',
    type: 'boots',
    filename: 'boots-pearl-flat-cuff-fit.png',
    label: 'Boots: pearl flat cuff fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'warm cream white ankle boots with very small pearl button details kept subtle, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
];

const itemFitV17Candidates = [
  {
    id: 'hairpin-flower-catalog-fit',
    type: 'hairAccessory',
    placement: 'hairpinRight',
    filename: 'hairpin-flower-catalog-fit.png',
    label: 'Hair accessory: flower clip catalog fit',
    prompt:
      'single small flower hair clip layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'tiny pale yellow and pink flower clip with small leaves, compact and lightweight, suitable for placing on the right side of a front-facing paper doll bob haircut, ' +
      'no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
  {
    id: 'necklace-pearl-catalog-fit',
    type: 'necklace',
    filename: 'necklace-pearl-catalog-fit.png',
    label: 'Necklace: pearl catalog fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped tiny pearl chain with one small round pearl charm, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
      'small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, do not make a wide shoulder-draped necklace, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'top-sailor-catalog-fit',
    type: 'clothing',
    placement: 'top',
    filename: 'top-sailor-catalog-fit.png',
    label: 'Top: sailor collar catalog fit',
    prompt:
      'single modest top clothing layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view top only, no head, no face, no neck, no arms, no hands, no legs, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'pastel blue and white sailor collar blouse with short sleeves, modest round neckline, simple hem at waist, opaque solid fabric, not sheer, no transparent fabric, ' +
      'wide enough to cover both shoulders and the full torso of a front-facing paper doll, short sleeves reach the shoulder edges, body panel is broad and tall enough to cover the base dress bodice, ' +
      'no skirt, no pants, no jewelry, no text, no watermark',
  },
  {
    id: 'top-puff-catalog-fit',
    type: 'clothing',
    placement: 'top',
    filename: 'top-puff-catalog-fit.png',
    label: 'Top: puff sleeve catalog fit',
    prompt:
      'single modest top clothing layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view top only, no head, no face, no neck, no arms, no hands, no legs, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'warm cream blouse with small pink puff sleeves and a tiny bow at the collar, modest neckline, simple hem at waist, opaque solid fabric, not sheer, no transparent fabric, ' +
      'wide enough to cover both shoulders and the full torso of a front-facing paper doll, puff sleeves reach the shoulder edges, body panel is broad and tall enough to cover the base dress bodice, ' +
      'no skirt, no pants, no jewelry, no text, no watermark',
  },
  {
    id: 'bottom-ribbon-catalog-fit',
    type: 'clothing',
    placement: 'bottomLong',
    filename: 'bottom-ribbon-catalog-fit.png',
    label: 'Bottom: ribbon skirt catalog fit',
    prompt:
      'single long bottom skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a modest mint green and pale pink skirt from waist to just below the knees, opaque fabric, not sheer, no transparent tulle, no see-through lace, simple waistband with one small ribbon, gentle vertical folds, ' +
      'vertical silhouette, taller than wide, not a short tutu, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
      'no blouse, no shoes, no text, no watermark',
  },
  {
    id: 'boots-lavender-flat-cuff-catalog-fit',
    type: 'boots',
    filename: 'boots-lavender-flat-cuff-catalog-fit.png',
    label: 'Boots: lavender flat cuff catalog fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'soft lavender ankle boots with tiny star button details kept subtle, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
  {
    id: 'hairpin-round-pearl-catalog-fit',
    type: 'hairAccessory',
    placement: 'hairpinRight',
    filename: 'hairpin-round-pearl-catalog-fit.png',
    label: 'Hair accessory: round pearl clips catalog fit',
    prompt:
      'two tiny round pearl hair clips layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'two separate small cream pearl snap clips placed close together on a short invisible-pin shape, compact and lightweight, suitable for placing on the right side edge of a front-facing paper doll bob haircut, ' +
      'pearls are round and readable but tiny, no long horizontal barrette, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
  {
    id: 'necklace-star-catalog-fit',
    type: 'necklace',
    filename: 'necklace-star-catalog-fit.png',
    label: 'Necklace: star catalog fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped fine gold chain with one tiny pale yellow star charm, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
      'small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, do not make a wide shoulder-draped necklace, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'necklace-flower-catalog-fit',
    type: 'necklace',
    filename: 'necklace-flower-catalog-fit.png',
    label: 'Necklace: flower catalog fit',
    prompt:
      'single small delicate princess necklace layer for a children dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'very narrow symmetrical shallow U-shaped pearl chain with one tiny pale pink flower charm, pendant exactly on the body center line at canvas x 504 y 424, ' +
      'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
      'small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, do not make a wide shoulder-draped necklace, no earrings, no tiara, no text, no watermark',
  },
  {
    id: 'top-lace-collar-catalog-fit',
    type: 'clothing',
    placement: 'top',
    filename: 'top-lace-collar-catalog-fit.png',
    label: 'Top: lace collar catalog fit',
    prompt:
      'single modest top clothing layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view top only, no head, no face, no neck, no arms, no hands, no legs, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'ivory and pale pink blouse with a small lace collar, short sleeves, modest round neckline, simple waist-length hem, opaque solid fabric, not sheer, no transparent fabric, ' +
      'wide enough to cover both shoulders and the full torso of a front-facing paper doll, sleeves reach the shoulder edges, body panel is broad and tall enough to cover the base dress bodice, ' +
      'no skirt, no pants, no jewelry, no text, no watermark',
  },
  {
    id: 'top-ribbon-vest-catalog-fit',
    type: 'clothing',
    placement: 'top',
    filename: 'top-ribbon-vest-catalog-fit.png',
    label: 'Top: ribbon vest catalog fit',
    prompt:
      'single modest top clothing layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view top only, no head, no face, no neck, no arms, no hands, no legs, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'mint green short-sleeve blouse with a pale cream vest panel and one small centered ribbon, modest neckline, simple waist-length hem, opaque solid fabric, not sheer, no transparent fabric, ' +
      'wide enough to cover both shoulders and the full torso of a front-facing paper doll, sleeves reach the shoulder edges, body panel is broad and tall enough to cover the base dress bodice, ' +
      'no skirt, no pants, no jewelry, no text, no watermark',
  },
  {
    id: 'bottom-fluffy-long-catalog-fit',
    type: 'clothing',
    placement: 'bottomLong',
    filename: 'bottom-fluffy-long-catalog-fit.png',
    label: 'Bottom: fluffy long catalog fit',
    prompt:
      'single long bottom skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a soft lavender pink fluffy skirt from waist to just below the knees, opaque fabric, not sheer, no transparent tulle, no see-through lace, simple waistband, gentle A-line volume, small frill details, ' +
      'vertical silhouette, taller than wide, not a short tutu, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
      'no blouse, no shoes, no text, no watermark',
  },
  {
    id: 'bottom-pleated-long-catalog-fit',
    type: 'clothing',
    placement: 'bottomLong',
    filename: 'bottom-pleated-long-catalog-fit.png',
    label: 'Bottom: pleated long catalog fit',
    prompt:
      'single long bottom skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a pale blue pleated skirt from waist to just below the knees, opaque fabric, not sheer, no transparent tulle, no see-through lace, simple waistband, clean vertical pleats, small ribbon at the waist, ' +
      'vertical silhouette, taller than wide, not a short tutu, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
      'no blouse, no shoes, no text, no watermark',
  },
  {
    id: 'boots-rose-flat-cuff-catalog-fit',
    type: 'boots',
    filename: 'boots-rose-flat-cuff-catalog-fit.png',
    label: 'Boots: rose flat cuff catalog fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'rose pink ankle boots with tiny round button details kept subtle, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
  {
    id: 'boots-ankle-ribbon-flat-cuff-catalog-fit',
    type: 'boots',
    filename: 'boots-ankle-ribbon-flat-cuff-catalog-fit.png',
    label: 'Boots: ankle ribbon flat cuff catalog fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'warm cream ankle boots with a tiny ankle ribbon detail on each boot, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
  {
    id: 'boots-blue-ribbon-flat-cuff-catalog-fit',
    type: 'boots',
    filename: 'boots-blue-ribbon-flat-cuff-catalog-fit.png',
    label: 'Boots: blue ribbon flat cuff catalog fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'sky blue ankle boots with tiny pale ribbon details kept subtle, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
  {
    id: 'boots-mint-button-flat-cuff-catalog-fit',
    type: 'boots',
    filename: 'boots-mint-button-flat-cuff-catalog-fit.png',
    label: 'Boots: mint button flat cuff catalog fit',
    prompt:
      'pair of slim short ankle boots only for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'mint green ankle boots with tiny round button details kept subtle, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ' +
      'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
      'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark',
  },
];

const catalogStyle =
  'original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework';

const hairAccessoryPrompt = ({ description, avoid = '' }) =>
  `single small hair accessory layer for a children princess dress-up game, ${catalogStyle}, ` +
  `front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ` +
  `${description}, compact and lightweight enough for a front-facing paper doll bob haircut, keep the whole accessory readable but not oversized, ` +
  `${avoid} no earrings, no necklace, no text, no watermark`;

const necklacePrompt = ({ description }) =>
  `single small delicate princess necklace layer for a children dress-up game, ${catalogStyle}, ` +
  'front view, draw only the necklace and no body, no neck, no skin, no dress, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
  `${description}, pendant exactly on the body center line at canvas x 504 y 424, ` +
  'left chain start near canvas x 452 y 340 and right chain start near canvas x 556 y 340, total visible necklace width between 100 and 125 pixels, ' +
  'very narrow symmetrical shallow U-shaped chain, small enough to sit on the inner shoulder and collarbone line, do not extend to shoulder straps, no earrings, no tiara, no text, no watermark';

const topPrompt = ({ description }) =>
  `single modest top clothing layer for a children princess dress-up game, ${catalogStyle}, ` +
  'front view top only, no head, no face, no neck, no arms, no hands, no legs, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
  `${description}, opaque solid fabric, not sheer, no transparent fabric, modest neckline, simple waist-length hem, ` +
  'wide enough to cover both shoulders and the full torso of a front-facing paper doll, sleeves or cape edges reach the shoulder edges, body panel is broad and tall enough to cover the base dress bodice, ' +
  'no skirt, no pants, no jewelry, no text, no watermark';

const bottomPrompt = ({ description }) =>
  `single long bottom skirt layer for a children princess dress-up game, ${catalogStyle}, ` +
  'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
  `${description}, from waist to just below the knees or lower, opaque fabric, not sheer, no transparent tulle, no see-through lace, ` +
  'vertical silhouette, taller than wide, not a short tutu, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
  'no blouse, no shoes, no text, no watermark';

const bootsPrompt = ({ description }) =>
  `pair of slim short ankle boots only for a children princess dress-up game, ${catalogStyle}, ` +
  'front view boots only, no legs, no feet, no socks, no skin, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
  `${description}, rounded toes that cover the full toes, narrow ankle width, left boot and right boot are the same size and separated as a matched pair, ` +
  'the top of each boot has a flat nearly horizontal cuff edge like a simple cut-off tube, solid boot surface up to the cuff, no visible boot interior, no oval opening, no hole at the top, no dark inside rim, no deep 3D mouth, ' +
  'not oversized, no toe lines, no foot outlines, no skin-colored details, no text, no watermark';

const itemFitV18Candidates = [
  { id: 'hair-tiara-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-tiara-expanded-fit.png', label: 'Hair accessory: tiara expanded fit', prompt: hairAccessoryPrompt({ description: 'tiny gold princess tiara with three small pearl dots, shallow curved base, delicate and not tall', avoid: 'no crown, ' }) },
  { id: 'hair-crown-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-crown-expanded-fit.png', label: 'Hair accessory: crown expanded fit', prompt: hairAccessoryPrompt({ description: 'small rounded gold crown hairband, soft yellow gold with tiny pink jewels, low height and childlike', avoid: 'no large royal crown, ' }) },
  { id: 'hair-big-ribbon-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-big-ribbon-expanded-fit.png', label: 'Hair accessory: big ribbon expanded fit', prompt: hairAccessoryPrompt({ description: 'soft pink bow headband, bow centered near the top, bigger than a clip but still narrow enough for the head', avoid: 'no oversized bow covering the face, ' }) },
  { id: 'hair-double-ribbon-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-double-ribbon-expanded-fit.png', label: 'Hair accessory: double ribbon expanded fit', prompt: hairAccessoryPrompt({ description: 'two tiny lavender bows on a slim invisible headband, symmetrical left and right, playful and simple', avoid: 'no large side bows, ' }) },
  { id: 'hair-star-pin-expanded-fit', type: 'hairAccessory', placement: 'hairpinRight', filename: 'hair-star-pin-expanded-fit.png', label: 'Hair accessory: star pin expanded fit', prompt: hairAccessoryPrompt({ description: 'tiny pale yellow star hairpin with a short simple pin, suitable for the right side of a bob haircut', avoid: 'no moon, ' }) },
  { id: 'hair-heart-pin-expanded-fit', type: 'hairAccessory', placement: 'hairpinRight', filename: 'hair-heart-pin-expanded-fit.png', label: 'Hair accessory: heart pin expanded fit', prompt: hairAccessoryPrompt({ description: 'tiny rose pink heart hairpin with a short simple pin, sweet and compact', avoid: 'no large barrette, ' }) },
  { id: 'hair-strawberry-pin-expanded-fit', type: 'hairAccessory', placement: 'hairpinRight', filename: 'hair-strawberry-pin-expanded-fit.png', label: 'Hair accessory: strawberry pin expanded fit', prompt: hairAccessoryPrompt({ description: 'tiny red strawberry hairpin with two small green leaves and a short simple pin', avoid: 'no food pile, ' }) },
  { id: 'hair-butterfly-pin-expanded-fit', type: 'hairAccessory', placement: 'hairpinRight', filename: 'hair-butterfly-pin-expanded-fit.png', label: 'Hair accessory: butterfly pin expanded fit', prompt: hairAccessoryPrompt({ description: 'tiny lavender and pink butterfly hairpin with a short simple pin, wings rounded and childlike', avoid: 'no realistic insect, ' }) },
  { id: 'hair-bunny-ears-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-bunny-ears-expanded-fit.png', label: 'Hair accessory: bunny ears expanded fit', prompt: hairAccessoryPrompt({ description: 'small white bunny-ear headband with pale pink inner ears, ears short and rounded, cute and non-realistic', avoid: 'no animal face, ' }) },
  { id: 'hair-sparkle-band-expanded-fit', type: 'hairAccessory', placement: 'headband', filename: 'hair-sparkle-band-expanded-fit.png', label: 'Hair accessory: sparkle band expanded fit', prompt: hairAccessoryPrompt({ description: 'slim gold sparkle headband with tiny pastel jewel dots, elegant but simple', avoid: 'no tiara spikes, ' }) },
  { id: 'necklace-sparkle-choker-expanded-fit', type: 'necklace', filename: 'necklace-sparkle-choker-expanded-fit.png', label: 'Necklace: sparkle choker expanded fit', prompt: necklacePrompt({ description: 'a fine pale gold choker-like shallow chain with one tiny pink sparkle jewel charm' }) },
  { id: 'necklace-gem-expanded-fit', type: 'necklace', filename: 'necklace-gem-expanded-fit.png', label: 'Necklace: gem expanded fit', prompt: necklacePrompt({ description: 'a fine gold chain with one tiny lavender oval gemstone charm' }) },
  { id: 'necklace-rainbow-expanded-fit', type: 'necklace', filename: 'necklace-rainbow-expanded-fit.png', label: 'Necklace: rainbow expanded fit', prompt: necklacePrompt({ description: 'a fine chain with one tiny pastel rainbow arc charm in pink, yellow, mint, and blue' }) },
  { id: 'necklace-strawberry-expanded-fit', type: 'necklace', filename: 'necklace-strawberry-expanded-fit.png', label: 'Necklace: strawberry expanded fit', prompt: necklacePrompt({ description: 'a fine pearl chain with one tiny red strawberry charm and two small green leaves' }) },
  { id: 'necklace-sakura-expanded-fit', type: 'necklace', filename: 'necklace-sakura-expanded-fit.png', label: 'Necklace: sakura expanded fit', prompt: necklacePrompt({ description: 'a fine pearl chain with one tiny pale pink sakura blossom charm' }) },
  { id: 'necklace-music-expanded-fit', type: 'necklace', filename: 'necklace-music-expanded-fit.png', label: 'Necklace: music expanded fit', prompt: necklacePrompt({ description: 'a fine gold chain with one tiny sky blue music note charm' }) },
  { id: 'necklace-snow-expanded-fit', type: 'necklace', filename: 'necklace-snow-expanded-fit.png', label: 'Necklace: snow expanded fit', prompt: necklacePrompt({ description: 'a fine silver pearl chain with one tiny pale blue snow crystal charm' }) },
  { id: 'necklace-tea-party-expanded-fit', type: 'necklace', filename: 'necklace-tea-party-expanded-fit.png', label: 'Necklace: tea party expanded fit', prompt: necklacePrompt({ description: 'a fine gold chain with one tiny cream teacup-shaped jewel charm, very simplified' }) },
  { id: 'top-cape-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-cape-expanded-fit.png', label: 'Top: cape expanded fit', prompt: topPrompt({ description: 'pale lavender short capelet top with a small cream collar and tiny front ribbon' }) },
  { id: 'top-heart-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-heart-expanded-fit.png', label: 'Top: heart expanded fit', prompt: topPrompt({ description: 'soft pink blouse with tiny heart pattern and short puff sleeves' }) },
  { id: 'top-star-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-star-expanded-fit.png', label: 'Top: star expanded fit', prompt: topPrompt({ description: 'sky blue blouse with tiny pale yellow stars and short sleeves' }) },
  { id: 'top-flower-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-flower-expanded-fit.png', label: 'Top: flower expanded fit', prompt: topPrompt({ description: 'cream blouse with small pastel flower pattern and short sleeves' }) },
  { id: 'top-strawberry-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-strawberry-expanded-fit.png', label: 'Top: strawberry expanded fit', prompt: topPrompt({ description: 'pale pink blouse with tiny strawberry pattern and rounded sleeves' }) },
  { id: 'top-raincoat-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-raincoat-expanded-fit.png', label: 'Top: raincoat expanded fit', prompt: topPrompt({ description: 'pastel blue childlike raincoat top with simple collar, small buttons, and short rounded sleeves' }) },
  { id: 'top-snow-poncho-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-snow-poncho-expanded-fit.png', label: 'Top: snow poncho expanded fit', prompt: topPrompt({ description: 'pale blue warm poncho top with cream trim and tiny snowflake details' }) },
  { id: 'top-party-jacket-expanded-fit', type: 'clothing', placement: 'top', filename: 'top-party-jacket-expanded-fit.png', label: 'Top: party jacket expanded fit', prompt: topPrompt({ description: 'warm gold and cream short party jacket with small rounded lapels and one tiny bow' }) },
  { id: 'bottom-sparkle-long-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-sparkle-long-expanded-fit.png', label: 'Bottom: sparkle long expanded fit', prompt: bottomPrompt({ description: 'lavender long skirt with tiny pale yellow star sparkles and gentle vertical folds' }) },
  { id: 'bottom-heart-long-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-heart-long-expanded-fit.png', label: 'Bottom: heart long expanded fit', prompt: bottomPrompt({ description: 'rose pink long skirt with tiny heart pattern, simple waistband, gentle A-line shape' }) },
  { id: 'bottom-star-long-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-star-long-expanded-fit.png', label: 'Bottom: star long expanded fit', prompt: bottomPrompt({ description: 'sky blue long skirt with tiny pale yellow stars and clean vertical pleats' }) },
  { id: 'bottom-flower-long-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-flower-long-expanded-fit.png', label: 'Bottom: flower long expanded fit', prompt: bottomPrompt({ description: 'cream and pink long skirt with tiny pastel flower pattern and soft frill hem' }) },
  { id: 'bottom-tea-party-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-tea-party-expanded-fit.png', label: 'Bottom: tea party expanded fit', prompt: bottomPrompt({ description: 'warm cream and gold long tea-party skirt with small ribbon decorations and gentle folds' }) },
  { id: 'bottom-rain-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-rain-expanded-fit.png', label: 'Bottom: rain expanded fit', prompt: bottomPrompt({ description: 'pastel blue long rain skirt with tiny droplet pattern and smooth practical shape' }) },
  { id: 'bottom-fluffy-warm-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-fluffy-warm-expanded-fit.png', label: 'Bottom: fluffy warm expanded fit', prompt: bottomPrompt({ description: 'pale lavender warm fluffy long skirt with cream trim, soft volume but modest width' }) },
  { id: 'bottom-princess-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-princess-expanded-fit.png', label: 'Bottom: princess expanded fit', prompt: bottomPrompt({ description: 'pink princess long skirt with simple layered frills and tiny gold ribbon details' }) },
  { id: 'bottom-ribbon-long-expanded-fit', type: 'clothing', placement: 'bottomLong', filename: 'bottom-ribbon-long-expanded-fit.png', label: 'Bottom: ribbon long expanded fit', prompt: bottomPrompt({ description: 'mint green long skirt with small pink ribbon decorations and a clean waistband' }) },
  { id: 'boots-rain-expanded-fit', type: 'boots', filename: 'boots-rain-expanded-fit.png', label: 'Boots: rain expanded fit', prompt: bootsPrompt({ description: 'pastel yellow rain boots with tiny blue droplet details kept subtle' }) },
  { id: 'boots-star-expanded-fit', type: 'boots', filename: 'boots-star-expanded-fit.png', label: 'Boots: star expanded fit', prompt: bootsPrompt({ description: 'sky blue ankle boots with tiny pale yellow star details kept subtle' }) },
  { id: 'boots-heart-expanded-fit', type: 'boots', filename: 'boots-heart-expanded-fit.png', label: 'Boots: heart expanded fit', prompt: bootsPrompt({ description: 'rose pink ankle boots with tiny heart details kept subtle' }) },
  { id: 'boots-flower-expanded-fit', type: 'boots', filename: 'boots-flower-expanded-fit.png', label: 'Boots: flower expanded fit', prompt: bootsPrompt({ description: 'cream ankle boots with tiny pink flower details kept subtle' }) },
  { id: 'boots-fluffy-expanded-fit', type: 'boots', filename: 'boots-fluffy-expanded-fit.png', label: 'Boots: fluffy expanded fit', prompt: bootsPrompt({ description: 'pale lavender ankle boots with a flat cream fluffy cuff drawn as a solid trim' }) },
  { id: 'boots-snow-expanded-fit', type: 'boots', filename: 'boots-snow-expanded-fit.png', label: 'Boots: snow expanded fit', prompt: bootsPrompt({ description: 'pale blue ankle boots with tiny white snowflake details kept subtle' }) },
  { id: 'boots-strawberry-expanded-fit', type: 'boots', filename: 'boots-strawberry-expanded-fit.png', label: 'Boots: strawberry expanded fit', prompt: bootsPrompt({ description: 'soft pink ankle boots with tiny strawberry details kept subtle' }) },
  { id: 'boots-bunny-expanded-fit', type: 'boots', filename: 'boots-bunny-expanded-fit.png', label: 'Boots: bunny expanded fit', prompt: bootsPrompt({ description: 'cream ankle boots with tiny rounded bunny-ear decorations on the front, very small and flat' }) },
  { id: 'boots-princess-expanded-fit', type: 'boots', filename: 'boots-princess-expanded-fit.png', label: 'Boots: princess expanded fit', prompt: bootsPrompt({ description: 'pale pink princess ankle boots with tiny gold jewel details kept subtle' }) },
  { id: 'boots-sparkle-expanded-fit', type: 'boots', filename: 'boots-sparkle-expanded-fit.png', label: 'Boots: sparkle expanded fit', prompt: bootsPrompt({ description: 'warm gold and cream ankle boots with tiny sparkle dots kept subtle' }) },
];

const itemFitV12Candidates = [
  {
    id: 'hairpin-side-ribbon-stability-fit',
    type: 'hairAccessory',
    placement: 'hairpinRight',
    filename: 'hairpin-side-ribbon-stability-fit.png',
    label: 'Hair accessory: side ribbon hairpin stability fit',
    prompt:
      'single small side ribbon hairpin layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'one compact pale lavender bow hair clip with a very short simple pin, designed to sit on the side edge of a bob haircut without covering the eye or cheek, ' +
      'keep the whole accessory tiny and lightweight, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
  {
    id: 'hairpin-pearl-clips-stability-fit',
    type: 'hairAccessory',
    placement: 'hairpinRight',
    filename: 'hairpin-pearl-clips-stability-fit.png',
    label: 'Hair accessory: pearl clips stability fit',
    prompt:
      'small pearl hair clips layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'two tiny cream pearl snap clips close together, compact enough to sit on the side edge of a bob haircut without covering the eye or face, ' +
      'keep the pearls readable but very small, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
  {
    id: 'headband-slim-lace-stability-fit',
    type: 'hairAccessory',
    placement: 'headband',
    filename: 'headband-slim-lace-stability-fit.png',
    label: 'Hair accessory: slim lace headband stability fit',
    prompt:
      'single slim lace headband layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view accessory only, no head, no hair, no face, no body, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a narrow ivory lace headband arc with very tiny scallop details, symmetrical and lightweight, suitable for placing across the upper hair of a front-facing paper doll, ' +
      'keep the whole accessory compact and thin, no tiara, no crown, no earrings, no necklace, no text, no watermark',
  },
];

const itemFitV13Candidates = [
  {
    id: 'top-frill-blouse-fit',
    type: 'top',
    placement: 'top',
    filename: 'top-frill-blouse-fit.png',
    label: 'Top: simple frill blouse fit',
    prompt:
      'single upper clothing layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view blouse only, no head, no face, no hair, no hands, no legs, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a compact pale pink frill blouse with a clean round neckline, tiny ribbon detail, short puff sleeves kept narrow and close to the torso, waist-length hem, ' +
      'designed to overlay a front-facing paper doll torso without covering the arms too much, no skirt, no full dress, no necklace, no text, no watermark',
  },
  {
    id: 'bottom-fluffy-skirt-fit',
    type: 'bottom',
    placement: 'bottom',
    filename: 'bottom-fluffy-skirt-fit.png',
    label: 'Bottom: fluffy skirt fit',
    prompt:
      'single skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a soft lavender pink knee-length fluffy skirt with a simple waistband, gentle A-line volume, small frill details, centered and symmetrical, ' +
      'designed to overlay a front-facing paper doll waist and hide the base dress skirt cleanly, no blouse, no shoes, no text, no watermark',
  },
  {
    id: 'dress-overlay-pastel-fit',
    type: 'dressOverlay',
    placement: 'dressOverlay',
    filename: 'dress-overlay-pastel-fit.png',
    label: 'Dress overlay: pastel one-piece fit',
    prompt:
      'single one-piece dress overlay layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view dress only, no head, no face, no hair, no hands, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a pale mint and pink princess one-piece dress with a clean round neckline, narrow shoulder straps, fitted bodice, soft knee-length skirt, centered and symmetrical, ' +
      'designed to overlay a front-facing paper doll from shoulders to skirt hem without covering arms, no necklace, no shoes, no text, no watermark',
  },
];

const itemFitV14Candidates = [
  {
    id: 'bottom-knee-a-line-fit',
    type: 'bottom',
    placement: 'bottomLong',
    filename: 'bottom-knee-a-line-fit.png',
    label: 'Bottom: knee-length A-line skirt fit',
    prompt:
      'single skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a modest pastel pink A-line skirt from waist to knee length, opaque fabric, not sheer, no transparent tulle, simple waistband, small child-friendly frill near the hem, ' +
      'vertical silhouette, taller than wide, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
      'no blouse, no shoes, no text, no watermark',
  },
  {
    id: 'bottom-long-frill-skirt-fit',
    type: 'bottom',
    placement: 'bottomLong',
    filename: 'bottom-long-frill-skirt-fit.png',
    label: 'Bottom: long frill skirt fit',
    prompt:
      'single long skirt layer for a children princess dress-up game, original pastel storybook encyclopedia illustration matching a soft Japanese picture-book fashion encyclopedia, soft watercolor-like coloring, clean fine linework, ' +
      'front view skirt only, no torso, no body, no legs, no feet, no mannequin, no shadow, pure white 1024 by 1536 canvas, ' +
      'a modest lavender and cream skirt from waist to just below the knees, opaque fabric, not sheer, no transparent tulle, no see-through lace, simple waistband, gentle vertical folds, small frill hem, ' +
      'vertical silhouette, taller than wide, not a short tutu, centered and symmetrical, designed to overlay a front-facing paper doll waist and cover the base dress hem completely, ' +
      'no blouse, no shoes, no text, no watermark',
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
  for (const marker of [
    'model-candidates/',
    'style-candidates/',
    'selected-style/',
    'selected/',
    'item-fit-v17-game-catalog/',
    'item-fit-v16-flat-cuff-boots/',
    'necklace-anchor-audit/',
    'item-fit-v15-layer-stack/',
    'item-fit-v14-long-bottom/',
    'item-fit-v13-clothing/',
    'item-fit-v12-hair-accessory-stability/',
    'item-fit-v11-hair-accessory/',
    'item-fit-v10-boots-alpha/',
    'item-fit-v9-accessory-stability/',
    'item-fit-v8-necklace-reanchor/',
    'shoulder-line-audit/',
    'item-fit-v7-necklace/',
    'item-fit-v6-shoulder-necklace/',
    'anchor-audit/',
    'item-fit-v5-measured/',
    'item-fit-v4/',
    'item-fit-v3/',
    'item-fit-v2/',
    'item-fit/',
  ]) {
    const index = normalized.indexOf(marker);
    if (index >= 0) return normalized.slice(index);
  }
  return normalized;
};

const toItemFitRelative = (path) => {
  if (!path) return null;
  return relative(ITEM_FIT_DIR, fromOutputRelative(toRelative(path))).replaceAll('\\', '/');
};

const toDirectoryRelative = (directory, path) => {
  if (!path) return null;
  return relative(directory, fromOutputRelative(toRelative(path))).replaceAll('\\', '/');
};

const readManifest = () => (existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : null);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const fromOutputRelative = (path) => resolve(OUTPUT_DIR, path);

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

const alphaBounds = (png, minimumAlpha = 8) => {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[pixelOffset(png, x, y) + 3] <= minimumAlpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const alphaBoundsInRect = (png, rect, minimumAlpha = 8) => {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = Math.max(0, rect.y); y < Math.min(png.height, rect.y + rect.height); y += 1) {
    for (let x = Math.max(0, rect.x); x < Math.min(png.width, rect.x + rect.width); x += 1) {
      if (png.data[pixelOffset(png, x, y) + 3] <= minimumAlpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const transparentPng = (width, height) => new PNG({ width, height, colorType: 6 });

const whitePng = (width, height) => {
  const png = transparentPng(width, height);
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = 255;
    png.data[offset + 1] = 255;
    png.data[offset + 2] = 255;
    png.data[offset + 3] = 255;
  }
  return png;
};

const cropPng = (png, rect) => {
  const out = transparentPng(rect.width, rect.height);
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const srcX = rect.x + x;
      const srcY = rect.y + y;
      if (srcX < 0 || srcY < 0 || srcX >= png.width || srcY >= png.height) continue;
      png.data.copy(out.data, pixelOffset(out, x, y), pixelOffset(png, srcX, srcY), pixelOffset(png, srcX, srcY) + 4);
    }
  }
  return out;
};

const pastePng = (dest, src, destX, destY) => {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const x2 = destX + x;
      const y2 = destY + y;
      if (x2 < 0 || y2 < 0 || x2 >= dest.width || y2 >= dest.height) continue;
      const sourceOffset = pixelOffset(src, x, y);
      const destOffset = pixelOffset(dest, x2, y2);
      const sourceAlpha = src.data[sourceOffset + 3] / 255;
      if (sourceAlpha <= 0) continue;
      const destAlpha = dest.data[destOffset + 3] / 255;
      const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
      for (let channel = 0; channel < 3; channel += 1) {
        const source = src.data[sourceOffset + channel];
        const target = dest.data[destOffset + channel];
        dest.data[destOffset + channel] = outAlpha === 0 ? 0 : Math.round((source * sourceAlpha + target * destAlpha * (1 - sourceAlpha)) / outAlpha);
      }
      dest.data[destOffset + 3] = Math.round(outAlpha * 255);
    }
  }
};

const fillRect = (png, rect, rgba) => {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(png.width, rect.x + rect.width);
  const y1 = Math.min(png.height, rect.y + rect.height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = pixelOffset(png, x, y);
      png.data[offset] = rgba[0];
      png.data[offset + 1] = rgba[1];
      png.data[offset + 2] = rgba[2];
      png.data[offset + 3] = rgba[3];
    }
  }
};

const drawContain = (dest, src, rect, { maxScale = 1, alignY = 0.5 } = {}) => {
  const scale = Math.min(rect.width / src.width, rect.height / src.height, maxScale);
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const x0 = Math.round(rect.x + (rect.width - width) / 2);
  const y0 = Math.round(rect.y + (rect.height - height) * alignY);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(src.width - 1, Math.floor(x / scale));
      const srcY = Math.min(src.height - 1, Math.floor(y / scale));
      const sourceOffset = pixelOffset(src, srcX, srcY);
      const alpha = src.data[sourceOffset + 3];
      if (alpha <= 0) continue;
      const x2 = x0 + x;
      const y2 = y0 + y;
      if (x2 < 0 || y2 < 0 || x2 >= dest.width || y2 >= dest.height) continue;
      src.data.copy(dest.data, pixelOffset(dest, x2, y2), sourceOffset, sourceOffset + 4);
    }
  }

  return { x: x0, y: y0, width, height };
};

const normalizeToSlot = ({ sourcePath, outputPath, rect, canvas, maxScale = 1, alignY = 0.5 }) => {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const bounds = alphaBounds(source);
  if (!bounds) throw new Error(`No non-transparent pixels found in ${sourcePath}`);
  const cropped = cropPng(source, bounds);
  const out = transparentPng(canvas.width, canvas.height);
  const placedRect = drawContain(out, cropped, rect, { maxScale, alignY });
  writeFileSync(outputPath, PNG.sync.write(out));
  return { sourceBounds: bounds, placedRect };
};

const expandRectWithinCanvas = (rect, canvas, { left = 0, right = 0, top = 0, bottom = 0 } = {}) => {
  const x = Math.max(0, rect.x - left);
  const y = Math.max(0, rect.y - top);
  const x2 = Math.min(canvas.width, rect.x + rect.width + right);
  const y2 = Math.min(canvas.height, rect.y + rect.height + bottom);
  return { x, y, width: x2 - x, height: y2 - y };
};

const clothingTargetRect = ({ placement, rect, canvas }) => {
  if (placement === 'bottomLong') return expandRectWithinCanvas(rect, canvas, { left: 25, right: 25, top: 8, bottom: 0 });
  if (placement !== 'top') return rect;
  return expandRectWithinCanvas(rect, canvas, { left: 30, right: 30, top: 12, bottom: 18 });
};

const normalizeToSlotStretch = ({ sourcePath, outputPath, rect, canvas, widthRatio = 0.85, heightRatio = 1, alignY = 1 }) => {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const bounds = alphaBounds(source);
  if (!bounds) throw new Error(`No non-transparent pixels found in ${sourcePath}`);
  const cropped = cropPng(source, bounds);
  const out = transparentPng(canvas.width, canvas.height);
  const width = Math.max(1, Math.round(rect.width * widthRatio));
  const height = Math.max(1, Math.round(rect.height * heightRatio));
  const x0 = Math.round(rect.x + (rect.width - width) / 2);
  const y0 = Math.round(rect.y + (rect.height - height) * alignY);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(cropped.width - 1, Math.floor((x / width) * cropped.width));
      const srcY = Math.min(cropped.height - 1, Math.floor((y / height) * cropped.height));
      const sourceOffset = pixelOffset(cropped, srcX, srcY);
      if (cropped.data[sourceOffset + 3] <= 0) continue;
      cropped.data.copy(out.data, pixelOffset(out, x0 + x, y0 + y), sourceOffset, sourceOffset + 4);
    }
  }

  writeFileSync(outputPath, PNG.sync.write(out));
  return { sourceBounds: bounds, placedRect: { x: x0, y: y0, width, height } };
};

const splitShoeCutout = ({ sourcePath, leftPath, rightPath }) => {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const bounds = alphaBounds(source);
  if (!bounds) throw new Error(`No non-transparent shoe pixels found in ${sourcePath}`);
  const midX = bounds.x + Math.round(bounds.width / 2);
  const leftRect = { x: bounds.x, y: bounds.y, width: Math.max(1, midX - bounds.x), height: bounds.height };
  const rightRect = { x: midX, y: bounds.y, width: Math.max(1, bounds.x + bounds.width - midX), height: bounds.height };
  writeFileSync(leftPath, PNG.sync.write(cropPng(source, leftRect)));
  writeFileSync(rightPath, PNG.sync.write(cropPng(source, rightRect)));
  return { sourceBounds: bounds, splitX: midX, leftRect, rightRect };
};

const reinforceOpaqueInterior = ({ path, minimumAlpha = 8, opaqueAlpha = 245, fillAlpha = 235 }) => {
  const png = PNG.sync.read(readFileSync(path));
  const bounds = alphaBounds(png, minimumAlpha);
  if (!bounds) throw new Error(`No non-transparent pixels found in ${path}`);
  const before = { semiTransparent: 0, transparentInterior: 0, nonTransparent: 0 };
  const after = { semiTransparent: 0, transparentInterior: 0, nonTransparent: 0 };
  let alphaRaised = 0;
  let holesFilled = 0;

  const neighborStats = (x, y) => {
    let count = 0;
    const rgb = [0, 0, 0];
    for (let yy = y - 1; yy <= y + 1; yy += 1) {
      for (let xx = x - 1; xx <= x + 1; xx += 1) {
        if (xx === x && yy === y) continue;
        if (xx < 0 || yy < 0 || xx >= png.width || yy >= png.height) continue;
        const offset = pixelOffset(png, xx, yy);
        if (png.data[offset + 3] <= minimumAlpha) continue;
        count += 1;
        rgb[0] += png.data[offset];
        rgb[1] += png.data[offset + 1];
        rgb[2] += png.data[offset + 2];
      }
    }
    return { count, rgb: count ? rgb.map((value) => Math.round(value / count)) : [255, 255, 255] };
  };

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const offset = pixelOffset(png, x, y);
      const alpha = png.data[offset + 3];
      const neighbors = neighborStats(x, y);
      const isInterior = neighbors.count >= 7;
      if (alpha > minimumAlpha) {
        before.nonTransparent += 1;
        if (alpha < opaqueAlpha) before.semiTransparent += 1;
        if (isInterior && alpha < opaqueAlpha) {
          png.data[offset + 3] = opaqueAlpha;
          alphaRaised += 1;
        }
      } else if (isInterior) {
        before.transparentInterior += 1;
        png.data[offset] = neighbors.rgb[0];
        png.data[offset + 1] = neighbors.rgb[1];
        png.data[offset + 2] = neighbors.rgb[2];
        png.data[offset + 3] = fillAlpha;
        holesFilled += 1;
      }
    }
  }

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      const alpha = png.data[pixelOffset(png, x, y) + 3];
      if (alpha > minimumAlpha) {
        after.nonTransparent += 1;
        if (alpha < opaqueAlpha) after.semiTransparent += 1;
      } else if (neighborStats(x, y).count >= 7) {
        after.transparentInterior += 1;
      }
    }
  }

  writeFileSync(path, PNG.sync.write(png));
  return { bounds, before, after, alphaRaised, holesFilled };
};

const compositePngs = ({ basePath, layerPaths, outputPath, canvas }) => {
  const out = whitePng(canvas.width, canvas.height);
  pastePng(out, PNG.sync.read(readFileSync(basePath)), 0, 0);
  for (const layerPath of layerPaths) {
    pastePng(out, PNG.sync.read(readFileSync(layerPath)), 0, 0);
  }
  writeFileSync(outputPath, PNG.sync.write(out));
};

const compositePngsWithMask = ({ basePath, maskRects, layerPaths, outputPath, canvas }) => {
  const out = whitePng(canvas.width, canvas.height);
  pastePng(out, PNG.sync.read(readFileSync(basePath)), 0, 0);
  for (const rect of maskRects) {
    fillRect(out, rect, [255, 255, 255, 255]);
  }
  for (const layerPath of layerPaths) {
    pastePng(out, PNG.sync.read(readFileSync(layerPath)), 0, 0);
  }
  writeFileSync(outputPath, PNG.sync.write(out));
};

const rowAlphaBounds = (png, y, minX = 0, maxX = png.width - 1, minimumAlpha = 8) => {
  let left = null;
  let right = null;
  for (let x = Math.max(0, minX); x <= Math.min(png.width - 1, maxX); x += 1) {
    if (png.data[pixelOffset(png, x, y) + 3] <= minimumAlpha) continue;
    if (left === null) left = x;
    right = x;
  }
  if (left === null) return null;
  return { y, left, right, center: (left + right) / 2, width: right - left + 1 };
};

const median = (values) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const roundPoint = (point) => ({ x: Math.round(point.x), y: Math.round(point.y) });

const roundRect = (rect) => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
});

const measureStyleModel = ({ selectedStyle }) => {
  const basePath = fromOutputRelative(selectedStyle.selectedCutout);
  const png = PNG.sync.read(readFileSync(basePath));
  const neckRows = [];
  for (let y = 350; y <= 440; y += 10) {
    const bounds = rowAlphaBounds(png, y, 300, 720, 8);
    if (bounds) neckRows.push(bounds);
  }
  const bodyCenterX = Math.round(median(neckRows.map((row) => row.center)));

  const footRows = (minX, maxX) => {
    const rows = [];
    for (let y = 1320; y <= 1455; y += 15) {
      const bounds = rowAlphaBounds(png, y, minX, maxX, 8);
      if (bounds) rows.push(bounds);
    }
    return rows;
  };
  const leftFootRows = footRows(380, 510);
  const rightFootRows = footRows(510, 650);
  const footMetrics = (rows) => {
    const widest = rows.reduce((best, row) => (!best || row.width > best.width ? row : best), null);
    const ankle = rows.find((row) => row.y >= 1335) || rows[0];
    const toe = widest || rows.at(-1);
    const bounds = {
      x: Math.min(...rows.map((row) => row.left)),
      y: Math.min(...rows.map((row) => row.y)),
      width: Math.max(...rows.map((row) => row.right)) - Math.min(...rows.map((row) => row.left)) + 1,
      height: Math.max(...rows.map((row) => row.y)) - Math.min(...rows.map((row) => row.y)) + 1,
    };
    return {
      bounds,
      ankleCenter: { x: ankle.center, y: ankle.y },
      toeCenter: { x: toe.center, y: toe.y },
      rows,
    };
  };

  const leftFoot = footMetrics(leftFootRows);
  const rightFoot = footMetrics(rightFootRows);
  const necklaceRect = {
    x: bodyCenterX - 88,
    y: 386,
    width: 176,
    height: 78,
  };
  const bootWidth = 92;
  const bootHeight = 148;
  const bootYOffset = 38;
  const bootRects = {
    leftShoe: {
      x: Math.round(leftFoot.toeCenter.x - bootWidth / 2),
      y: Math.round(leftFoot.toeCenter.y - bootHeight + bootYOffset),
      width: bootWidth,
      height: bootHeight,
    },
    rightShoe: {
      x: Math.round(rightFoot.toeCenter.x - bootWidth / 2),
      y: Math.round(rightFoot.toeCenter.y - bootHeight + bootYOffset),
      width: bootWidth,
      height: bootHeight,
    },
  };

  return {
    selectedStyleCandidateId: selectedStyle.selectedStyleCandidateId,
    baseCutout: selectedStyle.selectedCutout,
    measuredAt: new Date().toISOString(),
    method: 'alpha row scan over selected-style/model-base.png',
    manualAnchors: selectedStyle.anchors,
    manualSlotRects: selectedStyle.slotRects,
    bodyCenterX,
    neckContourRows: neckRows.map((row) => ({ ...row, center: Number(row.center.toFixed(1)) })),
    necklaceRect: roundRect(necklaceRect),
    feet: {
      imageLeft: {
        bounds: roundRect(leftFoot.bounds),
        ankleCenter: roundPoint(leftFoot.ankleCenter),
        toeCenter: roundPoint(leftFoot.toeCenter),
        rows: leftFoot.rows.map((row) => ({ ...row, center: Number(row.center.toFixed(1)) })),
      },
      imageRight: {
        bounds: roundRect(rightFoot.bounds),
        ankleCenter: roundPoint(rightFoot.ankleCenter),
        toeCenter: roundPoint(rightFoot.toeCenter),
        rows: rightFoot.rows.map((row) => ({ ...row, center: Number(row.center.toFixed(1)) })),
      },
    },
    bootRects: {
      leftShoe: roundRect(bootRects.leftShoe),
      rightShoe: roundRect(bootRects.rightShoe),
    },
    deltasFromManual: {
      bodyCenterX: bodyCenterX - selectedStyle.anchors.neckCenter.x,
      imageLeftToeX: Math.round(leftFoot.toeCenter.x - selectedStyle.anchors.toeLeft.x),
      imageRightToeX: Math.round(rightFoot.toeCenter.x - selectedStyle.anchors.toeRight.x),
      rightBootRectXFromV4: Math.round(bootRects.rightShoe.x - BOOT_V4_RECTS.rightShoe.x),
    },
  };
};

const firstAlphaYAtX = (png, x, minY, maxY, minimumAlpha = 8) => {
  for (let y = Math.max(0, minY); y <= Math.min(png.height - 1, maxY); y += 1) {
    if (png.data[pixelOffset(png, x, y) + 3] > minimumAlpha) return y;
  }
  return null;
};

const measureShoulderLine = ({ selectedStyle, measuredStyle }) => {
  const basePath = fromOutputRelative(selectedStyle.selectedCutout);
  const png = PNG.sync.read(readFileSync(basePath));
  const bodyCenterX = measuredStyle?.bodyCenterX || measureStyleModel({ selectedStyle }).bodyCenterX;
  const halfWidth = 104;
  const leftX = bodyCenterX - halfWidth;
  const rightX = bodyCenterX + halfWidth;
  const leftSurfaceY = firstAlphaYAtX(png, leftX, 330, 460, 8);
  const rightSurfaceY = firstAlphaYAtX(png, rightX, 330, 460, 8);
  const leftY = leftSurfaceY === null ? 374 : leftSurfaceY + 24;
  const rightY = rightSurfaceY === null ? 374 : rightSurfaceY + 24;
  const anchorY = Math.round(median([leftY, rightY]));
  const shoulderRows = [];
  for (let y = 360; y <= 430; y += 10) {
    const bounds = rowAlphaBounds(png, y, 300, 720, 8);
    if (bounds) shoulderRows.push(bounds);
  }
  const necklaceShoulderRect = {
    x: bodyCenterX - 120,
    y: anchorY - 12,
    width: 240,
    height: 118,
  };

  return {
    selectedStyleCandidateId: selectedStyle.selectedStyleCandidateId,
    baseCutout: selectedStyle.selectedCutout,
    measuredAt: new Date().toISOString(),
    method:
      'alpha top-boundary scan on selected-style/model-base.png; necklace endpoints target the shoulder/body surface, not the dress neckline',
    bodyCenterX,
    shoulderLine: {
      left: { x: leftX, y: anchorY },
      center: { x: bodyCenterX, y: anchorY + 34 },
      right: { x: rightX, y: anchorY },
      sourceTopY: {
        left: leftSurfaceY,
        right: rightSurfaceY,
      },
      width: rightX - leftX,
    },
    shoulderContourRows: shoulderRows.map((row) => ({ ...row, center: Number(row.center.toFixed(1)) })),
    necklaceShoulderRect: roundRect(necklaceShoulderRect),
    preferredSourceAsset: toRelative(resolve(ITEM_FIT_V3_CUTOUT_DIR, 'necklace-shoulder-aligned-fit.png')),
    comparison: {
      previousV5NecklaceRect: measuredStyle?.necklaceRect || null,
      intent: 'place the chain from the shoulder/body line and keep the pendant centered on the measured body axis',
    },
  };
};

const detectNecklaceStartAnchors = (png, minimumAlpha = 8) => {
  const bounds = alphaBounds(png, minimumAlpha);
  if (!bounds) throw new Error('No non-transparent necklace pixels found');
  const cropped = cropPng(png, bounds);
  const midX = cropped.width / 2;
  const pick = (side) => {
    let best = null;
    for (let y = 0; y < cropped.height; y += 1) {
      for (let x = 0; x < cropped.width; x += 1) {
        const isSide = side === 'left' ? x < midX : x >= midX;
        if (!isSide || cropped.data[pixelOffset(cropped, x, y) + 3] <= minimumAlpha) continue;
        if (
          !best ||
          y < best.y ||
          (y === best.y && (side === 'left' ? x < best.x : x > best.x))
        ) {
          best = { x, y };
        }
      }
    }
    if (!best) throw new Error(`No ${side} necklace start anchor found`);
    return best;
  };
  return {
    bounds,
    croppedSize: { width: cropped.width, height: cropped.height },
    leftStart: pick('left'),
    rightStart: pick('right'),
  };
};

const scalePastePng = (dest, src, rect) => {
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const srcX = Math.min(src.width - 1, Math.floor((x / rect.width) * src.width));
      const srcY = Math.min(src.height - 1, Math.floor((y / rect.height) * src.height));
      const sourceOffset = pixelOffset(src, srcX, srcY);
      if (src.data[sourceOffset + 3] <= 0) continue;
      const x2 = rect.x + x;
      const y2 = rect.y + y;
      if (x2 < 0 || y2 < 0 || x2 >= dest.width || y2 >= dest.height) continue;
      src.data.copy(dest.data, pixelOffset(dest, x2, y2), sourceOffset, sourceOffset + 4);
    }
  }
};

const normalizeNecklaceToStartAnchors = ({ sourcePath, outputPath, targetAnchors, canvas }) => {
  const source = PNG.sync.read(readFileSync(sourcePath));
  const sourceAnchors = detectNecklaceStartAnchors(source);
  const cropped = cropPng(source, sourceAnchors.bounds);
  const sourceDistance = sourceAnchors.rightStart.x - sourceAnchors.leftStart.x;
  const targetDistance = targetAnchors.rightStart.x - targetAnchors.leftStart.x;
  if (sourceDistance <= 0 || targetDistance <= 0) throw new Error('Invalid necklace anchor distance');
  const scale = targetDistance / sourceDistance;
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));
  const x = Math.round(targetAnchors.leftStart.x - sourceAnchors.leftStart.x * scale);
  const leftY = targetAnchors.leftStart.y - sourceAnchors.leftStart.y * scale;
  const rightY = targetAnchors.rightStart.y - sourceAnchors.rightStart.y * scale;
  const y = Math.round((leftY + rightY) / 2);
  const out = transparentPng(canvas.width, canvas.height);
  const placedRect = { x, y, width, height };
  scalePastePng(out, cropped, placedRect);
  writeFileSync(outputPath, PNG.sync.write(out));
  return {
    sourceBounds: sourceAnchors.bounds,
    sourceAnchors,
    targetAnchors,
    scale: Number(scale.toFixed(4)),
    placedRect,
    placedAnchors: {
      leftStart: roundPoint({ x: x + sourceAnchors.leftStart.x * scale, y: y + sourceAnchors.leftStart.y * scale }),
      rightStart: roundPoint({ x: x + sourceAnchors.rightStart.x * scale, y: y + sourceAnchors.rightStart.y * scale }),
    },
  };
};

const measureNecklaceAnchors = ({ selectedStyle }) => {
  const base = PNG.sync.read(readFileSync(fromOutputRelative(selectedStyle.selectedCutout)));
  const bodyCenterX = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH).bodyCenterX : measureStyleModel({ selectedStyle }).bodyCenterX;
  const targetX = {
    leftStart: bodyCenterX - 52,
    rightStart: bodyCenterX + 52,
  };
  const baseTop = {
    leftStart: firstAlphaYAtX(base, targetX.leftStart, 320, 460, 8),
    rightStart: firstAlphaYAtX(base, targetX.rightStart, 320, 460, 8),
  };
  const targetY = Math.round(median([baseTop.leftStart, baseTop.rightStart]) + 1.5);
  const targetAnchors = {
    leftStart: { x: targetX.leftStart, y: targetY },
    rightStart: { x: targetX.rightStart, y: targetY },
  };
  const v7CutoutPath = resolve(ITEM_FIT_V7_CUTOUT_DIR, 'necklace-inner-shoulder-line-fit.png');
  const v7NormalizedPath = resolve(ITEM_FIT_V7_NORMALIZED_DIR, 'necklace-inner-shoulder-line-fit.png');
  if (!existsSync(v7CutoutPath)) throw new Error(`v7 necklace cutout is missing: ${v7CutoutPath}`);
  const cutoutAnchors = detectNecklaceStartAnchors(PNG.sync.read(readFileSync(v7CutoutPath)));
  const normalizedAnchors = existsSync(v7NormalizedPath) ? detectNecklaceStartAnchors(PNG.sync.read(readFileSync(v7NormalizedPath))) : null;
  const normalizedAbsoluteAnchors = normalizedAnchors
    ? {
        leftStart: {
          x: normalizedAnchors.bounds.x + normalizedAnchors.leftStart.x,
          y: normalizedAnchors.bounds.y + normalizedAnchors.leftStart.y,
        },
        rightStart: {
          x: normalizedAnchors.bounds.x + normalizedAnchors.rightStart.x,
          y: normalizedAnchors.bounds.y + normalizedAnchors.rightStart.y,
        },
      }
    : null;

  return {
    selectedStyleCandidateId: selectedStyle.selectedStyleCandidateId,
    measuredAt: new Date().toISOString(),
    method: 'base alpha top-boundary plus necklace cutout alpha start anchors',
    bodyCenterX,
    baseTopBoundaryAtTargetX: baseTop,
    targetAnchors,
    v7Cutout: {
      path: toRelative(v7CutoutPath),
      sourceBounds: cutoutAnchors.bounds,
      sourceAnchorsWithinBounds: {
        leftStart: cutoutAnchors.leftStart,
        rightStart: cutoutAnchors.rightStart,
      },
      croppedSize: cutoutAnchors.croppedSize,
    },
    v7Normalized: normalizedAbsoluteAnchors
      ? {
          path: toRelative(v7NormalizedPath),
          anchors: normalizedAbsoluteAnchors,
          deltasFromTarget: {
            leftStartY: normalizedAbsoluteAnchors.leftStart.y - targetAnchors.leftStart.y,
            rightStartY: normalizedAbsoluteAnchors.rightStart.y - targetAnchors.rightStart.y,
          },
        }
      : null,
  };
};

const measureHairAccessoryAnchors = ({ selectedStyle }) => {
  const base = PNG.sync.read(readFileSync(fromOutputRelative(selectedStyle.selectedCutout)));
  const headBounds = alphaBoundsInRect(base, { x: 250, y: 40, width: 520, height: 330 }, 8);
  if (!headBounds) throw new Error('Could not measure head bounds');
  const centerX = Math.round(headBounds.x + headBounds.width / 2);
  const headbandRect = roundRect({
    x: centerX - 122,
    y: headBounds.y + 28,
    width: 244,
    height: 118,
  });
  const hairpinRightRect = roundRect({
    x: headBounds.x + headBounds.width - 58,
    y: headBounds.y + 136,
    width: 58,
    height: 62,
  });
  return {
    selectedStyleCandidateId: selectedStyle.selectedStyleCandidateId,
    measuredAt: new Date().toISOString(),
    method: 'alpha bounds scan over the head and upper hair region of selected-style/model-base.png',
    headBounds: roundRect(headBounds),
    headCenter: { x: centerX, y: Math.round(headBounds.y + headBounds.height / 2) },
    targetRects: {
      headband: headbandRect,
      hairpinRight: hairpinRightRect,
    },
  };
};

const measureHairAccessoryStabilityAnchors = ({ selectedStyle }) => {
  const measured = measureHairAccessoryAnchors({ selectedStyle });
  return {
    ...measured,
    measuredAt: new Date().toISOString(),
    method: `${measured.method}; v12 uses a smaller outward hairpinRight target for mixed hairpin designs`,
    targetRects: {
      ...measured.targetRects,
      hairpinRight: roundRect({
        x: measured.headBounds.x + measured.headBounds.width - 48,
        y: measured.headBounds.y + 142,
        width: 48,
        height: 52,
      }),
    },
  };
};

const measureClothingAnchors = ({ selectedStyle }) => {
  const base = PNG.sync.read(readFileSync(fromOutputRelative(selectedStyle.selectedCutout)));
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  const bodyCenterX = measuredStyle.bodyCenterX;
  const upperBodyBounds = alphaBoundsInRect(base, { x: bodyCenterX - 190, y: 330, width: 380, height: 330 }, 8);
  const skirtBounds = alphaBoundsInRect(base, { x: bodyCenterX - 260, y: 545, width: 520, height: 360 }, 8);
  if (!upperBodyBounds) throw new Error('Could not measure upper body bounds');
  if (!skirtBounds) throw new Error('Could not measure skirt bounds');
  const topRect = roundRect({
    x: bodyCenterX - 145,
    y: Math.max(330, upperBodyBounds.y - 6),
    width: 290,
    height: 270,
  });
  const bottomRect = roundRect({
    x: bodyCenterX - 205,
    y: Math.max(535, skirtBounds.y - 10),
    width: 410,
    height: 380,
  });
  const dressOverlayRect = roundRect({
    x: bodyCenterX - 205,
    y: topRect.y,
    width: 410,
    height: bottomRect.y + bottomRect.height - topRect.y,
  });
  return {
    selectedStyleCandidateId: selectedStyle.selectedStyleCandidateId,
    measuredAt: new Date().toISOString(),
    method: 'bodyCenterX plus alpha bounds scan over upper body and base dress skirt',
    bodyCenterX,
    upperBodyBounds: roundRect(upperBodyBounds),
    skirtBounds: roundRect(skirtBounds),
    targetRects: {
      top: topRect,
      bottom: bottomRect,
      dressOverlay: dressOverlayRect,
    },
  };
};

const measureLongBottomAnchors = ({ selectedStyle }) => {
  const measured = measureClothingAnchors({ selectedStyle });
  return {
    ...measured,
    measuredAt: new Date().toISOString(),
    method: `${measured.method}; v14 extends bottom target for opaque knee-length skirts`,
    targetRects: {
      bottomLong: roundRect({
        x: measured.bodyCenterX - 190,
        y: Math.max(520, measured.skirtBounds.y - 25),
        width: 380,
        height: 500,
      }),
    },
  };
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

const renderItemFitPreview = ({ selectedStyle, items }) => {
  const basePath = toItemFitRelative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const composite = item.compositePath
        ? `<figure><figcaption>Composite</figcaption><img src="${toItemFitRelative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${toItemFitRelative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Cutout</figcaption><img src="${toItemFitRelative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>${normalized}${composite}</div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`
      }<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f7fafc; }
      main { width:min(1280px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .error strong { border-color:#ffd7d3; color:var(--error); }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:460px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1100px) { .comparison { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:680px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT VALIDATION</p>
        <h1>style-d high-risk item fit</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Necklace and shoes are generated first, then normalized into the selected anchor slots.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitReview = ({ selectedStyle, items }) => {
  const rows = items
    .map((item) => {
      const normalized = item.normalizedPaths.map((path) => `[${path.label}](${path.path})`).join('<br>');
      return `| ${item.label} | [raw](${item.rawPath || ''}) | [cutout](${item.cutoutPath || ''}) | ${normalized} | [composite](${item.compositePath || ''}) | ${item.status} |`;
    })
    .join('\n');
  const notes = items
    .map(
      (item) => `### ${item.label}

- Type: \`${item.type}\`
- Slot check:
  - Fit:
  - Size:
  - Layering:
  - Alpha edge:
  - Production risk:
- Source bounds: \`${JSON.stringify(item.sourceBounds || null)}\`
- Placed rects: \`${JSON.stringify(item.placedRects || null)}\`
- Prompt: ${item.revisedPrompt || item.prompt}
`,
    )
    .join('\n');

  return `# Dressup Item Fit Review

- Model: \`${MODEL}\`
- Size: \`${SIZE}\`
- Quality: \`${QUALITY}\`
- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Base cutout: \`${selectedStyle.selectedCutout}\`

| Item | Raw | Cutout | Normalized | Composite | Status |
| --- | --- | --- | --- | --- | --- |
${rows}

${notes}`;
};

const processItemFitResult = ({ result, selectedStyle }) => {
  if (result.status !== 'ok') return { ...result, normalizedPaths: [], compositePath: null };

  const canvas = selectedStyle.canvas;
  const slotRects = selectedStyle.slotRects;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'necklace') {
    const normalizedPath = resolve(ITEM_FIT_NORMALIZED_DIR, result.filename);
    const placement = normalizeToSlot({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      rect: slotRects.necklace,
      canvas,
      maxScale: 1,
      alignY: 0.5,
    });
    const compositePath = resolve(ITEM_FIT_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      placedRects: { necklace: placement.placedRect },
      normalizedPaths: [{ label: 'Normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'shoes') {
    const leftSplitPath = resolve(ITEM_FIT_SPLIT_DIR, `${result.id}-left.png`);
    const rightSplitPath = resolve(ITEM_FIT_SPLIT_DIR, `${result.id}-right.png`);
    const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
    const leftNormalizedPath = resolve(ITEM_FIT_NORMALIZED_DIR, `${result.id}-left.png`);
    const rightNormalizedPath = resolve(ITEM_FIT_NORMALIZED_DIR, `${result.id}-right.png`);
    const leftPlacement = normalizeToSlot({
      sourcePath: leftSplitPath,
      outputPath: leftNormalizedPath,
      rect: slotRects.leftShoe,
      canvas,
      maxScale: 1,
      alignY: 0.68,
    });
    const rightPlacement = normalizeToSlot({
      sourcePath: rightSplitPath,
      outputPath: rightNormalizedPath,
      rect: slotRects.rightShoe,
      canvas,
      maxScale: 1,
      alignY: 0.68,
    });
    const compositePath = resolve(ITEM_FIT_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [leftNormalizedPath, rightNormalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: split.sourceBounds,
      splitX: split.splitX,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      normalizedPaths: [
        { label: 'Left normalized', path: toRelative(leftNormalizedPath) },
        { label: 'Right normalized', path: toRelative(rightNormalizedPath) },
      ],
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPaths: [], compositePath: null };
};

const runItemFitBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const itemResults = await runBatch({
    allCandidates: itemFitCandidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitCandidates || [],
    rawDir: ITEM_FIT_RAW_DIR,
    cutoutDir: ITEM_FIT_CUTOUT_DIR,
    label: 'item fit candidates',
  });
  const processed = itemResults.map((item) => processItemFitResult({ result: item, selectedStyle }));

  writeManifest({
    ...previousManifest,
    itemFitDir: ITEM_FIT_DIR,
    itemFitCandidates: processed,
    itemFitSelectedStyle: selectedStyle.selectedStyleCandidateId,
  });
  writeFileSync(ITEM_FIT_PREVIEW_PATH, renderItemFitPreview({ selectedStyle, items: processed }));
  writeFileSync(ITEM_FIT_REVIEW_PATH, renderItemFitReview({ selectedStyle, items: processed }));
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit preview: ${ITEM_FIT_PREVIEW_PATH}`);
  console.log(`item fit review: ${ITEM_FIT_REVIEW_PATH}`);
};

const FOOTWEAR_PATCH_MASK_RECT = { x: 382, y: 1298, width: 280, height: 205 };

const renderItemFitV2Preview = ({ selectedStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V2_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const composite = item.compositePath
        ? `<figure><figcaption>${item.type === 'footwearPatch' ? 'Masked composite' : 'Composite'}</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>${normalized}${composite}</div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`
      }<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V2 Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#7c3aed; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1280px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #ddd6fe; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:460px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1100px) { .comparison { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:680px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V2 VALIDATION</p>
        <h1>style-d symmetric necklace and footwear patch</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Footwear uses a replacement patch: mask ${escapeHtml(JSON.stringify(FOOTWEAR_PATCH_MASK_RECT))}, then composite.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV2GeneratedReview = ({ selectedStyle, items }) => {
  const rows = items
    .map((item) => {
      const normalized = item.normalizedPaths.map((path) => `[${path.label}](${path.path})`).join('<br>');
      return `| ${item.label} | [raw](${item.rawPath || ''}) | [cutout](${item.cutoutPath || ''}) | ${normalized} | [composite](${item.compositePath || ''}) | ${item.status} |`;
    })
    .join('\n');
  const notes = items
    .map(
      (item) => `### ${item.label}

- Type: \`${item.type}\`
- Source bounds: \`${JSON.stringify(item.sourceBounds || null)}\`
- Placed rects: \`${JSON.stringify(item.placedRects || null)}\`
- Mask rects: \`${JSON.stringify(item.maskRects || [])}\`
- Prompt: ${item.revisedPrompt || item.prompt}
`,
    )
    .join('\n');

  return `# Dressup Item Fit V2 Generated Review

- Model: \`${MODEL}\`
- Size: \`${SIZE}\`
- Quality: \`${QUALITY}\`
- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Base cutout: \`${selectedStyle.selectedCutout}\`

| Item | Raw | Cutout | Normalized | Composite | Status |
| --- | --- | --- | --- | --- | --- |
${rows}

${notes}`;
};

const renderItemFitV2ManualReview = ({ selectedStyle, items }) => `# Dressup Item Fit V2 Manual Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Preview: \`item-fit-v2-preview.html\`

## Necklace

- Symmetry:
- Center alignment:
- Neckline fit:
- Alpha edge:
- Verdict:

## Footwear patch

- Left foot fit:
- Right foot fit:
- Base foot hidden correctly:
- Ankle connection:
- Patch size:
- Verdict:

## Next action

${items.map((item) => `- ${item.label}:`).join('\n')}
`;

const processItemFitV2Result = ({ result, selectedStyle }) => {
  if (result.status !== 'ok') return { ...result, normalizedPaths: [], compositePath: null };

  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'necklace') {
    const normalizedPath = resolve(ITEM_FIT_V2_NORMALIZED_DIR, result.filename);
    const placement = normalizeToSlot({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      rect: selectedStyle.slotRects.necklace,
      canvas,
      maxScale: 1,
      alignY: 0.5,
    });
    const compositePath = resolve(ITEM_FIT_V2_MASKED_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      placedRects: { necklace: placement.placedRect },
      normalizedPaths: [{ label: 'Normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'footwearPatch') {
    const normalizedPath = resolve(ITEM_FIT_V2_NORMALIZED_DIR, result.filename);
    const placement = normalizeToSlot({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      rect: FOOTWEAR_PATCH_MASK_RECT,
      canvas,
      maxScale: 1,
      alignY: 1,
    });
    const compositePath = resolve(ITEM_FIT_V2_MASKED_COMPOSITE_DIR, `${result.id}-masked-composite.png`);
    compositePngsWithMask({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      maskRects: [FOOTWEAR_PATCH_MASK_RECT],
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      placedRects: { footwearPatch: placement.placedRect },
      maskRects: [FOOTWEAR_PATCH_MASK_RECT],
      normalizedPaths: [{ label: 'Footwear patch normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPaths: [], compositePath: null };
};

const runItemFitV2Batch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const itemResults = await runBatch({
    allCandidates: itemFitV2Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV2Candidates || [],
    rawDir: ITEM_FIT_V2_RAW_DIR,
    cutoutDir: ITEM_FIT_V2_CUTOUT_DIR,
    label: 'item fit v2 candidates',
  });
  const processed = itemResults.map((item) => processItemFitV2Result({ result: item, selectedStyle }));

  writeManifest({
    ...previousManifest,
    itemFitV2Dir: ITEM_FIT_V2_DIR,
    itemFitV2Candidates: processed,
    itemFitV2SelectedStyle: selectedStyle.selectedStyleCandidateId,
    footwearPatchMaskRect: FOOTWEAR_PATCH_MASK_RECT,
  });
  writeFileSync(ITEM_FIT_V2_PREVIEW_PATH, renderItemFitV2Preview({ selectedStyle, items: processed }));
  writeFileSync(ITEM_FIT_V2_GENERATED_REVIEW_PATH, renderItemFitV2GeneratedReview({ selectedStyle, items: processed }));
  if (!existsSync(ITEM_FIT_V2_REVIEW_PATH) && processed.some((item) => item.status === 'ok')) {
    writeFileSync(ITEM_FIT_V2_REVIEW_PATH, renderItemFitV2ManualReview({ selectedStyle, items: processed }));
  }
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v2 preview: ${ITEM_FIT_V2_PREVIEW_PATH}`);
  console.log(`item fit v2 generated review: ${ITEM_FIT_V2_GENERATED_REVIEW_PATH}`);
  console.log(`item fit v2 manual review: ${ITEM_FIT_V2_REVIEW_PATH}`);
};

const renderItemFitV3Preview = ({ selectedStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V3_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const split = (item.splitPaths || [])
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const composite = item.compositePath
        ? `<figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>${split}${normalized}${composite}</div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`
      }<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V3 Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V3 VALIDATION</p>
        <h1>centered necklace and high coverage boots overlay</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Boots are overlaid without masking the base feet.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV3GeneratedReview = ({ selectedStyle, items }) => {
  const rows = items
    .map((item) => {
      const normalized = item.normalizedPaths.map((path) => `[${path.label}](${path.path})`).join('<br>');
      return `| ${item.label} | [raw](${item.rawPath || ''}) | [cutout](${item.cutoutPath || ''}) | ${normalized} | [composite](${item.compositePath || ''}) | ${item.status} |`;
    })
    .join('\n');
  const notes = items
    .map(
      (item) => `### ${item.label}

- Type: \`${item.type}\`
- Source bounds: \`${JSON.stringify(item.sourceBounds || null)}\`
- Placed rects: \`${JSON.stringify(item.placedRects || null)}\`
- Prompt: ${item.revisedPrompt || item.prompt}
`,
    )
    .join('\n');

  return `# Dressup Item Fit V3 Generated Review

- Model: \`${MODEL}\`
- Size: \`${SIZE}\`
- Quality: \`${QUALITY}\`
- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Base cutout: \`${selectedStyle.selectedCutout}\`

| Item | Raw | Cutout | Normalized | Composite | Status |
| --- | --- | --- | --- | --- | --- |
${rows}

${notes}`;
};

const renderItemFitV3ManualReview = ({ selectedStyle, items }) => `# Dressup Item Fit V3 Manual Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Preview: \`item-fit-v3-preview.html\`

## Necklace

- Center alignment:
- Shoulder/neckline fit:
- Symmetry:
- Alpha edge:
- Verdict:

## Boots overlay

- Left boot fit:
- Right boot fit:
- Base toes hidden by overlay:
- No leg/skin contamination:
- Overlay-only viability:
- Verdict:

## Next action

${items.map((item) => `- ${item.label}:`).join('\n')}
`;

const processItemFitV3Result = ({ result, selectedStyle }) => {
  if (result.status !== 'ok') return { ...result, normalizedPaths: [], compositePath: null };

  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'necklace') {
    const normalizedPath = resolve(ITEM_FIT_V3_NORMALIZED_DIR, result.filename);
    const placement = normalizeToSlot({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      rect: selectedStyle.slotRects.necklace,
      canvas,
      maxScale: 1,
      alignY: 0.42,
    });
    const compositePath = resolve(ITEM_FIT_V3_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      placedRects: { necklace: placement.placedRect },
      normalizedPaths: [{ label: 'Normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'boots') {
    const leftSplitPath = resolve(ITEM_FIT_V3_SPLIT_DIR, `${result.id}-left.png`);
    const rightSplitPath = resolve(ITEM_FIT_V3_SPLIT_DIR, `${result.id}-right.png`);
    const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
    const leftNormalizedPath = resolve(ITEM_FIT_V3_NORMALIZED_DIR, `${result.id}-left.png`);
    const rightNormalizedPath = resolve(ITEM_FIT_V3_NORMALIZED_DIR, `${result.id}-right.png`);
    const leftPlacement = normalizeToSlotStretch({
      sourcePath: leftSplitPath,
      outputPath: leftNormalizedPath,
      rect: selectedStyle.slotRects.leftShoe,
      canvas,
      widthRatio: 0.9,
      heightRatio: 1,
      alignY: 1,
    });
    const rightPlacement = normalizeToSlotStretch({
      sourcePath: rightSplitPath,
      outputPath: rightNormalizedPath,
      rect: selectedStyle.slotRects.rightShoe,
      canvas,
      widthRatio: 0.9,
      heightRatio: 1,
      alignY: 1,
    });
    const compositePath = resolve(ITEM_FIT_V3_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [leftNormalizedPath, rightNormalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: split.sourceBounds,
      splitX: split.splitX,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      normalizedPaths: [
        { label: 'Left normalized', path: toRelative(leftNormalizedPath) },
        { label: 'Right normalized', path: toRelative(rightNormalizedPath) },
      ],
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPaths: [], compositePath: null };
};

const runItemFitV3Batch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const itemResults = await runBatch({
    allCandidates: itemFitV3Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV3Candidates || [],
    rawDir: ITEM_FIT_V3_RAW_DIR,
    cutoutDir: ITEM_FIT_V3_CUTOUT_DIR,
    label: 'item fit v3 candidates',
  });
  const processed = itemResults.map((item) => processItemFitV3Result({ result: item, selectedStyle }));

  writeManifest({
    ...previousManifest,
    itemFitV3Dir: ITEM_FIT_V3_DIR,
    itemFitV3Candidates: processed,
    itemFitV3SelectedStyle: selectedStyle.selectedStyleCandidateId,
  });
  writeFileSync(ITEM_FIT_V3_PREVIEW_PATH, renderItemFitV3Preview({ selectedStyle, items: processed }));
  writeFileSync(ITEM_FIT_V3_GENERATED_REVIEW_PATH, renderItemFitV3GeneratedReview({ selectedStyle, items: processed }));
  if (!existsSync(ITEM_FIT_V3_REVIEW_PATH) && processed.some((item) => item.status === 'ok')) {
    writeFileSync(ITEM_FIT_V3_REVIEW_PATH, renderItemFitV3ManualReview({ selectedStyle, items: processed }));
  }
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v3 preview: ${ITEM_FIT_V3_PREVIEW_PATH}`);
  console.log(`item fit v3 generated review: ${ITEM_FIT_V3_GENERATED_REVIEW_PATH}`);
  console.log(`item fit v3 manual review: ${ITEM_FIT_V3_REVIEW_PATH}`);
};

const NECKLACE_V4_RECT = { x: 424, y: 370, width: 176, height: 86 };
const NECKLACE_V7_RECT = { x: 434, y: 360, width: 140, height: 92 };
const NECKLACE_V8_TARGET_ANCHORS = {
  leftStart: { x: 452, y: 340 },
  rightStart: { x: 556, y: 340 },
};
const BOOT_V4_RECTS = {
  leftShoe: { x: 410, y: 1330, width: 92, height: 148 },
  rightShoe: { x: 522, y: 1330, width: 92, height: 148 },
};

const renderItemFitV4Preview = ({ selectedStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V4_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const split = (item.splitPaths || [])
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const composite = item.compositePath
        ? `<figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>${split}${normalized}${composite}</div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`
      }<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V4 Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V4 VALIDATION</p>
        <h1>short necklace and ankle-scale boots overlay</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Boots use fixed smaller fit rects: ${escapeHtml(JSON.stringify(BOOT_V4_RECTS))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV4GeneratedReview = ({ selectedStyle, items }) => {
  const rows = items
    .map((item) => {
      const normalized = item.normalizedPaths.map((path) => `[${path.label}](${path.path})`).join('<br>');
      return `| ${item.label} | [raw](${item.rawPath || ''}) | [cutout](${item.cutoutPath || ''}) | ${normalized} | [composite](${item.compositePath || ''}) | ${item.status} |`;
    })
    .join('\n');
  const notes = items
    .map(
      (item) => `### ${item.label}

- Type: \`${item.type}\`
- Source bounds: \`${JSON.stringify(item.sourceBounds || null)}\`
- Placed rects: \`${JSON.stringify(item.placedRects || null)}\`
- Prompt: ${item.revisedPrompt || item.prompt}
`,
    )
    .join('\n');

  return `# Dressup Item Fit V4 Generated Review

- Model: \`${MODEL}\`
- Size: \`${SIZE}\`
- Quality: \`${QUALITY}\`
- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Base cutout: \`${selectedStyle.selectedCutout}\`

| Item | Raw | Cutout | Normalized | Composite | Status |
| --- | --- | --- | --- | --- | --- |
${rows}

${notes}`;
};

const renderItemFitV4ManualReview = ({ selectedStyle, items }) => `# Dressup Item Fit V4 Manual Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Preview: \`item-fit-v4-preview.html\`

## Necklace

- Center alignment:
- Neckline-only fit:
- Shoulder strap avoidance:
- Symmetry:
- Verdict:

## Boots overlay

- Left boot scale:
- Right boot scale:
- Ankle width fit:
- Toe coverage:
- Overlay-only viability:
- Verdict:

## Next action

${items.map((item) => `- ${item.label}:`).join('\n')}
`;

const processItemFitV4Result = ({ result, selectedStyle }) => {
  if (result.status !== 'ok') return { ...result, normalizedPaths: [], compositePath: null };

  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'necklace') {
    const normalizedPath = resolve(ITEM_FIT_V4_NORMALIZED_DIR, result.filename);
    const placement = normalizeToSlot({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      rect: NECKLACE_V4_RECT,
      canvas,
      maxScale: 1,
      alignY: 0.5,
    });
    const compositePath = resolve(ITEM_FIT_V4_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      placedRects: { necklace: placement.placedRect },
      normalizedPaths: [{ label: 'Normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'boots') {
    const leftSplitPath = resolve(ITEM_FIT_V4_SPLIT_DIR, `${result.id}-left.png`);
    const rightSplitPath = resolve(ITEM_FIT_V4_SPLIT_DIR, `${result.id}-right.png`);
    const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
    const leftNormalizedPath = resolve(ITEM_FIT_V4_NORMALIZED_DIR, `${result.id}-left.png`);
    const rightNormalizedPath = resolve(ITEM_FIT_V4_NORMALIZED_DIR, `${result.id}-right.png`);
    const leftPlacement = normalizeToSlotStretch({
      sourcePath: leftSplitPath,
      outputPath: leftNormalizedPath,
      rect: BOOT_V4_RECTS.leftShoe,
      canvas,
      widthRatio: 1,
      heightRatio: 1,
      alignY: 1,
    });
    const rightPlacement = normalizeToSlotStretch({
      sourcePath: rightSplitPath,
      outputPath: rightNormalizedPath,
      rect: BOOT_V4_RECTS.rightShoe,
      canvas,
      widthRatio: 1,
      heightRatio: 1,
      alignY: 1,
    });
    const compositePath = resolve(ITEM_FIT_V4_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [leftNormalizedPath, rightNormalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: split.sourceBounds,
      splitX: split.splitX,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      normalizedPaths: [
        { label: 'Left normalized', path: toRelative(leftNormalizedPath) },
        { label: 'Right normalized', path: toRelative(rightNormalizedPath) },
      ],
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPaths: [], compositePath: null };
};

const runItemFitV4Batch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const itemResults = await runBatch({
    allCandidates: itemFitV4Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV4Candidates || [],
    rawDir: ITEM_FIT_V4_RAW_DIR,
    cutoutDir: ITEM_FIT_V4_CUTOUT_DIR,
    label: 'item fit v4 candidates',
  });
  const processed = itemResults.map((item) => processItemFitV4Result({ result: item, selectedStyle }));

  writeManifest({
    ...previousManifest,
    itemFitV4Dir: ITEM_FIT_V4_DIR,
    itemFitV4Candidates: processed,
    itemFitV4SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV4Rects: { necklace: NECKLACE_V4_RECT, boots: BOOT_V4_RECTS },
  });
  writeFileSync(ITEM_FIT_V4_PREVIEW_PATH, renderItemFitV4Preview({ selectedStyle, items: processed }));
  writeFileSync(ITEM_FIT_V4_GENERATED_REVIEW_PATH, renderItemFitV4GeneratedReview({ selectedStyle, items: processed }));
  if (!existsSync(ITEM_FIT_V4_REVIEW_PATH) && processed.some((item) => item.status === 'ok')) {
    writeFileSync(ITEM_FIT_V4_REVIEW_PATH, renderItemFitV4ManualReview({ selectedStyle, items: processed }));
  }
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v4 preview: ${ITEM_FIT_V4_PREVIEW_PATH}`);
  console.log(`item fit v4 generated review: ${ITEM_FIT_V4_GENERATED_REVIEW_PATH}`);
  console.log(`item fit v4 manual review: ${ITEM_FIT_V4_REVIEW_PATH}`);
};

const renderAnchorAuditPreview = ({ selectedStyle, measured }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Anchor Audit</title>
    <style>
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:#142235; background:#f8fafc; }
      main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:0 0 8px; font-size:30px; }
      p { color:#64758a; line-height:1.7; }
      .grid { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
      .panel { border:1px solid #d8e2ec; border-radius:8px; background:#fff; padding:16px; }
      img { width:100%; display:block; object-fit:contain; max-height:720px; }
      pre { overflow:auto; margin:0; white-space:pre-wrap; font-size:13px; line-height:1.55; }
      @media (max-width:860px) { .grid { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Anchor audit: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}</h1>
      <p>Measured from alpha row scans. Existing manual anchors are retained for comparison.</p>
      <div class="grid">
        <section class="panel"><img src="../${escapeHtml(selectedStyle.selectedCutout)}" alt="selected style base" /></section>
        <section class="panel"><pre>${escapeHtml(JSON.stringify(measured, null, 2))}</pre></section>
      </div>
    </main>
  </body>
</html>`;

const renderAnchorAuditReview = ({ measured }) => `# Dressup Anchor Audit Review

- Base: \`${measured.selectedStyleCandidateId}\`
- Method: ${measured.method}

## Findings

- Body center X: measured \`${measured.bodyCenterX}\`, manual neck center X \`${measured.manualAnchors.neckCenter.x}\`, delta \`${measured.deltasFromManual.bodyCenterX}\`.
- Image-left toe X: measured \`${measured.feet.imageLeft.toeCenter.x}\`, manual \`${measured.manualAnchors.toeLeft.x}\`, delta \`${measured.deltasFromManual.imageLeftToeX}\`.
- Image-right toe X: measured \`${measured.feet.imageRight.toeCenter.x}\`, manual \`${measured.manualAnchors.toeRight.x}\`, delta \`${measured.deltasFromManual.imageRightToeX}\`.
- V5 necklace rect: \`${JSON.stringify(measured.necklaceRect)}\`
- V5 boot rects: \`${JSON.stringify(measured.bootRects)}\`

## Interpretation

- The manual center anchors are close but not exact for the selected style model.
- The right-side boot placement should use measured foot center instead of the older manual toe value.
- v5 should validate placement using existing v4 assets before spending more image-generation calls.
`;

const runAnchorAuditBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureStyleModel({ selectedStyle });
  writeFileSync(ANCHOR_AUDIT_JSON_PATH, JSON.stringify(measured, null, 2));
  writeFileSync(ANCHOR_AUDIT_PREVIEW_PATH, renderAnchorAuditPreview({ selectedStyle, measured }));
  writeFileSync(ANCHOR_AUDIT_REVIEW_PATH, renderAnchorAuditReview({ measured }));
  writeManifest({
    ...previousManifest,
    anchorAuditDir: ANCHOR_AUDIT_DIR,
    measuredStyleModel: toRelative(ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`anchor audit json: ${ANCHOR_AUDIT_JSON_PATH}`);
  console.log(`anchor audit preview: ${ANCHOR_AUDIT_PREVIEW_PATH}`);
  console.log(`anchor audit review: ${ANCHOR_AUDIT_REVIEW_PATH}`);
};

const renderShoulderLineAuditPreview = ({ selectedStyle, shoulderMeasured }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Shoulder Line Audit</title>
    <style>
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:#142235; background:#f8fafc; }
      main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:0 0 8px; font-size:30px; }
      p { color:#64758a; line-height:1.7; }
      .grid { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
      .panel { border:1px solid #d8e2ec; border-radius:8px; background:#fff; padding:16px; }
      img { width:100%; display:block; object-fit:contain; max-height:720px; }
      pre { overflow:auto; margin:0; white-space:pre-wrap; font-size:13px; line-height:1.55; }
      @media (max-width:860px) { .grid { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Shoulder line audit: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}</h1>
      <p>Measured shoulder/body surface for necklace placement. This intentionally avoids the dress neckline anchor used by v5.</p>
      <div class="grid">
        <section class="panel"><img src="../${escapeHtml(selectedStyle.selectedCutout)}" alt="selected style base" /></section>
        <section class="panel"><pre>${escapeHtml(JSON.stringify(shoulderMeasured, null, 2))}</pre></section>
      </div>
    </main>
  </body>
</html>`;

const renderShoulderLineAuditReview = ({ shoulderMeasured }) => `# Dressup Shoulder Line Audit Review

- Base: \`${shoulderMeasured.selectedStyleCandidateId}\`
- Method: ${shoulderMeasured.method}
- Body center X: \`${shoulderMeasured.bodyCenterX}\`
- Shoulder line: \`${JSON.stringify(shoulderMeasured.shoulderLine)}\`
- Necklace shoulder rect: \`${JSON.stringify(shoulderMeasured.necklaceShoulderRect)}\`

## Interpretation

- v5 used a short collarbone necklace and visually read as attached to the dress neckline.
- This audit places necklace endpoints from the model shoulder/body surface and keeps the pendant on the measured body center.
- The first v6 pass should reuse the existing wider v3 necklace cutout before spending another image-generation call.
`;

const runShoulderLineAuditBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  if (!existsSync(ANCHOR_AUDIT_JSON_PATH)) {
    writeFileSync(ANCHOR_AUDIT_JSON_PATH, JSON.stringify(measuredStyle, null, 2));
  }
  const shoulderMeasured = measureShoulderLine({ selectedStyle, measuredStyle });
  writeFileSync(SHOULDER_LINE_AUDIT_JSON_PATH, JSON.stringify(shoulderMeasured, null, 2));
  writeFileSync(SHOULDER_LINE_AUDIT_PREVIEW_PATH, renderShoulderLineAuditPreview({ selectedStyle, shoulderMeasured }));
  writeFileSync(SHOULDER_LINE_AUDIT_REVIEW_PATH, renderShoulderLineAuditReview({ shoulderMeasured }));
  writeManifest({
    ...previousManifest,
    shoulderLineAuditDir: SHOULDER_LINE_AUDIT_DIR,
    measuredShoulderLine: toRelative(SHOULDER_LINE_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`shoulder line audit json: ${SHOULDER_LINE_AUDIT_JSON_PATH}`);
  console.log(`shoulder line audit preview: ${SHOULDER_LINE_AUDIT_PREVIEW_PATH}`);
  console.log(`shoulder line audit review: ${SHOULDER_LINE_AUDIT_REVIEW_PATH}`);
};

const renderItemFitV5Preview = ({ selectedStyle, measured, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V5_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const split = (item.splitPaths || [])
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const composite = item.compositePath
        ? `<figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      return `<article class="card"><header><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></header><div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Source</figcaption><img src="${relative(item.sourcePath)}" alt="${escapeHtml(`${item.label} source`)}" /></figure>${split}${normalized}${composite}</div></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V5 Measured Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta { margin:0 0 18px; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { margin-bottom:14px; }
      header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      .comparison { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Measured-anchor v5 placement</h1>
      <p class="meta">bodyCenterX=${escapeHtml(measured.bodyCenterX)}, necklace=${escapeHtml(JSON.stringify(measured.necklaceRect))}, boots=${escapeHtml(JSON.stringify(measured.bootRects))}</p>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV5Review = ({ measured, items }) => `# Dressup Item Fit V5 Measured Review

- Base: \`${measured.selectedStyleCandidateId}\`
- Source: existing v4 cutouts; no image generation.
- Measured body center X: \`${measured.bodyCenterX}\`
- Necklace rect: \`${JSON.stringify(measured.necklaceRect)}\`
- Boot rects: \`${JSON.stringify(measured.bootRects)}\`

## Placement Results

${items.map((item) => `- ${item.label}: \`${JSON.stringify(item.placedRects)}\``).join('\n')}

## Review

- Necklace center:
- Necklace neckline fit:
- Image-right boot fit:
- Overall improvement from v4:
`;

const runItemFitV5MeasuredBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  if (!existsSync(ANCHOR_AUDIT_JSON_PATH)) {
    writeFileSync(ANCHOR_AUDIT_JSON_PATH, JSON.stringify(measured, null, 2));
  }

  const necklaceSourcePath = resolve(ITEM_FIT_V4_CUTOUT_DIR, 'necklace-short-collarbone-fit.png');
  const bootsSourcePath = resolve(ITEM_FIT_V4_CUTOUT_DIR, 'boots-ankle-scale-fit.png');
  for (const path of [necklaceSourcePath, bootsSourcePath]) {
    if (!existsSync(path)) throw new Error(`v4 source asset is missing: ${path}`);
  }

  const canvas = selectedStyle.canvas;
  const necklaceNormalizedPath = resolve(ITEM_FIT_V5_NORMALIZED_DIR, 'necklace-short-collarbone-fit-measured.png');
  const necklacePlacement = normalizeToSlot({
    sourcePath: necklaceSourcePath,
    outputPath: necklaceNormalizedPath,
    rect: measured.necklaceRect,
    canvas,
    maxScale: 1,
    alignY: 0.5,
  });
  const necklaceCompositePath = resolve(ITEM_FIT_V5_COMPOSITE_DIR, 'necklace-short-collarbone-fit-measured-composite.png');
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [necklaceNormalizedPath],
    outputPath: necklaceCompositePath,
    canvas,
  });

  const leftSplitPath = resolve(ITEM_FIT_V5_SPLIT_DIR, 'boots-ankle-scale-fit-left.png');
  const rightSplitPath = resolve(ITEM_FIT_V5_SPLIT_DIR, 'boots-ankle-scale-fit-right.png');
  const split = splitShoeCutout({ sourcePath: bootsSourcePath, leftPath: leftSplitPath, rightPath: rightSplitPath });
  const leftBootNormalizedPath = resolve(ITEM_FIT_V5_NORMALIZED_DIR, 'boots-ankle-scale-fit-left-measured.png');
  const rightBootNormalizedPath = resolve(ITEM_FIT_V5_NORMALIZED_DIR, 'boots-ankle-scale-fit-right-measured.png');
  const leftPlacement = normalizeToSlotStretch({
    sourcePath: leftSplitPath,
    outputPath: leftBootNormalizedPath,
    rect: measured.bootRects.leftShoe,
    canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const rightPlacement = normalizeToSlotStretch({
    sourcePath: rightSplitPath,
    outputPath: rightBootNormalizedPath,
    rect: measured.bootRects.rightShoe,
    canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const bootsCompositePath = resolve(ITEM_FIT_V5_COMPOSITE_DIR, 'boots-ankle-scale-fit-measured-composite.png');
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [leftBootNormalizedPath, rightBootNormalizedPath],
    outputPath: bootsCompositePath,
    canvas,
  });

  const items = [
    {
      type: 'necklace',
      label: 'Necklace: v4 cutout measured placement',
      sourcePath: toRelative(necklaceSourcePath),
      sourceBounds: necklacePlacement.sourceBounds,
      placedRects: { necklace: necklacePlacement.placedRect },
      normalizedPaths: [{ label: 'Measured normalized', path: toRelative(necklaceNormalizedPath) }],
      compositePath: toRelative(necklaceCompositePath),
    },
    {
      type: 'boots',
      label: 'Boots: v4 cutout measured placement',
      sourcePath: toRelative(bootsSourcePath),
      sourceBounds: split.sourceBounds,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      normalizedPaths: [
        { label: 'Left measured normalized', path: toRelative(leftBootNormalizedPath) },
        { label: 'Right measured normalized', path: toRelative(rightBootNormalizedPath) },
      ],
      compositePath: toRelative(bootsCompositePath),
    },
  ];

  writeFileSync(ITEM_FIT_V5_PREVIEW_PATH, renderItemFitV5Preview({ selectedStyle, measured, items }));
  if (!existsSync(ITEM_FIT_V5_REVIEW_PATH)) {
    writeFileSync(ITEM_FIT_V5_REVIEW_PATH, renderItemFitV5Review({ measured, items }));
  }
  writeManifest({
    ...previousManifest,
    itemFitV5Dir: ITEM_FIT_V5_DIR,
    itemFitV5Candidates: items,
    itemFitV5MeasuredStyleModel: toRelative(ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v5 preview: ${ITEM_FIT_V5_PREVIEW_PATH}`);
  console.log(`item fit v5 review: ${ITEM_FIT_V5_REVIEW_PATH}`);
};

const renderItemFitV6Preview = ({ selectedStyle, shoulderMeasured, item }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V6_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V6 Shoulder Necklace Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta { margin:0 0 18px; color:var(--muted); line-height:1.7; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { margin-bottom:14px; }
      header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      .comparison { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:560px; object-fit:contain; display:block; }
      @media (max-width:980px) { .comparison { grid-template-columns:repeat(2,minmax(0,1fr)); } img { height:420px; } }
      @media (max-width:620px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>V6 shoulder-line necklace placement</h1>
      <p class="meta">bodyCenterX=${escapeHtml(shoulderMeasured.bodyCenterX)}, shoulderLine=${escapeHtml(JSON.stringify(shoulderMeasured.shoulderLine))}, necklace=${escapeHtml(JSON.stringify(shoulderMeasured.necklaceShoulderRect))}</p>
      <article class="card">
        <header><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></header>
        <div class="comparison">
          <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
          <figure><figcaption>Source</figcaption><img src="${relative(item.sourcePath)}" alt="source necklace" /></figure>
          <figure><figcaption>Shoulder-line normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="normalized necklace" /></figure>
          <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="composite necklace" /></figure>
        </div>
      </article>
    </main>
  </body>
</html>`;
};

const renderItemFitV6Review = ({ shoulderMeasured, item }) => `# Dressup Item Fit V6 Shoulder Necklace Review

- Base: \`${shoulderMeasured.selectedStyleCandidateId}\`
- Source: existing v3 shoulder-aligned necklace cutout; no image generation.
- Body center X: \`${shoulderMeasured.bodyCenterX}\`
- Shoulder line: \`${JSON.stringify(shoulderMeasured.shoulderLine)}\`
- Necklace rect: \`${JSON.stringify(shoulderMeasured.necklaceShoulderRect)}\`
- Placement: \`${JSON.stringify(item.placedRect)}\`

## Review

- Centering: PASS. Pendant area is placed on the measured body center X, not the older hand-entered X.
- Shoulder-line intent: PARTIAL PASS. The necklace is wider and higher than v5, so it no longer reads as a short chain glued to the dress neckline. The exact chain curve still comes from the existing v3 asset, so a final production pass should generate a fresh necklace against the base reference if this local placement is visually close but not final.
- Shoes: unchanged from v5. The measured boot placement remains the current baseline.
`;

const runItemFitV6ShoulderNecklaceBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  const shoulderMeasured = existsSync(SHOULDER_LINE_AUDIT_JSON_PATH)
    ? readJson(SHOULDER_LINE_AUDIT_JSON_PATH)
    : measureShoulderLine({ selectedStyle, measuredStyle });
  if (!existsSync(SHOULDER_LINE_AUDIT_JSON_PATH)) {
    writeFileSync(SHOULDER_LINE_AUDIT_JSON_PATH, JSON.stringify(shoulderMeasured, null, 2));
  }

  const necklaceSourcePath = resolve(ITEM_FIT_V3_CUTOUT_DIR, 'necklace-shoulder-aligned-fit.png');
  if (!existsSync(necklaceSourcePath)) throw new Error(`v3 source asset is missing: ${necklaceSourcePath}`);

  const canvas = selectedStyle.canvas;
  const necklaceNormalizedPath = resolve(ITEM_FIT_V6_NORMALIZED_DIR, 'necklace-shoulder-line-fit.png');
  const necklacePlacement = normalizeToSlot({
    sourcePath: necklaceSourcePath,
    outputPath: necklaceNormalizedPath,
    rect: shoulderMeasured.necklaceShoulderRect,
    canvas,
    maxScale: 1,
    alignY: 0.5,
  });
  const necklaceCompositePath = resolve(ITEM_FIT_V6_COMPOSITE_DIR, 'necklace-shoulder-line-fit-composite.png');
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [necklaceNormalizedPath],
    outputPath: necklaceCompositePath,
    canvas,
  });

  const item = {
    type: 'necklace',
    label: 'Necklace: v3 cutout shoulder-line measured placement',
    sourcePath: toRelative(necklaceSourcePath),
    sourceBounds: necklacePlacement.sourceBounds,
    placedRect: necklacePlacement.placedRect,
    normalizedPath: toRelative(necklaceNormalizedPath),
    compositePath: toRelative(necklaceCompositePath),
  };

  writeFileSync(ITEM_FIT_V6_PREVIEW_PATH, renderItemFitV6Preview({ selectedStyle, shoulderMeasured, item }));
  writeFileSync(ITEM_FIT_V6_REVIEW_PATH, renderItemFitV6Review({ shoulderMeasured, item }));
  writeManifest({
    ...previousManifest,
    itemFitV6Dir: ITEM_FIT_V6_DIR,
    itemFitV6Candidates: [item],
    itemFitV6MeasuredShoulderLine: toRelative(SHOULDER_LINE_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v6 preview: ${ITEM_FIT_V6_PREVIEW_PATH}`);
  console.log(`item fit v6 review: ${ITEM_FIT_V6_REVIEW_PATH}`);
};

const renderItemFitV7Preview = ({ selectedStyle, item }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V7_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const body =
    item.status === 'ok'
      ? `<div class="comparison">
          <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
          <figure><figcaption>Raw</figcaption><img src="${relative(item.rawPath)}" alt="raw necklace" /></figure>
          <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="cutout necklace" /></figure>
          <figure><figcaption>Normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="normalized necklace" /></figure>
          <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="composite necklace" /></figure>
        </div>`
      : `<p class="error">${escapeHtml(item.error)}</p>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V7 Necklace Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:520px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>V7 inner shoulder-line necklace</h1>
      <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Target rect: ${escapeHtml(JSON.stringify(NECKLACE_V7_RECT))}. Body center X: 504.</p>
      <article class="card">
        <header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>
        ${body}
        <p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p>
      </article>
    </main>
  </body>
</html>`;
};

const renderItemFitV7Review = ({ selectedStyle, item }) => `# Dressup Item Fit V7 Necklace Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Source: newly generated narrow necklace; one image-generation call for this batch.
- Target rect: \`${JSON.stringify(NECKLACE_V7_RECT)}\`
- Placement: \`${JSON.stringify(item.placedRects || null)}\`
- Source bounds: \`${JSON.stringify(item.sourceBounds || null)}\`

## Review

- Width:
- Shoulder/collarbone line:
- Centering:
- Style match:
- Verdict:
`;

const processItemFitV7Result = ({ result, selectedStyle }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, compositePath: null };

  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);
  const normalizedPath = resolve(ITEM_FIT_V7_NORMALIZED_DIR, result.filename);
  const placement = normalizeToSlot({
    sourcePath: cutoutPath,
    outputPath: normalizedPath,
    rect: NECKLACE_V7_RECT,
    canvas,
    maxScale: 1,
    alignY: 0.48,
  });
  const compositePath = resolve(ITEM_FIT_V7_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas,
  });

  return {
    ...result,
    sourceBounds: placement.sourceBounds,
    placedRects: { necklace: placement.placedRect },
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV7NecklaceBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const itemResults = await runBatch({
    allCandidates: itemFitV7Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV7Candidates || [],
    rawDir: ITEM_FIT_V7_RAW_DIR,
    cutoutDir: ITEM_FIT_V7_CUTOUT_DIR,
    label: 'item fit v7 necklace candidates',
  });
  const processed = itemResults.map((item) => processItemFitV7Result({ result: item, selectedStyle }));
  const item = processed[0];

  writeFileSync(ITEM_FIT_V7_PREVIEW_PATH, renderItemFitV7Preview({ selectedStyle, item }));
  writeFileSync(ITEM_FIT_V7_REVIEW_PATH, renderItemFitV7Review({ selectedStyle, item }));
  writeManifest({
    ...previousManifest,
    itemFitV7Dir: ITEM_FIT_V7_DIR,
    itemFitV7Candidates: processed,
    itemFitV7SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV7Rects: { necklace: NECKLACE_V7_RECT },
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v7 preview: ${ITEM_FIT_V7_PREVIEW_PATH}`);
  console.log(`item fit v7 review: ${ITEM_FIT_V7_REVIEW_PATH}`);
};

const renderNecklaceAnchorAuditPreview = ({ selectedStyle, measured }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Necklace Anchor Audit</title>
    <style>
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:#142235; background:#f8fafc; }
      main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:0 0 8px; font-size:30px; }
      p { color:#64758a; line-height:1.7; }
      .grid { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
      .panel { border:1px solid #d8e2ec; border-radius:8px; background:#fff; padding:16px; }
      img { width:100%; display:block; object-fit:contain; max-height:720px; }
      pre { overflow:auto; margin:0; white-space:pre-wrap; font-size:13px; line-height:1.55; }
      @media (max-width:860px) { .grid { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Necklace anchor audit: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}</h1>
      <p>Measures the base shoulder/neck top boundary and the generated necklace start points.</p>
      <div class="grid">
        <section class="panel"><img src="../${escapeHtml(selectedStyle.selectedCutout)}" alt="selected style base" /></section>
        <section class="panel"><pre>${escapeHtml(JSON.stringify(measured, null, 2))}</pre></section>
      </div>
    </main>
  </body>
</html>`;

const renderNecklaceAnchorAuditReview = ({ measured }) => `# Dressup Necklace Anchor Audit Review

- Base: \`${measured.selectedStyleCandidateId}\`
- Method: ${measured.method}
- Target anchors: \`${JSON.stringify(measured.targetAnchors)}\`
- v7 normalized anchors: \`${JSON.stringify(measured.v7Normalized?.anchors || null)}\`
- v7 deltas from target: \`${JSON.stringify(measured.v7Normalized?.deltasFromTarget || null)}\`

## Interpretation

- The manual shoulder anchors are not suitable for necklace start placement because they describe the lower outside shoulder area.
- v8 should align the generated necklace start pixels to the measured upper neck/shoulder boundary, not to a fixed fit rect.
`;

const runNecklaceAnchorAuditBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureNecklaceAnchors({ selectedStyle });
  writeFileSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH, JSON.stringify(measured, null, 2));
  writeFileSync(NECKLACE_ANCHOR_AUDIT_PREVIEW_PATH, renderNecklaceAnchorAuditPreview({ selectedStyle, measured }));
  writeFileSync(NECKLACE_ANCHOR_AUDIT_REVIEW_PATH, renderNecklaceAnchorAuditReview({ measured }));
  writeManifest({
    ...previousManifest,
    necklaceAnchorAuditDir: NECKLACE_ANCHOR_AUDIT_DIR,
    measuredNecklaceAnchors: toRelative(NECKLACE_ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`necklace anchor audit json: ${NECKLACE_ANCHOR_AUDIT_JSON_PATH}`);
  console.log(`necklace anchor audit preview: ${NECKLACE_ANCHOR_AUDIT_PREVIEW_PATH}`);
  console.log(`necklace anchor audit review: ${NECKLACE_ANCHOR_AUDIT_REVIEW_PATH}`);
};

const renderItemFitV8Preview = ({ selectedStyle, measured, item }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V8_DIR, path);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V8 Necklace Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta { margin:0 0 18px; color:var(--muted); line-height:1.7; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { margin-bottom:14px; }
      header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      .comparison { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:560px; object-fit:contain; display:block; }
      @media (max-width:980px) { .comparison { grid-template-columns:repeat(2,minmax(0,1fr)); } img { height:420px; } }
      @media (max-width:620px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <h1>V8 necklace re-anchored to shoulder start points</h1>
      <p class="meta">Target anchors=${escapeHtml(JSON.stringify(measured.targetAnchors))}, placed anchors=${escapeHtml(JSON.stringify(item.placedAnchors))}</p>
      <article class="card">
        <header><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></header>
        <div class="comparison">
          <figure><figcaption>Base</figcaption><img src="${relative(selectedStyle.selectedCutout)}" alt="selected style base" /></figure>
          <figure><figcaption>Source v7 cutout</figcaption><img src="${relative(item.sourcePath)}" alt="source necklace" /></figure>
          <figure><figcaption>Re-anchored normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="normalized necklace" /></figure>
          <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="composite necklace" /></figure>
        </div>
      </article>
    </main>
  </body>
</html>`;
};

const renderItemFitV8Review = ({ measured, item }) => `# Dressup Item Fit V8 Necklace Review

- Base: \`${measured.selectedStyleCandidateId}\`
- Source: existing v7 necklace cutout; no image generation.
- Target anchors: \`${JSON.stringify(measured.targetAnchors)}\`
- Placed anchors: \`${JSON.stringify(item.placedAnchors)}\`
- Placement: \`${JSON.stringify(item.placedRect)}\`
- Scale: \`${item.scale}\`

## Review

- Start-point alignment:
- Width:
- Pendant height:
- Shoulder/collarbone fit:
- Verdict:
`;

const runItemFitV8NecklaceReanchorBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = existsSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH) ? readJson(NECKLACE_ANCHOR_AUDIT_JSON_PATH) : measureNecklaceAnchors({ selectedStyle });
  if (!existsSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH)) {
    writeFileSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH, JSON.stringify(measured, null, 2));
  }
  const sourcePath = resolve(ITEM_FIT_V7_CUTOUT_DIR, 'necklace-inner-shoulder-line-fit.png');
  const normalizedPath = resolve(ITEM_FIT_V8_NORMALIZED_DIR, 'necklace-inner-shoulder-line-fit-reanchored.png');
  const placement = normalizeNecklaceToStartAnchors({
    sourcePath,
    outputPath: normalizedPath,
    targetAnchors: measured.targetAnchors || NECKLACE_V8_TARGET_ANCHORS,
    canvas: selectedStyle.canvas,
  });
  const compositePath = resolve(ITEM_FIT_V8_COMPOSITE_DIR, 'necklace-inner-shoulder-line-fit-reanchored-composite.png');
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });

  const item = {
    type: 'necklace',
    label: 'Necklace: v7 cutout re-anchored to shoulder start points',
    sourcePath: toRelative(sourcePath),
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
    sourceBounds: placement.sourceBounds,
    sourceAnchors: placement.sourceAnchors,
    targetAnchors: placement.targetAnchors,
    placedAnchors: placement.placedAnchors,
    placedRect: placement.placedRect,
    scale: placement.scale,
  };

  writeFileSync(ITEM_FIT_V8_PREVIEW_PATH, renderItemFitV8Preview({ selectedStyle, measured, item }));
  writeFileSync(ITEM_FIT_V8_REVIEW_PATH, renderItemFitV8Review({ measured, item }));
  writeManifest({
    ...previousManifest,
    itemFitV8Dir: ITEM_FIT_V8_DIR,
    itemFitV8Candidates: [item],
    itemFitV8MeasuredNecklaceAnchors: toRelative(NECKLACE_ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v8 preview: ${ITEM_FIT_V8_PREVIEW_PATH}`);
  console.log(`item fit v8 review: ${ITEM_FIT_V8_REVIEW_PATH}`);
};

const renderItemFitV9Preview = ({ selectedStyle, measuredStyle, measuredNecklace, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V9_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const split = (item.splitPaths || [])
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const normalized = item.normalizedPaths
        .map((path) => `<figure><figcaption>${escapeHtml(path.label)}</figcaption><img src="${relative(path.path)}" alt="${escapeHtml(path.label)}" /></figure>`)
        .join('');
      const composite = item.compositePath
        ? `<figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>`
        : '';
      const body =
        item.status === 'ok'
          ? `<div class="comparison"><figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure><figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>${split}${normalized}${composite}</div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V9 Accessory Stability Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V9 STABILITY VALIDATION</p>
        <h1>necklace and boots placement stability</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Necklace target anchors: ${escapeHtml(JSON.stringify(measuredNecklace.targetAnchors))}. Boot rects: ${escapeHtml(JSON.stringify(measuredStyle.bootRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV9Review = ({ selectedStyle, measuredStyle, measuredNecklace, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.type} | ${item.status} | \`${JSON.stringify(item.placedRects || item.placedAnchors || null)}\` |`)
    .join('\n');
  return `# Dressup Item Fit V9 Accessory Stability Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Source: 2 necklace candidates + 2 boots candidates.
- Necklace target anchors: \`${JSON.stringify(measuredNecklace.targetAnchors)}\`
- Boot rects: \`${JSON.stringify(measuredStyle.bootRects)}\`

| Item | Type | Status | Placement |
| --- | --- | --- | --- |
${rows}

## Necklace Stability

- Tiny ribbon necklace start alignment:
- Tiny ribbon necklace width/center/style:
- Moon pearl necklace start alignment:
- Moon pearl necklace width/center/style:
- Verdict:

## Boots Stability

- Ribbon ankle boots left/right placement:
- Ribbon ankle boots scale and toe coverage:
- Pearl button boots left/right placement:
- Pearl button boots scale and toe coverage:
- Verdict:
`;
};

const processItemFitV9Result = ({ result, selectedStyle, measuredStyle, measuredNecklace }) => {
  if (result.status !== 'ok') return { ...result, normalizedPaths: [], compositePath: null };

  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'necklace') {
    const normalizedPath = resolve(ITEM_FIT_V9_NORMALIZED_DIR, result.filename);
    const placement = normalizeNecklaceToStartAnchors({
      sourcePath: cutoutPath,
      outputPath: normalizedPath,
      targetAnchors: measuredNecklace.targetAnchors,
      canvas,
    });
    const compositePath = resolve(ITEM_FIT_V9_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [normalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      sourceAnchors: placement.sourceAnchors,
      targetAnchors: placement.targetAnchors,
      placedAnchors: placement.placedAnchors,
      placedRects: { necklace: placement.placedRect },
      scale: placement.scale,
      normalizedPaths: [{ label: 'Re-anchored normalized', path: toRelative(normalizedPath) }],
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'boots') {
    const leftSplitPath = resolve(ITEM_FIT_V9_SPLIT_DIR, `${result.id}-left.png`);
    const rightSplitPath = resolve(ITEM_FIT_V9_SPLIT_DIR, `${result.id}-right.png`);
    const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
    const leftNormalizedPath = resolve(ITEM_FIT_V9_NORMALIZED_DIR, `${result.id}-left.png`);
    const rightNormalizedPath = resolve(ITEM_FIT_V9_NORMALIZED_DIR, `${result.id}-right.png`);
    const leftPlacement = normalizeToSlotStretch({
      sourcePath: leftSplitPath,
      outputPath: leftNormalizedPath,
      rect: measuredStyle.bootRects.leftShoe,
      canvas,
      widthRatio: 1,
      heightRatio: 1,
      alignY: 1,
    });
    const rightPlacement = normalizeToSlotStretch({
      sourcePath: rightSplitPath,
      outputPath: rightNormalizedPath,
      rect: measuredStyle.bootRects.rightShoe,
      canvas,
      widthRatio: 1,
      heightRatio: 1,
      alignY: 1,
    });
    const compositePath = resolve(ITEM_FIT_V9_COMPOSITE_DIR, `${result.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: [leftNormalizedPath, rightNormalizedPath],
      outputPath: compositePath,
      canvas,
    });
    return {
      ...result,
      sourceBounds: split.sourceBounds,
      splitX: split.splitX,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      normalizedPaths: [
        { label: 'Left measured normalized', path: toRelative(leftNormalizedPath) },
        { label: 'Right measured normalized', path: toRelative(rightNormalizedPath) },
      ],
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPaths: [], compositePath: null };
};

const runItemFitV9AccessoryStabilityBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  const measuredNecklace = existsSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH) ? readJson(NECKLACE_ANCHOR_AUDIT_JSON_PATH) : measureNecklaceAnchors({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV9Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV9Candidates || [],
    rawDir: ITEM_FIT_V9_RAW_DIR,
    cutoutDir: ITEM_FIT_V9_CUTOUT_DIR,
    label: 'item fit v9 accessory stability candidates',
  });
  const processed = itemResults.map((item) => processItemFitV9Result({ result: item, selectedStyle, measuredStyle, measuredNecklace }));

  writeFileSync(ITEM_FIT_V9_PREVIEW_PATH, renderItemFitV9Preview({ selectedStyle, measuredStyle, measuredNecklace, items: processed }));
  writeFileSync(ITEM_FIT_V9_REVIEW_PATH, renderItemFitV9Review({ selectedStyle, measuredStyle, measuredNecklace, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV9Dir: ITEM_FIT_V9_DIR,
    itemFitV9Candidates: processed,
    itemFitV9SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV9MeasuredStyleModel: toRelative(ANCHOR_AUDIT_JSON_PATH),
    itemFitV9MeasuredNecklaceAnchors: toRelative(NECKLACE_ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v9 preview: ${ITEM_FIT_V9_PREVIEW_PATH}`);
  console.log(`item fit v9 review: ${ITEM_FIT_V9_REVIEW_PATH}`);
};

const itemFitV10BootIds = ['boots-ribbon-ankle-stability-fit', 'boots-pearl-button-stability-fit'];

const renderItemFitV10Preview = ({ selectedStyle, measuredStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V10_DIR, path);
  const cards = items
    .map(
      (item) => `<article class="card">
        <header><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></header>
        <div class="comparison">
          <figure><figcaption>Base</figcaption><img src="${relative(selectedStyle.selectedCutout)}" alt="selected style base" /></figure>
          <figure><figcaption>V9 composite</figcaption><img src="${relative(item.v9CompositePath)}" alt="${escapeHtml(`${item.label} v9 composite`)}" /></figure>
          <figure><figcaption>V10 left normalized</figcaption><img src="${relative(item.normalizedPaths[0].path)}" alt="${escapeHtml(`${item.label} left normalized`)}" /></figure>
          <figure><figcaption>V10 right normalized</figcaption><img src="${relative(item.normalizedPaths[1].path)}" alt="${escapeHtml(`${item.label} right normalized`)}" /></figure>
          <figure><figcaption>V10 composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} v10 composite`)}" /></figure>
        </div>
      </article>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V10 Boots Alpha Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:460px; object-fit:contain; display:block; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V10 BOOTS ALPHA VALIDATION</p>
        <h1>boots alpha reinforcement without regeneration</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Boot rects remain unchanged: ${escapeHtml(JSON.stringify(measuredStyle.bootRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV10Review = ({ selectedStyle, measuredStyle, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | \`${JSON.stringify(item.alphaStats)}\` | [composite](${item.compositePath}) |`)
    .join('\n');
  return `# Dressup Item Fit V10 Boots Alpha Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Source: existing v9 boots; no image generation.
- Boot rects: \`${JSON.stringify(measuredStyle.bootRects)}\`

| Item | Alpha stats | Composite |
| --- | --- | --- |
${rows}

## Review

- Ribbon ankle boots alpha:
- Ribbon ankle boots visual result:
- Pearl button boots alpha:
- Pearl button boots visual result:
- Verdict:
`;
};

const processItemFitV10Boot = ({ sourceItem, selectedStyle, measuredStyle }) => {
  const sourcePath = resolve(ITEM_FIT_V9_CUTOUT_DIR, sourceItem.filename);
  const v9CompositePath = resolve(ITEM_FIT_V9_COMPOSITE_DIR, `${sourceItem.id}-composite.png`);
  if (!existsSync(sourcePath)) throw new Error(`v9 boot cutout is missing: ${sourcePath}`);
  if (!existsSync(v9CompositePath)) throw new Error(`v9 boot composite is missing: ${v9CompositePath}`);

  const leftSplitPath = resolve(ITEM_FIT_V10_SPLIT_DIR, `${sourceItem.id}-left.png`);
  const rightSplitPath = resolve(ITEM_FIT_V10_SPLIT_DIR, `${sourceItem.id}-right.png`);
  const split = splitShoeCutout({ sourcePath, leftPath: leftSplitPath, rightPath: rightSplitPath });
  const leftNormalizedPath = resolve(ITEM_FIT_V10_NORMALIZED_DIR, `${sourceItem.id}-left-opaque.png`);
  const rightNormalizedPath = resolve(ITEM_FIT_V10_NORMALIZED_DIR, `${sourceItem.id}-right-opaque.png`);
  const leftPlacement = normalizeToSlotStretch({
    sourcePath: leftSplitPath,
    outputPath: leftNormalizedPath,
    rect: measuredStyle.bootRects.leftShoe,
    canvas: selectedStyle.canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const rightPlacement = normalizeToSlotStretch({
    sourcePath: rightSplitPath,
    outputPath: rightNormalizedPath,
    rect: measuredStyle.bootRects.rightShoe,
    canvas: selectedStyle.canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const leftAlphaStats = reinforceOpaqueInterior({ path: leftNormalizedPath });
  const rightAlphaStats = reinforceOpaqueInterior({ path: rightNormalizedPath });
  const compositePath = resolve(ITEM_FIT_V10_COMPOSITE_DIR, `${sourceItem.id}-opaque-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [leftNormalizedPath, rightNormalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });

  return {
    ...sourceItem,
    sourcePath: toRelative(sourcePath),
    v9CompositePath: toRelative(v9CompositePath),
    sourceBounds: split.sourceBounds,
    placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
    splitPaths: [
      { label: 'Left split', path: toRelative(leftSplitPath) },
      { label: 'Right split', path: toRelative(rightSplitPath) },
    ],
    normalizedPaths: [
      { label: 'Left opaque normalized', path: toRelative(leftNormalizedPath) },
      { label: 'Right opaque normalized', path: toRelative(rightNormalizedPath) },
    ],
    alphaStats: { left: leftAlphaStats, right: rightAlphaStats },
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV10BootsAlphaBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  const v9ItemsById = new Map((previousManifest.itemFitV9Candidates || []).map((item) => [item.id, item]));
  const items = itemFitV10BootIds.map((id) => {
    const sourceItem = v9ItemsById.get(id) || itemFitV9Candidates.find((item) => item.id === id);
    if (!sourceItem) throw new Error(`v9 boot item is missing from manifest and candidates: ${id}`);
    return processItemFitV10Boot({ sourceItem, selectedStyle, measuredStyle });
  });

  writeFileSync(ITEM_FIT_V10_PREVIEW_PATH, renderItemFitV10Preview({ selectedStyle, measuredStyle, items }));
  writeFileSync(ITEM_FIT_V10_REVIEW_PATH, renderItemFitV10Review({ selectedStyle, measuredStyle, items }));
  writeManifest({
    ...previousManifest,
    itemFitV10Dir: ITEM_FIT_V10_DIR,
    itemFitV10Candidates: items,
    itemFitV10SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV10MeasuredStyleModel: toRelative(ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v10 preview: ${ITEM_FIT_V10_PREVIEW_PATH}`);
  console.log(`item fit v10 review: ${ITEM_FIT_V10_REVIEW_PATH}`);
};

const renderItemFitV16Preview = ({ selectedStyle, measuredStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V16_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              <figure><figcaption>Left normalized</figcaption><img src="${relative(item.normalizedPaths[0].path)}" alt="${escapeHtml(`${item.label} left normalized`)}" /></figure>
              <figure><figcaption>Right normalized</figcaption><img src="${relative(item.normalizedPaths[1].path)}" alt="${escapeHtml(`${item.label} right normalized`)}" /></figure>
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V16 Flat Cuff Boots Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:460px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V16 FLAT CUFF BOOTS</p>
        <h1>flat cuff boots without visible boot interior</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Boot rects: ${escapeHtml(JSON.stringify(measuredStyle.bootRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV16Review = ({ selectedStyle, measuredStyle, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.status} | \`${JSON.stringify(item.placedRects || null)}\` | \`${JSON.stringify(item.alphaStats || null)}\` | [composite](${item.compositePath || ''}) |`)
    .join('\n');
  return `# Dressup Item Fit V16 Flat Cuff Boots Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Goal: remove visible boot interiors by using flat horizontal cuff openings.
- Boot rects: \`${JSON.stringify(measuredStyle.bootRects)}\`

| Item | Status | Placement | Alpha stats | Composite |
| --- | --- | --- | --- | --- |
${rows}

## Review

- Ribbon flat cuff boot interior visibility:
- Ribbon flat cuff boot fit:
- Pearl flat cuff boot interior visibility:
- Pearl flat cuff boot fit:
- Verdict:
`;
};

const processItemFitV16Boot = ({ result, selectedStyle, measuredStyle }) => {
  if (result.status !== 'ok') return { ...result, splitPaths: [], normalizedPaths: [], compositePath: null };

  const cutoutPath = fromOutputRelative(result.cutoutPath);
  const leftSplitPath = resolve(ITEM_FIT_V16_SPLIT_DIR, `${result.id}-left.png`);
  const rightSplitPath = resolve(ITEM_FIT_V16_SPLIT_DIR, `${result.id}-right.png`);
  const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
  const leftNormalizedPath = resolve(ITEM_FIT_V16_NORMALIZED_DIR, `${result.id}-left-opaque.png`);
  const rightNormalizedPath = resolve(ITEM_FIT_V16_NORMALIZED_DIR, `${result.id}-right-opaque.png`);
  const leftPlacement = normalizeToSlotStretch({
    sourcePath: leftSplitPath,
    outputPath: leftNormalizedPath,
    rect: measuredStyle.bootRects.leftShoe,
    canvas: selectedStyle.canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const rightPlacement = normalizeToSlotStretch({
    sourcePath: rightSplitPath,
    outputPath: rightNormalizedPath,
    rect: measuredStyle.bootRects.rightShoe,
    canvas: selectedStyle.canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 1,
  });
  const leftAlphaStats = reinforceOpaqueInterior({ path: leftNormalizedPath });
  const rightAlphaStats = reinforceOpaqueInterior({ path: rightNormalizedPath });
  const compositePath = resolve(ITEM_FIT_V16_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [leftNormalizedPath, rightNormalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });

  return {
    ...result,
    sourceBounds: split.sourceBounds,
    splitX: split.splitX,
    placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
    splitPaths: [
      { label: 'Left split', path: toRelative(leftSplitPath) },
      { label: 'Right split', path: toRelative(rightSplitPath) },
    ],
    normalizedPaths: [
      { label: 'Left opaque normalized', path: toRelative(leftNormalizedPath) },
      { label: 'Right opaque normalized', path: toRelative(rightNormalizedPath) },
    ],
    alphaStats: { left: leftAlphaStats, right: rightAlphaStats },
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV16FlatCuffBootsBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measuredStyle = existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV16Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV16Candidates || [],
    rawDir: ITEM_FIT_V16_RAW_DIR,
    cutoutDir: ITEM_FIT_V16_CUTOUT_DIR,
    label: 'item fit v16 flat cuff boot candidates',
  });
  const processed = itemResults.map((item) => processItemFitV16Boot({ result: item, selectedStyle, measuredStyle }));

  writeFileSync(ITEM_FIT_V16_PREVIEW_PATH, renderItemFitV16Preview({ selectedStyle, measuredStyle, items: processed }));
  writeFileSync(ITEM_FIT_V16_REVIEW_PATH, renderItemFitV16Review({ selectedStyle, measuredStyle, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV16Dir: ITEM_FIT_V16_DIR,
    itemFitV16Candidates: processed,
    itemFitV16SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV16MeasuredStyleModel: toRelative(ANCHOR_AUDIT_JSON_PATH),
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v16 preview: ${ITEM_FIT_V16_PREVIEW_PATH}`);
  console.log(`item fit v16 review: ${ITEM_FIT_V16_REVIEW_PATH}`);
};

const renderItemFitV17Preview = ({ selectedStyle, measurements, items, dir = ITEM_FIT_V17_DIR, batchLabel = 'V17 Game Catalog' }) => {
  const relative = (path) => toDirectoryRelative(dir, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const normalized = (item.normalizedPaths || (item.normalizedPath ? [{ label: 'Normalized', path: item.normalizedPath }] : []))
        .map((entry) => `<figure><figcaption>${escapeHtml(entry.label)}</figcaption><img src="${relative(entry.path)}" alt="${escapeHtml(entry.label)}" /></figure>`)
        .join('');
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              ${normalized}
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.type)} ${escapeHtml(item.placement || '')}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit ${escapeHtml(batchLabel)} Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT ${escapeHtml(batchLabel).toUpperCase()}</p>
        <h1>additional selectable items</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Top rect: ${escapeHtml(JSON.stringify(measurements.clothing.targetRects.top))}. Bottom rect: ${escapeHtml(JSON.stringify(measurements.longBottom.targetRects.bottomLong))}. Boot rects: ${escapeHtml(JSON.stringify(measurements.style.bootRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV17Review = ({ selectedStyle, measurements, items, batchLabel = 'V17 Game Catalog' }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.type} | ${item.placement || ''} | ${item.status} | \`${JSON.stringify(item.placedRects || item.placedRect || item.placedAnchors || null)}\` | \`${JSON.stringify(item.alphaStats || null)}\` | [composite](${item.compositePath || ''}) |`)
    .join('\n');
  return `# Dressup Item Fit ${batchLabel} Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Hair target rects: \`${JSON.stringify(measurements.hair.targetRects)}\`
- Necklace target anchors: \`${JSON.stringify(measurements.necklace.targetAnchors)}\`
- Clothing target rects: \`${JSON.stringify(measurements.clothing.targetRects)}\`
- Long bottom target rects: \`${JSON.stringify(measurements.longBottom.targetRects)}\`
- Boot rects: \`${JSON.stringify(measurements.style.bootRects)}\`

| Item | Type | Placement | Status | Placement | Alpha stats | Composite |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## Review

- Hair accessory stability:
- Necklace shoulder/collarbone fit:
- Top fit:
- Bottom length and base hem coverage:
- Flat-cuff boot fit:
- Verdict:
`;
};

const processItemFitV17Result = ({ result, selectedStyle, measurements, dirs = {} }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, normalizedPaths: [], compositePath: null };
  const splitDir = dirs.splitDir || ITEM_FIT_V17_SPLIT_DIR;
  const normalizedDir = dirs.normalizedDir || ITEM_FIT_V17_NORMALIZED_DIR;
  const compositeDir = dirs.compositeDir || ITEM_FIT_V17_COMPOSITE_DIR;
  const canvas = selectedStyle.canvas;
  const cutoutPath = fromOutputRelative(result.cutoutPath);

  if (result.type === 'hairAccessory') {
    const rect = measurements.hair.targetRects[result.placement];
    const normalizedPath = resolve(normalizedDir, result.filename);
    const placement = normalizeToSlot({ sourcePath: cutoutPath, outputPath: normalizedPath, rect, canvas, maxScale: 1, alignY: 0.5 });
    const compositePath = resolve(compositeDir, `${result.id}-composite.png`);
    compositePngs({ basePath: fromOutputRelative(selectedStyle.selectedCutout), layerPaths: [normalizedPath], outputPath: compositePath, canvas });
    return { ...result, sourceBounds: placement.sourceBounds, targetRect: rect, placedRect: placement.placedRect, normalizedPath: toRelative(normalizedPath), compositePath: toRelative(compositePath) };
  }

  if (result.type === 'necklace') {
    const normalizedPath = resolve(normalizedDir, result.filename);
    const placement = normalizeNecklaceToStartAnchors({ sourcePath: cutoutPath, outputPath: normalizedPath, targetAnchors: measurements.necklace.targetAnchors, canvas });
    const compositePath = resolve(compositeDir, `${result.id}-composite.png`);
    compositePngs({ basePath: fromOutputRelative(selectedStyle.selectedCutout), layerPaths: [normalizedPath], outputPath: compositePath, canvas });
    return {
      ...result,
      sourceBounds: placement.sourceBounds,
      sourceAnchors: placement.sourceAnchors,
      targetAnchors: placement.targetAnchors,
      placedAnchors: placement.placedAnchors,
      placedRects: { necklace: placement.placedRect },
      scale: placement.scale,
      normalizedPath: toRelative(normalizedPath),
      compositePath: toRelative(compositePath),
    };
  }

  if (result.type === 'clothing') {
    const measured = result.placement === 'bottomLong' ? measurements.longBottom : measurements.clothing;
    const rect = clothingTargetRect({ placement: result.placement, rect: measured.targetRects[result.placement], canvas });
    const normalizedPath = resolve(normalizedDir, result.filename);
    const placement =
      result.placement === 'bottomLong'
        ? normalizeToSlotStretch({ sourcePath: cutoutPath, outputPath: normalizedPath, rect, canvas, widthRatio: 1, heightRatio: 1, alignY: 0 })
        : normalizeToSlot({ sourcePath: cutoutPath, outputPath: normalizedPath, rect, canvas, maxScale: 1, alignY: 0.5 });
    const alphaStats = reinforceOpaqueInterior({ path: normalizedPath });
    const compositePath = resolve(compositeDir, `${result.id}-composite.png`);
    compositePngs({ basePath: fromOutputRelative(selectedStyle.selectedCutout), layerPaths: [normalizedPath], outputPath: compositePath, canvas });
    return { ...result, sourceBounds: placement.sourceBounds, targetRect: rect, placedRect: placement.placedRect, alphaStats, normalizedPath: toRelative(normalizedPath), compositePath: toRelative(compositePath) };
  }

  if (result.type === 'boots') {
    const leftSplitPath = resolve(splitDir, `${result.id}-left.png`);
    const rightSplitPath = resolve(splitDir, `${result.id}-right.png`);
    const split = splitShoeCutout({ sourcePath: cutoutPath, leftPath: leftSplitPath, rightPath: rightSplitPath });
    const leftNormalizedPath = resolve(normalizedDir, `${result.id}-left-opaque.png`);
    const rightNormalizedPath = resolve(normalizedDir, `${result.id}-right-opaque.png`);
    const leftPlacement = normalizeToSlotStretch({ sourcePath: leftSplitPath, outputPath: leftNormalizedPath, rect: measurements.style.bootRects.leftShoe, canvas, widthRatio: 1, heightRatio: 1, alignY: 1 });
    const rightPlacement = normalizeToSlotStretch({ sourcePath: rightSplitPath, outputPath: rightNormalizedPath, rect: measurements.style.bootRects.rightShoe, canvas, widthRatio: 1, heightRatio: 1, alignY: 1 });
    const leftAlphaStats = reinforceOpaqueInterior({ path: leftNormalizedPath });
    const rightAlphaStats = reinforceOpaqueInterior({ path: rightNormalizedPath });
    const compositePath = resolve(compositeDir, `${result.id}-composite.png`);
    compositePngs({ basePath: fromOutputRelative(selectedStyle.selectedCutout), layerPaths: [leftNormalizedPath, rightNormalizedPath], outputPath: compositePath, canvas });
    return {
      ...result,
      sourceBounds: split.sourceBounds,
      splitX: split.splitX,
      placedRects: { leftShoe: leftPlacement.placedRect, rightShoe: rightPlacement.placedRect },
      splitPaths: [
        { label: 'Left split', path: toRelative(leftSplitPath) },
        { label: 'Right split', path: toRelative(rightSplitPath) },
      ],
      normalizedPaths: [
        { label: 'Left opaque normalized', path: toRelative(leftNormalizedPath) },
        { label: 'Right opaque normalized', path: toRelative(rightNormalizedPath) },
      ],
      alphaStats: { left: leftAlphaStats, right: rightAlphaStats },
      compositePath: toRelative(compositePath),
    };
  }

  return { ...result, normalizedPath: null, normalizedPaths: [], compositePath: null };
};

const runItemFitV17GameCatalogBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measurements = {
    style: existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle }),
    hair: measureHairAccessoryStabilityAnchors({ selectedStyle }),
    necklace: existsSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH) ? readJson(NECKLACE_ANCHOR_AUDIT_JSON_PATH) : measureNecklaceAnchors({ selectedStyle }),
    clothing: measureClothingAnchors({ selectedStyle }),
    longBottom: measureLongBottomAnchors({ selectedStyle }),
  };
  const itemResults = await runBatch({
    allCandidates: itemFitV17Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV17Candidates || [],
    rawDir: ITEM_FIT_V17_RAW_DIR,
    cutoutDir: ITEM_FIT_V17_CUTOUT_DIR,
    label: 'item fit v17 game catalog candidates',
  });
  const processed = itemResults.map((item) => processItemFitV17Result({ result: item, selectedStyle, measurements }));

  writeFileSync(ITEM_FIT_V17_PREVIEW_PATH, renderItemFitV17Preview({ selectedStyle, measurements, items: processed }));
  writeFileSync(ITEM_FIT_V17_REVIEW_PATH, renderItemFitV17Review({ selectedStyle, measurements, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV17Dir: ITEM_FIT_V17_DIR,
    itemFitV17Candidates: processed,
    itemFitV17SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV17Measurements: measurements,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v17 preview: ${ITEM_FIT_V17_PREVIEW_PATH}`);
  console.log(`item fit v17 review: ${ITEM_FIT_V17_REVIEW_PATH}`);
};

const runItemFitV18ExpandedCatalogBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measurements = {
    style: existsSync(ANCHOR_AUDIT_JSON_PATH) ? readJson(ANCHOR_AUDIT_JSON_PATH) : measureStyleModel({ selectedStyle }),
    hair: measureHairAccessoryStabilityAnchors({ selectedStyle }),
    necklace: existsSync(NECKLACE_ANCHOR_AUDIT_JSON_PATH) ? readJson(NECKLACE_ANCHOR_AUDIT_JSON_PATH) : measureNecklaceAnchors({ selectedStyle }),
    clothing: measureClothingAnchors({ selectedStyle }),
    longBottom: measureLongBottomAnchors({ selectedStyle }),
  };
  const itemResults = await runBatch({
    allCandidates: itemFitV18Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV18Candidates || [],
    rawDir: ITEM_FIT_V18_RAW_DIR,
    cutoutDir: ITEM_FIT_V18_CUTOUT_DIR,
    label: 'item fit v18 expanded catalog candidates',
  });
  const dirs = {
    splitDir: ITEM_FIT_V18_SPLIT_DIR,
    normalizedDir: ITEM_FIT_V18_NORMALIZED_DIR,
    compositeDir: ITEM_FIT_V18_COMPOSITE_DIR,
  };
  const processed = itemResults.map((item) => processItemFitV17Result({ result: item, selectedStyle, measurements, dirs }));

  writeFileSync(ITEM_FIT_V18_PREVIEW_PATH, renderItemFitV17Preview({ selectedStyle, measurements, items: processed, dir: ITEM_FIT_V18_DIR, batchLabel: 'V18 Expanded Catalog' }));
  writeFileSync(ITEM_FIT_V18_REVIEW_PATH, renderItemFitV17Review({ selectedStyle, measurements, items: processed, batchLabel: 'V18 Expanded Catalog' }));
  writeManifest({
    ...previousManifest,
    itemFitV18Dir: ITEM_FIT_V18_DIR,
    itemFitV18Candidates: processed,
    itemFitV18SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV18Measurements: measurements,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v18 preview: ${ITEM_FIT_V18_PREVIEW_PATH}`);
  console.log(`item fit v18 review: ${ITEM_FIT_V18_REVIEW_PATH}`);
};

const renderItemFitV11Preview = ({ selectedStyle, measured, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V11_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Raw</figcaption><img src="${relative(item.rawPath)}" alt="${escapeHtml(`${item.label} raw`)}" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              <figure><figcaption>Normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="${escapeHtml(`${item.label} normalized`)}" /></figure>
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.placement)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V11 Hair Accessory Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V11 HAIR ACCESSORY VALIDATION</p>
        <h1>headband and hairpin placement</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Head bounds: ${escapeHtml(JSON.stringify(measured.headBounds))}. Target rects: ${escapeHtml(JSON.stringify(measured.targetRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV11Review = ({ selectedStyle, measured, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.placement} | ${item.status} | \`${JSON.stringify(item.placedRect || null)}\` |`)
    .join('\n');
  return `# Dressup Item Fit V11 Hair Accessory Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Head bounds: \`${JSON.stringify(measured.headBounds)}\`
- Target rects: \`${JSON.stringify(measured.targetRects)}\`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
${rows}

## Review

- Ribbon headband face/eye overlap:
- Ribbon headband hair fit:
- Flower hairpin face/eye overlap:
- Flower hairpin hair fit:
- Background removal:
- Verdict:
`;
};

const processItemFitV11Result = ({ result, selectedStyle, measured }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, compositePath: null };
  const rect = measured.targetRects[result.placement];
  if (!rect) throw new Error(`No hair accessory target rect for placement: ${result.placement}`);
  const normalizedPath = resolve(ITEM_FIT_V11_NORMALIZED_DIR, result.filename);
  const placement = normalizeToSlot({
    sourcePath: fromOutputRelative(result.cutoutPath),
    outputPath: normalizedPath,
    rect,
    canvas: selectedStyle.canvas,
    maxScale: 1,
    alignY: result.placement === 'headband' ? 0.5 : 0.5,
  });
  const compositePath = resolve(ITEM_FIT_V11_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });
  return {
    ...result,
    sourceBounds: placement.sourceBounds,
    targetRect: rect,
    placedRect: placement.placedRect,
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV11HairAccessoryBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureHairAccessoryAnchors({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV11Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV11Candidates || [],
    rawDir: ITEM_FIT_V11_RAW_DIR,
    cutoutDir: ITEM_FIT_V11_CUTOUT_DIR,
    label: 'item fit v11 hair accessory candidates',
  });
  const processed = itemResults.map((item) => processItemFitV11Result({ result: item, selectedStyle, measured }));

  writeFileSync(ITEM_FIT_V11_PREVIEW_PATH, renderItemFitV11Preview({ selectedStyle, measured, items: processed }));
  writeFileSync(ITEM_FIT_V11_REVIEW_PATH, renderItemFitV11Review({ selectedStyle, measured, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV11Dir: ITEM_FIT_V11_DIR,
    itemFitV11Candidates: processed,
    itemFitV11SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV11MeasuredHairAccessoryAnchors: measured,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v11 preview: ${ITEM_FIT_V11_PREVIEW_PATH}`);
  console.log(`item fit v11 review: ${ITEM_FIT_V11_REVIEW_PATH}`);
};

const renderItemFitV12Preview = ({ selectedStyle, measured, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V12_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Raw</figcaption><img src="${relative(item.rawPath)}" alt="${escapeHtml(`${item.label} raw`)}" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              <figure><figcaption>Normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="${escapeHtml(`${item.label} normalized`)}" /></figure>
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.placement)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V12 Hair Accessory Stability Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V12 HAIR ACCESSORY STABILITY</p>
        <h1>hair accessory anchor stability</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Head bounds: ${escapeHtml(JSON.stringify(measured.headBounds))}. Target rects: ${escapeHtml(JSON.stringify(measured.targetRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV12Review = ({ selectedStyle, measured, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.placement} | ${item.status} | \`${JSON.stringify(item.placedRect || null)}\` |`)
    .join('\n');
  return `# Dressup Item Fit V12 Hair Accessory Stability Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Head bounds: \`${JSON.stringify(measured.headBounds)}\`
- Target rects: \`${JSON.stringify(measured.targetRects)}\`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
${rows}

## Review

- Side ribbon hairpin face/eye overlap:
- Side ribbon hairpin hair fit:
- Pearl clips face/eye overlap:
- Pearl clips hair fit:
- Slim lace headband face/eye overlap:
- Slim lace headband hair fit:
- Background removal:
- Verdict:
`;
};

const processItemFitV12Result = ({ result, selectedStyle, measured }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, compositePath: null };
  const rect = measured.targetRects[result.placement];
  if (!rect) throw new Error(`No hair accessory target rect for placement: ${result.placement}`);
  const normalizedPath = resolve(ITEM_FIT_V12_NORMALIZED_DIR, result.filename);
  const placement = normalizeToSlot({
    sourcePath: fromOutputRelative(result.cutoutPath),
    outputPath: normalizedPath,
    rect,
    canvas: selectedStyle.canvas,
    maxScale: 1,
    alignY: 0.5,
  });
  const compositePath = resolve(ITEM_FIT_V12_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });
  return {
    ...result,
    sourceBounds: placement.sourceBounds,
    targetRect: rect,
    placedRect: placement.placedRect,
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV12HairAccessoryStabilityBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureHairAccessoryStabilityAnchors({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV12Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV12Candidates || [],
    rawDir: ITEM_FIT_V12_RAW_DIR,
    cutoutDir: ITEM_FIT_V12_CUTOUT_DIR,
    label: 'item fit v12 hair accessory stability candidates',
  });
  const processed = itemResults.map((item) => processItemFitV12Result({ result: item, selectedStyle, measured }));

  writeFileSync(ITEM_FIT_V12_PREVIEW_PATH, renderItemFitV12Preview({ selectedStyle, measured, items: processed }));
  writeFileSync(ITEM_FIT_V12_REVIEW_PATH, renderItemFitV12Review({ selectedStyle, measured, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV12Dir: ITEM_FIT_V12_DIR,
    itemFitV12Candidates: processed,
    itemFitV12SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV12MeasuredHairAccessoryAnchors: measured,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v12 preview: ${ITEM_FIT_V12_PREVIEW_PATH}`);
  console.log(`item fit v12 review: ${ITEM_FIT_V12_REVIEW_PATH}`);
};

const renderItemFitV13Preview = ({ selectedStyle, measured, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V13_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Raw</figcaption><img src="${relative(item.rawPath)}" alt="${escapeHtml(`${item.label} raw`)}" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              <figure><figcaption>Normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="${escapeHtml(`${item.label} normalized`)}" /></figure>
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.placement)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V13 Clothing Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V13 CLOTHING VALIDATION</p>
        <h1>top, bottom, and one-piece overlay placement</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Body center X: ${escapeHtml(measured.bodyCenterX)}. Target rects: ${escapeHtml(JSON.stringify(measured.targetRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV13Review = ({ selectedStyle, measured, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.placement} | ${item.status} | \`${JSON.stringify(item.placedRect || null)}\` |`)
    .join('\n');
  return `# Dressup Item Fit V13 Clothing Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Body center X: \`${measured.bodyCenterX}\`
- Upper body bounds: \`${JSON.stringify(measured.upperBodyBounds)}\`
- Skirt bounds: \`${JSON.stringify(measured.skirtBounds)}\`
- Target rects: \`${JSON.stringify(measured.targetRects)}\`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
${rows}

## Review

- Top shoulder/neck fit:
- Top arm interference:
- Bottom waist fit:
- Bottom base-skirt coverage:
- Dress overlay shoulder/neck fit:
- Dress overlay arm/leg interference:
- Background removal:
- Verdict:
`;
};

const processItemFitV13Result = ({ result, selectedStyle, measured }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, compositePath: null };
  const rect = measured.targetRects[result.placement];
  if (!rect) throw new Error(`No clothing target rect for placement: ${result.placement}`);
  const normalizedPath = resolve(ITEM_FIT_V13_NORMALIZED_DIR, result.filename);
  const placement = normalizeToSlot({
    sourcePath: fromOutputRelative(result.cutoutPath),
    outputPath: normalizedPath,
    rect,
    canvas: selectedStyle.canvas,
    maxScale: 1,
    alignY: result.placement === 'bottom' ? 0 : 0.5,
  });
  const compositePath = resolve(ITEM_FIT_V13_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });
  return {
    ...result,
    sourceBounds: placement.sourceBounds,
    targetRect: rect,
    placedRect: placement.placedRect,
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV13ClothingBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureClothingAnchors({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV13Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV13Candidates || [],
    rawDir: ITEM_FIT_V13_RAW_DIR,
    cutoutDir: ITEM_FIT_V13_CUTOUT_DIR,
    label: 'item fit v13 clothing candidates',
  });
  const processed = itemResults.map((item) => processItemFitV13Result({ result: item, selectedStyle, measured }));

  writeFileSync(ITEM_FIT_V13_PREVIEW_PATH, renderItemFitV13Preview({ selectedStyle, measured, items: processed }));
  writeFileSync(ITEM_FIT_V13_REVIEW_PATH, renderItemFitV13Review({ selectedStyle, measured, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV13Dir: ITEM_FIT_V13_DIR,
    itemFitV13Candidates: processed,
    itemFitV13SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV13MeasuredClothingAnchors: measured,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v13 preview: ${ITEM_FIT_V13_PREVIEW_PATH}`);
  console.log(`item fit v13 review: ${ITEM_FIT_V13_REVIEW_PATH}`);
};

const renderItemFitV14Preview = ({ selectedStyle, measured, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V14_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const cards = items
    .map((item) => {
      const body =
        item.status === 'ok'
          ? `<div class="comparison">
              <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
              <figure><figcaption>Raw</figcaption><img src="${relative(item.rawPath)}" alt="${escapeHtml(`${item.label} raw`)}" /></figure>
              <figure><figcaption>Cutout</figcaption><img src="${relative(item.cutoutPath)}" alt="${escapeHtml(`${item.label} cutout`)}" /></figure>
              <figure><figcaption>Normalized</figcaption><img src="${relative(item.normalizedPath)}" alt="${escapeHtml(`${item.label} normalized`)}" /></figure>
              <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
            </div>`
          : `<p class="error">${escapeHtml(item.error)}</p>`;
      return `<article class="card ${item.status === 'ok' ? 'ok' : 'error'}"><header><div><p>${escapeHtml(item.placement)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.status)}</strong></header>${body}<p class="prompt">${escapeHtml(item.revisedPrompt || item.prompt)}</p></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V14 Long Bottom Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; --error:#b42318; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt { margin:0; color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { border:1px solid #bee3db; border-radius:999px; color:var(--accent); padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:linear-gradient(45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(-45deg,#edf2f7 25%,transparent 25%) 0 0/18px 18px,linear-gradient(45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,linear-gradient(-45deg,transparent 75%,#edf2f7 75%) 0 0/18px 18px,#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:440px; object-fit:contain; display:block; }
      .prompt { margin-top:12px; font-size:13px; }
      .error { color:var(--error); font-weight:800; }
      @media (max-width:1180px) { .comparison { grid-template-columns:repeat(3,minmax(0,1fr)); } }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:340px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V14 LONG BOTTOM VALIDATION</p>
        <h1>knee-length bottom-only placement</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. Body center X: ${escapeHtml(measured.bodyCenterX)}. Target rects: ${escapeHtml(JSON.stringify(measured.targetRects))}.</p>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV14Review = ({ selectedStyle, measured, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.placement} | ${item.status} | \`${JSON.stringify(item.placedRect || null)}\` |`)
    .join('\n');
  return `# Dressup Item Fit V14 Long Bottom Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: \`${MODEL}\`
- Body center X: \`${measured.bodyCenterX}\`
- Skirt bounds: \`${JSON.stringify(measured.skirtBounds)}\`
- Target rects: \`${JSON.stringify(measured.targetRects)}\`

| Item | Placement | Status | Placement rect |
| --- | --- | --- | --- |
${rows}

## Review

- A-line skirt waist fit:
- A-line skirt length/base hem coverage:
- A-line skirt opacity/independence:
- Long frill skirt waist fit:
- Long frill skirt length/base hem coverage:
- Long frill skirt opacity/independence:
- Background removal:
- Verdict:
`;
};

const processItemFitV14Result = ({ result, selectedStyle, measured }) => {
  if (result.status !== 'ok') return { ...result, normalizedPath: null, compositePath: null };
  const rect = measured.targetRects[result.placement];
  if (!rect) throw new Error(`No long bottom target rect for placement: ${result.placement}`);
  const normalizedPath = resolve(ITEM_FIT_V14_NORMALIZED_DIR, result.filename);
  const placement = normalizeToSlotStretch({
    sourcePath: fromOutputRelative(result.cutoutPath),
    outputPath: normalizedPath,
    rect: clothingTargetRect({ placement: result.placement, rect, canvas: selectedStyle.canvas }),
    canvas: selectedStyle.canvas,
    widthRatio: 1,
    heightRatio: 1,
    alignY: 0,
  });
  const alphaStats = reinforceOpaqueInterior({ path: normalizedPath });
  const compositePath = resolve(ITEM_FIT_V14_COMPOSITE_DIR, `${result.id}-composite.png`);
  compositePngs({
    basePath: fromOutputRelative(selectedStyle.selectedCutout),
    layerPaths: [normalizedPath],
    outputPath: compositePath,
    canvas: selectedStyle.canvas,
  });
  return {
    ...result,
    sourceBounds: placement.sourceBounds,
    targetRect: clothingTargetRect({ placement: result.placement, rect, canvas: selectedStyle.canvas }),
    placedRect: placement.placedRect,
    alphaStats,
    normalizedPath: toRelative(normalizedPath),
    compositePath: toRelative(compositePath),
  };
};

const runItemFitV14LongBottomBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  const measured = measureLongBottomAnchors({ selectedStyle });
  const itemResults = await runBatch({
    allCandidates: itemFitV14Candidates,
    requestedIds: REQUESTED_ITEM_IDS,
    previousItems: previousManifest.itemFitV14Candidates || [],
    rawDir: ITEM_FIT_V14_RAW_DIR,
    cutoutDir: ITEM_FIT_V14_CUTOUT_DIR,
    label: 'item fit v14 long bottom candidates',
  });
  const processed = itemResults.map((item) => processItemFitV14Result({ result: item, selectedStyle, measured }));

  writeFileSync(ITEM_FIT_V14_PREVIEW_PATH, renderItemFitV14Preview({ selectedStyle, measured, items: processed }));
  writeFileSync(ITEM_FIT_V14_REVIEW_PATH, renderItemFitV14Review({ selectedStyle, measured, items: processed }));
  writeManifest({
    ...previousManifest,
    itemFitV14Dir: ITEM_FIT_V14_DIR,
    itemFitV14Candidates: processed,
    itemFitV14SelectedStyle: selectedStyle.selectedStyleCandidateId,
    itemFitV14MeasuredLongBottomAnchors: measured,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v14 preview: ${ITEM_FIT_V14_PREVIEW_PATH}`);
  console.log(`item fit v14 review: ${ITEM_FIT_V14_REVIEW_PATH}`);
};

const layerStackV15Assets = {
  top: {
    label: 'Top: simple frill blouse',
    path: resolve(ITEM_FIT_V13_NORMALIZED_DIR, 'top-frill-blouse-fit.png'),
  },
  bottomLong: {
    label: 'Bottom: long frill skirt',
    path: resolve(ITEM_FIT_V14_NORMALIZED_DIR, 'bottom-long-frill-skirt-fit.png'),
  },
  bottomAline: {
    label: 'Bottom: knee A-line skirt',
    path: resolve(ITEM_FIT_V14_NORMALIZED_DIR, 'bottom-knee-a-line-fit.png'),
  },
  bootsLeft: {
    label: 'Boots: left opaque',
    path: resolve(ITEM_FIT_V10_NORMALIZED_DIR, 'boots-ribbon-ankle-stability-fit-left-opaque.png'),
  },
  bootsRight: {
    label: 'Boots: right opaque',
    path: resolve(ITEM_FIT_V10_NORMALIZED_DIR, 'boots-ribbon-ankle-stability-fit-right-opaque.png'),
  },
  necklace: {
    label: 'Necklace: re-anchored baseline',
    path: resolve(ITEM_FIT_V8_NORMALIZED_DIR, 'necklace-inner-shoulder-line-fit-reanchored.png'),
  },
  hairAccessory: {
    label: 'Hair accessory: side ribbon hairpin',
    path: resolve(ITEM_FIT_V12_NORMALIZED_DIR, 'hairpin-side-ribbon-stability-fit.png'),
  },
};

const layerStackV15Orders = [
  {
    id: 'long-a',
    label: 'Long skirt A: top then bottom',
    bottomKey: 'bottomLong',
    layerKeys: ['top', 'bottomLong', 'bootsLeft', 'bootsRight', 'necklace', 'hairAccessory'],
  },
  {
    id: 'long-b',
    label: 'Long skirt B: bottom then top',
    bottomKey: 'bottomLong',
    layerKeys: ['bottomLong', 'top', 'bootsLeft', 'bootsRight', 'necklace', 'hairAccessory'],
  },
  {
    id: 'long-c',
    label: 'Long skirt C: necklace before boots',
    bottomKey: 'bottomLong',
    layerKeys: ['bottomLong', 'top', 'necklace', 'bootsLeft', 'bootsRight', 'hairAccessory'],
  },
  {
    id: 'aline-a',
    label: 'A-line A: top then bottom',
    bottomKey: 'bottomAline',
    layerKeys: ['top', 'bottomAline', 'bootsLeft', 'bootsRight', 'necklace', 'hairAccessory'],
  },
  {
    id: 'aline-b',
    label: 'A-line B: bottom then top',
    bottomKey: 'bottomAline',
    layerKeys: ['bottomAline', 'top', 'bootsLeft', 'bootsRight', 'necklace', 'hairAccessory'],
  },
  {
    id: 'aline-c',
    label: 'A-line C: necklace before boots',
    bottomKey: 'bottomAline',
    layerKeys: ['bottomAline', 'top', 'necklace', 'bootsLeft', 'bootsRight', 'hairAccessory'],
  },
];

const validateLayerStackV15Assets = ({ selectedStyle }) => {
  const required = [fromOutputRelative(selectedStyle.selectedCutout), ...Object.values(layerStackV15Assets).map((asset) => asset.path)];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length) throw new Error(`Missing v15 layer stack assets: ${missing.join(', ')}`);
};

const renderItemFitV15Preview = ({ selectedStyle, items }) => {
  const relative = (path) => toDirectoryRelative(ITEM_FIT_V15_DIR, path);
  const basePath = relative(selectedStyle.selectedCutout);
  const layerList = Object.entries(layerStackV15Assets)
    .map(([key, asset]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(asset.label)} <code>${escapeHtml(relative(asset.path))}</code></li>`)
    .join('\n');
  const cards = items
    .map(
      (item) => `<article class="card">
        <header><div><p>${escapeHtml(item.id)}</p><h2>${escapeHtml(item.label)}</h2></div><strong>${escapeHtml(item.bottomKey)}</strong></header>
        <div class="comparison">
          <figure><figcaption>Base</figcaption><img src="${basePath}" alt="selected style base" /></figure>
          <figure><figcaption>Composite</figcaption><img src="${relative(item.compositePath)}" alt="${escapeHtml(`${item.label} composite`)}" /></figure>
        </div>
        <p class="prompt">Layer order: ${escapeHtml(item.layerKeys.map((key) => layerStackV15Assets[key].label).join(' -> '))}</p>
      </article>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dressup Item Fit V15 Layer Stack Preview</title>
    <style>
      :root { color-scheme: light; --panel:#fff; --border:#d8e2ec; --text:#142235; --muted:#64758a; --accent:#0f766e; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif; color:var(--text); background:#f8fafc; }
      main { width:min(1320px,calc(100% - 32px)); margin:0 auto; padding:28px 0 42px; }
      .hero { margin-bottom:20px; }
      .eyebrow, header p { margin:0; color:var(--accent); font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      h1 { margin:6px 0 8px; font-size:32px; line-height:1.15; }
      .meta, .prompt, li { color:var(--muted); line-height:1.7; }
      .grid { display:grid; gap:18px; }
      .card { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:16px; box-shadow:0 10px 28px rgba(15,35,55,.06); }
      header { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:14px; }
      h2 { margin:4px 0 0; font-size:19px; line-height:1.3; }
      strong { color:var(--accent); }
      header > strong { border:1px solid #bee3db; border-radius:999px; padding:5px 9px; font-size:12px; text-transform:uppercase; }
      .comparison { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      figure { margin:0; border:1px solid #e4ebf2; border-radius:8px; overflow:hidden; background:#fff; }
      figcaption { padding:9px 10px 0; color:var(--muted); font-size:12px; font-weight:800; }
      img { width:100%; height:620px; object-fit:contain; display:block; }
      .prompt { margin:12px 0 0; font-size:13px; }
      code { font-size:12px; color:#475569; }
      @media (max-width:760px) { .comparison { grid-template-columns:1fr; } img { height:420px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">DRESSUP ITEM FIT V15 LAYER STACK VALIDATION</p>
        <h1>full outfit layer order comparison</h1>
        <p class="meta">Base: ${escapeHtml(selectedStyle.selectedStyleCandidateId)}. No image generation; all composites reuse existing normalized layers.</p>
        <ul>${layerList}</ul>
      </section>
      <div class="grid">${cards}</div>
    </main>
  </body>
</html>`;
};

const renderItemFitV15Review = ({ selectedStyle, items }) => {
  const rows = items
    .map((item) => `| ${item.label} | ${item.bottomKey} | \`${item.layerKeys.join(' -> ')}\` | \`${item.compositePath}\` |`)
    .join('\n');
  return `# Dressup Item Fit V15 Layer Stack Review

- Base: \`${selectedStyle.selectedStyleCandidateId}\`
- Model: no image generation; existing normalized layers only

| Stack | Bottom | Layer order | Composite |
| --- | --- | --- | --- |
${rows}

## Review

- Top/bottom waist connection:
- Bottom over/under top preference:
- Necklace/top collar relationship:
- Boots/bottom/leg relationship:
- Hair accessory face/hair relationship:
- Best layer order:
- Verdict:
`;
};

const runItemFitV15LayerStackBatch = async (previousManifest) => {
  if (!existsSync(SELECTED_STYLE_PATH)) {
    throw new Error(`Selected style model is missing: ${SELECTED_STYLE_PATH}`);
  }

  const selectedStyle = readJson(SELECTED_STYLE_PATH);
  validateLayerStackV15Assets({ selectedStyle });
  const items = layerStackV15Orders.map((stack) => {
    const compositePath = resolve(ITEM_FIT_V15_COMPOSITE_DIR, `${stack.id}-composite.png`);
    compositePngs({
      basePath: fromOutputRelative(selectedStyle.selectedCutout),
      layerPaths: stack.layerKeys.map((key) => layerStackV15Assets[key].path),
      outputPath: compositePath,
      canvas: selectedStyle.canvas,
    });
    return {
      ...stack,
      compositePath: toRelative(compositePath),
    };
  });

  writeFileSync(ITEM_FIT_V15_PREVIEW_PATH, renderItemFitV15Preview({ selectedStyle, items }));
  writeFileSync(ITEM_FIT_V15_REVIEW_PATH, renderItemFitV15Review({ selectedStyle, items }));
  writeManifest({
    ...previousManifest,
    itemFitV15Dir: ITEM_FIT_V15_DIR,
    itemFitV15LayerAssets: Object.fromEntries(
      Object.entries(layerStackV15Assets).map(([key, asset]) => [key, { label: asset.label, path: toRelative(asset.path) }]),
    ),
    itemFitV15LayerStacks: items,
    itemFitV15SelectedStyle: selectedStyle.selectedStyleCandidateId,
  });
  console.log(`manifest: ${MANIFEST_PATH}`);
  console.log(`item fit v15 preview: ${ITEM_FIT_V15_PREVIEW_PATH}`);
  console.log(`item fit v15 review: ${ITEM_FIT_V15_REVIEW_PATH}`);
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

  if (ITEM_BATCH === 'high-risk-fit') {
    await runItemFitBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v2') {
    await runItemFitV2Batch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v3') {
    await runItemFitV3Batch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v4') {
    await runItemFitV4Batch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'anchor-audit') {
    await runAnchorAuditBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'shoulder-line-audit') {
    await runShoulderLineAuditBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v5-measured') {
    await runItemFitV5MeasuredBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v6-shoulder-necklace') {
    await runItemFitV6ShoulderNecklaceBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v7-necklace') {
    await runItemFitV7NecklaceBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'necklace-anchor-audit') {
    await runNecklaceAnchorAuditBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v8-necklace-reanchor') {
    await runItemFitV8NecklaceReanchorBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'stability-fit-v9-accessories') {
    await runItemFitV9AccessoryStabilityBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'stability-fit-v10-boots-alpha') {
    await runItemFitV10BootsAlphaBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v11-hair-accessory') {
    await runItemFitV11HairAccessoryBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'stability-fit-v12-hair-accessories') {
    await runItemFitV12HairAccessoryStabilityBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v13-clothing') {
    await runItemFitV13ClothingBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'high-risk-fit-v14-long-bottom') {
    await runItemFitV14LongBottomBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'full-outfit-v15-layer-stack') {
    await runItemFitV15LayerStackBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'flat-cuff-boots-v16') {
    await runItemFitV16FlatCuffBootsBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'game-catalog-v17') {
    await runItemFitV17GameCatalogBatch(previousManifest);
    return;
  }

  if (ITEM_BATCH === 'game-catalog-v18-expansion') {
    await runItemFitV18ExpandedCatalogBatch(previousManifest);
    return;
  }

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
