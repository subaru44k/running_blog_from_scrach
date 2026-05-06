import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DRAW_DIR = resolve(SCRIPT_DIR, '..');
const ROOT_DIR = resolve(DRAW_DIR, '..', '..');
const ARTIFACT_DIR = resolve(DRAW_DIR, 'artifacts/dressup-gpt-image-2-validation');
const PUBLIC_DIR = resolve(ROOT_DIR, 'astro-blog/public/images/games/dressup-next');
const PREVIEW_DIR = resolve(PUBLIC_DIR, 'previews');
const CATALOG_PATH = resolve(ROOT_DIR, 'astro-blog/src/lib/games/dressup-next-catalog.json');

const fromArtifact = (path) => resolve(ARTIFACT_DIR, path);
const fromPublic = (path) => resolve(PUBLIC_DIR, path);

const ensureParent = (path) => mkdirSync(dirname(path), { recursive: true });
const ensureDir = (path) => mkdirSync(path, { recursive: true });

const copyAsset = ({ source, dest }) => {
  if (!existsSync(source)) throw new Error(`Missing source asset: ${source}`);
  const output = fromPublic(dest);
  ensureParent(output);
  copyFileSync(source, output);
};

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

const tintAsset = ({ source, dest, tint, amount = 0.38 }) => {
  if (!existsSync(source)) throw new Error(`Missing source asset: ${source}`);
  const image = PNG.sync.read(readFileSync(source));
  tintImage({ image, tint, amount });
  const output = fromPublic(dest);
  ensureParent(output);
  writeFileSync(output, PNG.sync.write(image));
};

const tintImage = ({ image, tint, amount = 0.38 }) => {
  const [tr, tg, tb] = tint;
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3];
    if (alpha < 8) continue;
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const shade = 0.72 + luma * 0.5;
    image.data[i] = clamp(r * (1 - amount) + tr * shade * amount);
    image.data[i + 1] = clamp(g * (1 - amount) + tg * shade * amount);
    image.data[i + 2] = clamp(b * (1 - amount) + tb * shade * amount);
  }
  return image;
};

const makeVariant = ({ sourceDest, dest, tint, amount }) => {
  tintAsset({ source: fromPublic(sourceDest), dest, tint, amount });
};

const alphaBBox = (image, threshold = 8) => {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];
      if (alpha <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
};

const expandBBox = (bbox, width, height, paddingRatio = 0.12) => {
  const boxWidth = bbox.maxX - bbox.minX + 1;
  const boxHeight = bbox.maxY - bbox.minY + 1;
  const pad = Math.ceil(Math.max(boxWidth, boxHeight) * paddingRatio);
  return {
    minX: Math.max(0, bbox.minX - pad),
    minY: Math.max(0, bbox.minY - pad),
    maxX: Math.min(width - 1, bbox.maxX + pad),
    maxY: Math.min(height - 1, bbox.maxY + pad),
  };
};

const unionBBox = (boxes) => {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  return {
    minX: Math.min(...valid.map((box) => box.minX)),
    minY: Math.min(...valid.map((box) => box.minY)),
    maxX: Math.max(...valid.map((box) => box.maxX)),
    maxY: Math.max(...valid.map((box) => box.maxY)),
  };
};

const clonePng = (image) => {
  const clone = new PNG({ width: image.width, height: image.height });
  image.data.copy(clone.data);
  return clone;
};

const cropImageObjectsToPreview = ({ images, dest, paddingRatio = 0.12 }) => {
  if (!images.length) throw new Error(`No preview source images for ${dest}`);
  const first = images[0];
  const bbox = expandBBox(
    unionBBox(images.map((image) => alphaBBox(image))),
    first.width,
    first.height,
    paddingRatio
  );
  const output = new PNG({
    width: bbox.maxX - bbox.minX + 1,
    height: bbox.maxY - bbox.minY + 1,
  });
  for (const image of images) {
    if (image.width !== first.width || image.height !== first.height) {
      throw new Error(`Preview source size mismatch for ${dest}`);
    }
    for (let y = bbox.minY; y <= bbox.maxY; y += 1) {
      for (let x = bbox.minX; x <= bbox.maxX; x += 1) {
        const sourceIdx = (y * image.width + x) * 4;
        const alpha = image.data[sourceIdx + 3];
        if (alpha <= 0) continue;
        const outputIdx = ((y - bbox.minY) * output.width + (x - bbox.minX)) * 4;
        output.data[outputIdx] = image.data[sourceIdx];
        output.data[outputIdx + 1] = image.data[sourceIdx + 1];
        output.data[outputIdx + 2] = image.data[sourceIdx + 2];
        output.data[outputIdx + 3] = alpha;
      }
    }
  }
  const outputPath = fromPublic(dest);
  ensureParent(outputPath);
  writeFileSync(outputPath, PNG.sync.write(output));
};

const cropImagesToPreview = ({ sources, dest, paddingRatio = 0.12 }) => {
  const images = sources.map((source) => {
    const sourcePath = fromPublic(source);
    if (!existsSync(sourcePath)) throw new Error(`Missing preview source asset: ${sourcePath}`);
    return PNG.sync.read(readFileSync(sourcePath));
  });
  cropImageObjectsToPreview({ images, dest, paddingRatio });
};

const cropArtifactToPreview = ({ source, dest, tint, amount, paddingRatio = 0.12 }) => {
  if (!existsSync(source)) throw new Error(`Missing preview source asset: ${source}`);
  const image = PNG.sync.read(readFileSync(source));
  const previewImage = tint ? tintImage({ image: clonePng(image), tint, amount }) : image;
  cropImageObjectsToPreview({ images: [previewImage], dest, paddingRatio });
};

const previewName = (slot, id) => `previews/${slot}-${id}.png`;

const hairAccessoryPreviewSources = {
  'side-ribbon': {
    source: fromArtifact('item-fit-v12-hair-accessory-stability/cutout/hairpin-side-ribbon-stability-fit.png'),
  },
  'lace-band': {
    source: fromArtifact('item-fit-v12-hair-accessory-stability/cutout/headband-slim-lace-stability-fit.png'),
  },
  'flower-clip': {
    source: fromArtifact('item-fit-v17-game-catalog/cutout/hairpin-flower-catalog-fit.png'),
  },
  'tiny-ribbon': {
    source: fromArtifact('item-fit-v11-hair-accessory/cutout/hairband-tiny-ribbon-fit.png'),
  },
  'small-flower': {
    source: fromArtifact('item-fit-v11-hair-accessory/cutout/hairpin-small-flower-fit.png'),
  },
  'pearl-clips': {
    source: fromArtifact('item-fit-v17-game-catalog/cutout/hairpin-round-pearl-catalog-fit.png'),
  },
  'rose-ribbon': {
    source: fromArtifact('item-fit-v12-hair-accessory-stability/cutout/hairpin-side-ribbon-stability-fit.png'),
    tint: [246, 148, 166],
    amount: 0.36,
  },
  'mint-lace': {
    source: fromArtifact('item-fit-v12-hair-accessory-stability/cutout/headband-slim-lace-stability-fit.png'),
    tint: [139, 211, 190],
    amount: 0.36,
  },
  'lavender-flower': {
    source: fromArtifact('item-fit-v17-game-catalog/cutout/hairpin-flower-catalog-fit.png'),
    tint: [177, 153, 221],
    amount: 0.36,
  },
  'blue-ribbon': {
    source: fromArtifact('item-fit-v11-hair-accessory/cutout/hairband-tiny-ribbon-fit.png'),
    tint: [120, 177, 222],
    amount: 0.38,
  },
  tiara: {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-tiara-expanded-fit.png'),
  },
  crown: {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-crown-expanded-fit.png'),
  },
  'big-ribbon': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-big-ribbon-expanded-fit.png'),
  },
  'double-ribbon': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-double-ribbon-expanded-fit.png'),
  },
  'star-pin': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-star-pin-expanded-fit.png'),
  },
  'heart-pin': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-heart-pin-expanded-fit.png'),
  },
  'strawberry-pin': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-strawberry-pin-expanded-fit.png'),
  },
  'butterfly-pin': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-butterfly-pin-expanded-fit.png'),
  },
  'bunny-ears': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-bunny-ears-expanded-fit.png'),
  },
  'sparkle-band': {
    source: fromArtifact('item-fit-v18-expanded-catalog/cutout/hair-sparkle-band-expanded-fit.png'),
  },
};

const addPreviewAssets = (catalog) => {
  ensureDir(PREVIEW_DIR);
  for (const slot of catalog.slots) {
    for (const catalogItem of catalog.catalog[slot]) {
      if (catalogItem.id === 'none') {
        catalogItem.preview = null;
        continue;
      }
      const preview = previewName(slot, catalogItem.id);
      if (slot === 'shoes') {
        cropImagesToPreview({ sources: [catalogItem.left, catalogItem.right], dest: preview, paddingRatio: 0.18 });
      } else if (slot === 'hairAccessory') {
        const previewSource = hairAccessoryPreviewSources[catalogItem.id];
        if (previewSource) {
          cropArtifactToPreview({ ...previewSource, dest: preview, paddingRatio: 0.16 });
        } else {
          cropImagesToPreview({ sources: [catalogItem.src], dest: preview, paddingRatio: 0.16 });
        }
      } else {
        cropImagesToPreview({ sources: [catalogItem.src], dest: preview, paddingRatio: 0.14 });
      }
      catalogItem.preview = preview;
    }
  }
};

const shoe = (id, label, note, left, right) => ({ id, label, note, left, right });
const item = (id, label, note, src) => ({ id, label, note, src });

ensureDir(PUBLIC_DIR);
ensureParent(CATALOG_PATH);

const sourceAssets = [
  {
    dest: 'hairpin-side-ribbon.png',
    source: fromArtifact('item-fit-v12-hair-accessory-stability/normalized/hairpin-side-ribbon-stability-fit.png'),
  },
  {
    dest: 'headband-slim-lace.png',
    source: fromArtifact('item-fit-v12-hair-accessory-stability/normalized/headband-slim-lace-stability-fit.png'),
  },
  {
    dest: 'hairpin-flower.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/hairpin-flower-catalog-fit.png'),
  },
  {
    dest: 'hairband-tiny-ribbon.png',
    source: fromArtifact('item-fit-v11-hair-accessory/normalized/hairband-tiny-ribbon-fit.png'),
  },
  {
    dest: 'hairpin-small-flower.png',
    source: fromArtifact('item-fit-v11-hair-accessory/normalized/hairpin-small-flower-fit.png'),
  },
  {
    dest: 'hairpin-pearl-clips.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/hairpin-round-pearl-catalog-fit.png'),
  },
  {
    dest: 'necklace-inner-shoulder.png',
    source: fromArtifact('item-fit-v8-necklace-reanchor/normalized/necklace-inner-shoulder-line-fit-reanchored.png'),
  },
  {
    dest: 'necklace-tiny-ribbon.png',
    source: fromArtifact('item-fit-v9-accessory-stability/normalized/necklace-tiny-ribbon-stability-fit.png'),
  },
  {
    dest: 'necklace-moon-pearl.png',
    source: fromArtifact('item-fit-v9-accessory-stability/normalized/necklace-moon-pearl-stability-fit.png'),
  },
  {
    dest: 'necklace-pearl.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/necklace-pearl-catalog-fit.png'),
  },
  {
    dest: 'necklace-star.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/necklace-star-catalog-fit.png'),
  },
  {
    dest: 'necklace-flower.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/necklace-flower-catalog-fit.png'),
  },
  {
    dest: 'top-frill-blouse.png',
    source: fromArtifact('item-fit-v13-clothing/normalized/top-frill-blouse-fit.png'),
  },
  {
    dest: 'top-sky-blouse.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/top-sailor-catalog-fit.png'),
  },
  {
    dest: 'top-cream-blouse.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/top-puff-catalog-fit.png'),
  },
  {
    dest: 'top-lace-collar.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/top-lace-collar-catalog-fit.png'),
  },
  {
    dest: 'top-ribbon-vest.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/top-ribbon-vest-catalog-fit.png'),
  },
  {
    dest: 'bottom-long-frill-skirt.png',
    source: fromArtifact('item-fit-v14-long-bottom/normalized/bottom-long-frill-skirt-fit.png'),
  },
  {
    dest: 'bottom-knee-a-line.png',
    source: fromArtifact('item-fit-v14-long-bottom/normalized/bottom-knee-a-line-fit.png'),
  },
  {
    dest: 'bottom-mint-skirt.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/bottom-ribbon-catalog-fit.png'),
  },
  {
    dest: 'bottom-fluffy-skirt.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/bottom-fluffy-long-catalog-fit.png'),
  },
  {
    dest: 'bottom-pleated-skirt.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/bottom-pleated-long-catalog-fit.png'),
  },
  {
    dest: 'boots-ribbon-flat-cuff-left.png',
    source: fromArtifact('item-fit-v16-flat-cuff-boots/normalized/boots-ribbon-flat-cuff-fit-left-opaque.png'),
  },
  {
    dest: 'boots-ribbon-flat-cuff-right.png',
    source: fromArtifact('item-fit-v16-flat-cuff-boots/normalized/boots-ribbon-flat-cuff-fit-right-opaque.png'),
  },
  {
    dest: 'boots-pearl-flat-cuff-left.png',
    source: fromArtifact('item-fit-v16-flat-cuff-boots/normalized/boots-pearl-flat-cuff-fit-left-opaque.png'),
  },
  {
    dest: 'boots-pearl-flat-cuff-right.png',
    source: fromArtifact('item-fit-v16-flat-cuff-boots/normalized/boots-pearl-flat-cuff-fit-right-opaque.png'),
  },
  {
    dest: 'boots-lavender-flat-cuff-left.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-lavender-flat-cuff-catalog-fit-left-opaque.png'),
  },
  {
    dest: 'boots-lavender-flat-cuff-right.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-lavender-flat-cuff-catalog-fit-right-opaque.png'),
  },
  {
    dest: 'boots-rose-button-left.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-rose-flat-cuff-catalog-fit-left-opaque.png'),
  },
  {
    dest: 'boots-rose-button-right.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-rose-flat-cuff-catalog-fit-right-opaque.png'),
  },
  {
    dest: 'boots-ribbon-ankle-left.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-ankle-ribbon-flat-cuff-catalog-fit-left-opaque.png'),
  },
  {
    dest: 'boots-ribbon-ankle-right.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-ankle-ribbon-flat-cuff-catalog-fit-right-opaque.png'),
  },
  {
    dest: 'boots-ribbon-sky-left.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-blue-ribbon-flat-cuff-catalog-fit-left-opaque.png'),
  },
  {
    dest: 'boots-ribbon-sky-right.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-blue-ribbon-flat-cuff-catalog-fit-right-opaque.png'),
  },
  {
    dest: 'boots-rose-mint-left.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-mint-button-flat-cuff-catalog-fit-left-opaque.png'),
  },
  {
    dest: 'boots-rose-mint-right.png',
    source: fromArtifact('item-fit-v17-game-catalog/normalized/boots-mint-button-flat-cuff-catalog-fit-right-opaque.png'),
  },
];

const expandedSimpleAssets = [
  ['hair-tiara.png', 'item-fit-v18-expanded-catalog/normalized/hair-tiara-expanded-fit.png'],
  ['hair-crown.png', 'item-fit-v18-expanded-catalog/normalized/hair-crown-expanded-fit.png'],
  ['hair-big-ribbon.png', 'item-fit-v18-expanded-catalog/normalized/hair-big-ribbon-expanded-fit.png'],
  ['hair-double-ribbon.png', 'item-fit-v18-expanded-catalog/normalized/hair-double-ribbon-expanded-fit.png'],
  ['hair-star-pin.png', 'item-fit-v18-expanded-catalog/normalized/hair-star-pin-expanded-fit.png'],
  ['hair-heart-pin.png', 'item-fit-v18-expanded-catalog/normalized/hair-heart-pin-expanded-fit.png'],
  ['hair-strawberry-pin.png', 'item-fit-v18-expanded-catalog/normalized/hair-strawberry-pin-expanded-fit.png'],
  ['hair-butterfly-pin.png', 'item-fit-v18-expanded-catalog/normalized/hair-butterfly-pin-expanded-fit.png'],
  ['hair-bunny-ears.png', 'item-fit-v18-expanded-catalog/normalized/hair-bunny-ears-expanded-fit.png'],
  ['hair-sparkle-band.png', 'item-fit-v18-expanded-catalog/normalized/hair-sparkle-band-expanded-fit.png'],
  ['necklace-sparkle-choker.png', 'item-fit-v18-expanded-catalog/normalized/necklace-sparkle-choker-expanded-fit.png'],
  ['necklace-gem.png', 'item-fit-v18-expanded-catalog/normalized/necklace-gem-expanded-fit.png'],
  ['necklace-rainbow.png', 'item-fit-v18-expanded-catalog/normalized/necklace-rainbow-expanded-fit.png'],
  ['necklace-strawberry.png', 'item-fit-v18-expanded-catalog/normalized/necklace-strawberry-expanded-fit.png'],
  ['necklace-sakura.png', 'item-fit-v18-expanded-catalog/normalized/necklace-sakura-expanded-fit.png'],
  ['necklace-music.png', 'item-fit-v18-expanded-catalog/normalized/necklace-music-expanded-fit.png'],
  ['necklace-snow.png', 'item-fit-v18-expanded-catalog/normalized/necklace-snow-expanded-fit.png'],
  ['necklace-tea-party.png', 'item-fit-v18-expanded-catalog/normalized/necklace-tea-party-expanded-fit.png'],
  ['top-cape.png', 'item-fit-v18-expanded-catalog/normalized/top-cape-expanded-fit.png'],
  ['top-heart.png', 'item-fit-v18-expanded-catalog/normalized/top-heart-expanded-fit.png'],
  ['top-star.png', 'item-fit-v18-expanded-catalog/normalized/top-star-expanded-fit.png'],
  ['top-flower.png', 'item-fit-v18-expanded-catalog/normalized/top-flower-expanded-fit.png'],
  ['top-strawberry.png', 'item-fit-v18-expanded-catalog/normalized/top-strawberry-expanded-fit.png'],
  ['top-raincoat.png', 'item-fit-v18-expanded-catalog/normalized/top-raincoat-expanded-fit.png'],
  ['top-snow-poncho.png', 'item-fit-v18-expanded-catalog/normalized/top-snow-poncho-expanded-fit.png'],
  ['top-party-jacket.png', 'item-fit-v18-expanded-catalog/normalized/top-party-jacket-expanded-fit.png'],
  ['bottom-sparkle-long.png', 'item-fit-v18-expanded-catalog/normalized/bottom-sparkle-long-expanded-fit.png'],
  ['bottom-heart-long.png', 'item-fit-v18-expanded-catalog/normalized/bottom-heart-long-expanded-fit.png'],
  ['bottom-star-long.png', 'item-fit-v18-expanded-catalog/normalized/bottom-star-long-expanded-fit.png'],
  ['bottom-flower-long.png', 'item-fit-v18-expanded-catalog/normalized/bottom-flower-long-expanded-fit.png'],
  ['bottom-tea-party.png', 'item-fit-v18-expanded-catalog/normalized/bottom-tea-party-expanded-fit.png'],
  ['bottom-rain.png', 'item-fit-v18-expanded-catalog/normalized/bottom-rain-expanded-fit.png'],
  ['bottom-fluffy-warm.png', 'item-fit-v18-expanded-catalog/normalized/bottom-fluffy-warm-expanded-fit.png'],
  ['bottom-princess.png', 'item-fit-v18-expanded-catalog/normalized/bottom-princess-expanded-fit.png'],
  ['bottom-ribbon-long.png', 'item-fit-v18-expanded-catalog/normalized/bottom-ribbon-long-expanded-fit.png'],
];

const expandedBoots = [
  ['boots-rain', 'boots-rain-expanded-fit'],
  ['boots-star', 'boots-star-expanded-fit'],
  ['boots-heart', 'boots-heart-expanded-fit'],
  ['boots-flower', 'boots-flower-expanded-fit'],
  ['boots-fluffy', 'boots-fluffy-expanded-fit'],
  ['boots-snow', 'boots-snow-expanded-fit'],
  ['boots-strawberry', 'boots-strawberry-expanded-fit'],
  ['boots-bunny', 'boots-bunny-expanded-fit'],
  ['boots-princess', 'boots-princess-expanded-fit'],
  ['boots-sparkle', 'boots-sparkle-expanded-fit'],
];

sourceAssets.push(
  ...expandedSimpleAssets.map(([dest, source]) => ({ dest, source: fromArtifact(source) })),
  ...expandedBoots.flatMap(([destPrefix, sourcePrefix]) => [
    {
      dest: `${destPrefix}-left.png`,
      source: fromArtifact(`item-fit-v18-expanded-catalog/normalized/${sourcePrefix}-left-opaque.png`),
    },
    {
      dest: `${destPrefix}-right.png`,
      source: fromArtifact(`item-fit-v18-expanded-catalog/normalized/${sourcePrefix}-right-opaque.png`),
    },
  ])
);

sourceAssets.forEach(copyAsset);

const variants = [
  ['hairpin-side-ribbon.png', 'hairpin-side-ribbon-rose.png', [246, 148, 166], 0.36],
  ['headband-slim-lace.png', 'headband-slim-lace-mint.png', [139, 211, 190], 0.36],
  ['hairpin-flower.png', 'hairpin-flower-lavender.png', [177, 153, 221], 0.36],
  ['hairband-tiny-ribbon.png', 'hairband-tiny-ribbon-blue.png', [120, 177, 222], 0.38],
  ['necklace-inner-shoulder.png', 'necklace-heart-rose.png', [236, 136, 159], 0.34],
  ['necklace-tiny-ribbon.png', 'necklace-ribbon-lavender.png', [174, 148, 218], 0.34],
  ['necklace-moon-pearl.png', 'necklace-moon-sky.png', [121, 179, 219], 0.34],
  ['necklace-pearl.png', 'necklace-pearl-mint.png', [126, 202, 181], 0.32],
  ['necklace-inner-shoulder.png', 'necklace-heart-gold.png', [230, 188, 102], 0.32],
  ['necklace-tiny-ribbon.png', 'necklace-ribbon-cream.png', [238, 204, 143], 0.26],
  ['top-frill-blouse.png', 'top-frill-lavender.png', [181, 154, 220], 0.34],
  ['top-frill-blouse.png', 'top-frill-mint.png', [129, 203, 182], 0.34],
  ['top-frill-blouse.png', 'top-frill-rose.png', [238, 132, 156], 0.28],
  ['top-sky-blouse.png', 'top-sailor-peach.png', [241, 158, 132], 0.34],
  ['top-sky-blouse.png', 'top-sailor-mint.png', [121, 199, 180], 0.34],
  ['top-cream-blouse.png', 'top-puff-pink.png', [238, 140, 170], 0.32],
  ['top-cream-blouse.png', 'top-puff-sky.png', [118, 177, 221], 0.32],
  ['bottom-long-frill-skirt.png', 'bottom-long-frill-lavender.png', [179, 151, 220], 0.34],
  ['bottom-long-frill-skirt.png', 'bottom-long-frill-cream.png', [234, 198, 132], 0.28],
  ['bottom-knee-a-line.png', 'bottom-a-line-sky.png', [124, 184, 224], 0.34],
  ['bottom-knee-a-line.png', 'bottom-a-line-mint.png', [127, 202, 181], 0.34],
  ['bottom-mint-skirt.png', 'bottom-ribbon-rose.png', [236, 139, 163], 0.34],
  ['bottom-mint-skirt.png', 'bottom-ribbon-lavender.png', [178, 151, 220], 0.34],
  ['boots-ribbon-flat-cuff-left.png', 'boots-ribbon-mint-left.png', [121, 198, 176], 0.38],
  ['boots-ribbon-flat-cuff-right.png', 'boots-ribbon-mint-right.png', [121, 198, 176], 0.38],
  ['boots-pearl-flat-cuff-left.png', 'boots-pearl-sky-left.png', [125, 181, 222], 0.36],
  ['boots-pearl-flat-cuff-right.png', 'boots-pearl-sky-right.png', [125, 181, 222], 0.36],
  ['boots-lavender-flat-cuff-left.png', 'boots-lavender-cream-left.png', [231, 196, 131], 0.34],
  ['boots-lavender-flat-cuff-right.png', 'boots-lavender-cream-right.png', [231, 196, 131], 0.34],
];

variants.forEach(([sourceDest, dest, tint, amount]) => makeVariant({ sourceDest, dest, tint, amount }));

const expandedCatalog = {
  hairAccessory: [
    item('tiara', 'ティアラ', 'きらきら ひめ', 'hair-tiara.png'),
    item('crown', 'かんむり', 'ちいさな おうかん', 'hair-crown.png'),
    item('big-ribbon', 'ビッグリボン', 'ふんわり リボン', 'hair-big-ribbon.png'),
    item('double-ribbon', 'ふたつリボン', 'なかよし リボン', 'hair-double-ribbon.png'),
    item('star-pin', 'ほしピン', 'ぴかっと ほし', 'hair-star-pin.png'),
    item('heart-pin', 'ハートピン', 'あまい ハート', 'hair-heart-pin.png'),
    item('strawberry-pin', 'いちごピン', 'あかい いちご', 'hair-strawberry-pin.png'),
    item('butterfly-pin', 'ちょうちょピン', 'ひらひら ちょう', 'hair-butterfly-pin.png'),
    item('bunny-ears', 'うさみみ', 'ぴょこんと かわいい', 'hair-bunny-ears.png'),
    item('sparkle-band', 'きらきらバンド', 'ほうせき きらり', 'hair-sparkle-band.png'),
  ],
  necklace: [
    item('sparkle-choker', 'きらきらチョーカー', 'ほうせき きらり', 'necklace-sparkle-choker.png'),
    item('gem', 'ほうせきネックレス', 'むらさき ほうせき', 'necklace-gem.png'),
    item('rainbow', 'にじいろネックレス', 'いろが たのしい', 'necklace-rainbow.png'),
    item('strawberry', 'いちごネックレス', 'あかい いちご', 'necklace-strawberry.png'),
    item('sakura', 'さくらネックレス', 'さくらの お花', 'necklace-sakura.png'),
    item('music', 'おんぷネックレス', 'うたが すきそう', 'necklace-music.png'),
    item('snow', 'ゆきネックレス', 'ゆきの きらきら', 'necklace-snow.png'),
    item('tea-party', 'ティーネックレス', 'おちゃかい みたい', 'necklace-tea-party.png'),
  ],
  top: [
    item('cape', 'ケープトップス', 'おひめさま ケープ', 'top-cape.png'),
    item('heart', 'ハートブラウス', 'ハート いっぱい', 'top-heart.png'),
    item('star', 'ほしブラウス', 'ほしが きらきら', 'top-star.png'),
    item('flower', 'お花ブラウス', 'お花 いっぱい', 'top-flower.png'),
    item('strawberry', 'いちごトップス', 'いちごが ちょこん', 'top-strawberry.png'),
    item('raincoat', 'レインコート', 'あめのひ へいき', 'top-raincoat.png'),
    item('snow-poncho', 'ゆきポンチョ', 'あったか ゆき', 'top-snow-poncho.png'),
    item('party-jacket', 'パーティージャケット', 'ちょっぴり ごうか', 'top-party-jacket.png'),
  ],
  bottom: [
    item('sparkle-long', 'きらきらロング', 'ほしが ひかる', 'bottom-sparkle-long.png'),
    item('heart-long', 'ハートロング', 'ハート いっぱい', 'bottom-heart-long.png'),
    item('star-long', 'ほしロング', 'ほしが きらり', 'bottom-star-long.png'),
    item('flower-long', 'お花ロング', 'お花が かわいい', 'bottom-flower-long.png'),
    item('tea-party', 'ティーパーティー', 'おちゃかい みたい', 'bottom-tea-party.png'),
    item('rain', 'あめのひスカート', 'しずく もよう', 'bottom-rain.png'),
    item('fluffy-warm', 'ふわもこロング', 'ぬくぬく ロング', 'bottom-fluffy-warm.png'),
    item('princess', 'プリンセス', 'おひめさま みたい', 'bottom-princess.png'),
    item('ribbon-long', 'リボンロング', 'リボンが いっぱい', 'bottom-ribbon-long.png'),
  ],
  shoes: [
    shoe('rain-boots', 'レインブーツ', 'あめでも あんしん', 'boots-rain-left.png', 'boots-rain-right.png'),
    shoe('star-boots', 'ほしブーツ', 'ほしが きらり', 'boots-star-left.png', 'boots-star-right.png'),
    shoe('heart-boots', 'ハートブーツ', 'ハート かわいい', 'boots-heart-left.png', 'boots-heart-right.png'),
    shoe('flower-boots', 'お花ブーツ', 'お花が ちょこん', 'boots-flower-left.png', 'boots-flower-right.png'),
    shoe('fluffy-boots', 'ふわもこブーツ', 'あったか ふわふわ', 'boots-fluffy-left.png', 'boots-fluffy-right.png'),
    shoe('snow-boots', 'ゆきブーツ', 'ゆきの もよう', 'boots-snow-left.png', 'boots-snow-right.png'),
    shoe('strawberry-boots', 'いちごブーツ', 'いちごが かわいい', 'boots-strawberry-left.png', 'boots-strawberry-right.png'),
    shoe('bunny-boots', 'うさぎブーツ', 'ぴょこんと かわいい', 'boots-bunny-left.png', 'boots-bunny-right.png'),
    shoe('princess-boots', 'プリンセスブーツ', 'ひめの ブーツ', 'boots-princess-left.png', 'boots-princess-right.png'),
    shoe('sparkle-boots', 'きらきらブーツ', 'きらっと ひかる', 'boots-sparkle-left.png', 'boots-sparkle-right.png'),
  ],
};

const catalog = {
  assetBase: '/images/games/dressup-next/',
  slots: ['hairAccessory', 'necklace', 'top', 'bottom', 'shoes'],
  slotLabels: {
    hairAccessory: 'かみかざり',
    necklace: 'ネックレス',
    top: 'トップス',
    bottom: 'ボトムス',
    shoes: 'くつ',
  },
  themes: ['おでかけ', 'パーティー', 'おひめさま', 'えんそうかい', 'おたんじょうび'],
  catalog: {
    hairAccessory: [
      item('none', 'なし', 'そのまま', null),
      item('side-ribbon', 'リボンピン', 'みぎがわに ちょこん', 'hairpin-side-ribbon.png'),
      item('lace-band', 'レースカチューシャ', 'やさしい しろ', 'headband-slim-lace.png'),
      item('flower-clip', 'お花クリップ', 'ちいさな お花', 'hairpin-flower.png'),
      item('tiny-ribbon', 'ちびリボン', 'まんなかに ふんわり', 'hairband-tiny-ribbon.png'),
      item('small-flower', '小花ピン', 'あかるい お花', 'hairpin-small-flower.png'),
      item('pearl-clips', 'パールピン', 'きらっと ふたつ', 'hairpin-pearl-clips.png'),
      item('rose-ribbon', 'ローズリボン', 'あまい ピンク', 'hairpin-side-ribbon-rose.png'),
      item('mint-lace', 'ミントレース', 'さわやか レース', 'headband-slim-lace-mint.png'),
      item('lavender-flower', 'ラベンダー花', 'むらさきの お花', 'hairpin-flower-lavender.png'),
      item('blue-ribbon', 'ブルーリボン', 'すっきり ブルー', 'hairband-tiny-ribbon-blue.png'),
      ...expandedCatalog.hairAccessory,
    ],
    necklace: [
      item('none', 'なし', 'そのまま', null),
      item('heart', 'ハートネックレス', 'ちいさな ハート', 'necklace-inner-shoulder.png'),
      item('ribbon', 'リボンネックレス', 'りぼんが かわいい', 'necklace-tiny-ribbon.png'),
      item('moon', 'ムーンパール', 'つきと パール', 'necklace-moon-pearl.png'),
      item('pearl', 'パールネックレス', 'きらっと ひかる', 'necklace-pearl.png'),
      item('star', 'スターネックレス', 'ちいさな ほし', 'necklace-star.png'),
      item('flower', 'お花ネックレス', 'お花が かわいい', 'necklace-flower.png'),
      item('rose-heart', 'ローズハート', 'ピンクの ハート', 'necklace-heart-rose.png'),
      item('lavender-ribbon', 'ラベンダーリボン', 'やさしい むらさき', 'necklace-ribbon-lavender.png'),
      item('sky-moon', 'そらいろムーン', 'さわやか ブルー', 'necklace-moon-sky.png'),
      item('mint-pearl', 'ミントパール', 'みどりの きらきら', 'necklace-pearl-mint.png'),
      item('gold-heart', 'ゴールドハート', 'あたたかい きいろ', 'necklace-heart-gold.png'),
      item('cream-ribbon', 'クリームリボン', 'ふんわり きいろ', 'necklace-ribbon-cream.png'),
      ...expandedCatalog.necklace,
    ],
    top: [
      item('none', 'なし', 'ベース', null),
      item('frill-blouse', 'フリルブラウス', 'ふんわり ピンク', 'top-frill-blouse.png'),
      item('sailor-blouse', 'セーラーブラウス', 'さわやか ブルー', 'top-sky-blouse.png'),
      item('puff-blouse', 'パフブラウス', 'やさしい きいろ', 'top-cream-blouse.png'),
      item('lace-collar', 'レースえり', 'やさしい レース', 'top-lace-collar.png'),
      item('ribbon-vest', 'リボンベスト', 'ミントの リボン', 'top-ribbon-vest.png'),
      item('lavender-frill', 'ラベンダーフリル', 'むらさき フリル', 'top-frill-lavender.png'),
      item('mint-frill', 'ミントフリル', 'さわやか フリル', 'top-frill-mint.png'),
      item('rose-frill', 'ローズフリル', 'あかるい ピンク', 'top-frill-rose.png'),
      item('peach-sailor', 'ピーチセーラー', 'あたたかい セーラー', 'top-sailor-peach.png'),
      item('mint-sailor', 'ミントセーラー', 'みどりの セーラー', 'top-sailor-mint.png'),
      item('pink-puff', 'ピンクパフ', 'かわいい そで', 'top-puff-pink.png'),
      item('sky-puff', 'そらいろパフ', 'ふんわり ブルー', 'top-puff-sky.png'),
      ...expandedCatalog.top,
    ],
    bottom: [
      item('none', 'なし', 'ベース', null),
      item('long-frill', 'ロングフリル', 'ひざくらいまで', 'bottom-long-frill-skirt.png'),
      item('a-line', 'ピンクスカート', 'きれいな Aライン', 'bottom-knee-a-line.png'),
      item('ribbon-skirt', 'リボンスカート', 'ふんわり ミント', 'bottom-mint-skirt.png'),
      item('fluffy-skirt', 'ふわふわスカート', 'やわらか ラベンダー', 'bottom-fluffy-skirt.png'),
      item('pleated-skirt', 'プリーツスカート', 'そらいろ プリーツ', 'bottom-pleated-skirt.png'),
      item('lavender-long', 'ラベンダーロング', 'ながめの フリル', 'bottom-long-frill-lavender.png'),
      item('cream-long', 'クリームロング', 'あたたかい きいろ', 'bottom-long-frill-cream.png'),
      item('sky-a-line', 'そらいろAライン', 'さわやか スカート', 'bottom-a-line-sky.png'),
      item('mint-a-line', 'ミントAライン', 'みどりの スカート', 'bottom-a-line-mint.png'),
      item('rose-ribbon', 'ローズリボン', 'ピンクの リボン', 'bottom-ribbon-rose.png'),
      item('lavender-ribbon', 'ラベンダーリボン', 'むらさき リボン', 'bottom-ribbon-lavender.png'),
      ...expandedCatalog.bottom,
    ],
    shoes: [
      { id: 'none', label: 'なし', note: 'そのまま' },
      shoe('ribbon-boots', 'リボンブーツ', 'あしもと かわいい', 'boots-ribbon-flat-cuff-left.png', 'boots-ribbon-flat-cuff-right.png'),
      shoe('pearl-boots', 'パールブーツ', 'しろくて きれい', 'boots-pearl-flat-cuff-left.png', 'boots-pearl-flat-cuff-right.png'),
      shoe('lavender-boots', 'ラベンダーブーツ', 'むらさき きれい', 'boots-lavender-flat-cuff-left.png', 'boots-lavender-flat-cuff-right.png'),
      shoe('rose-button', 'ローズボタン', 'ボタンが かわいい', 'boots-rose-button-left.png', 'boots-rose-button-right.png'),
      shoe('ankle-ribbon', 'アンクルリボン', 'リボンつき', 'boots-ribbon-ankle-left.png', 'boots-ribbon-ankle-right.png'),
      shoe('mint-ribbon', 'ミントブーツ', 'さわやか みどり', 'boots-ribbon-mint-left.png', 'boots-ribbon-mint-right.png'),
      shoe('sky-pearl', 'そらいろパール', 'ブルーの パール', 'boots-pearl-sky-left.png', 'boots-pearl-sky-right.png'),
      shoe('cream-lavender', 'クリームスター', 'ほしが かわいい', 'boots-lavender-cream-left.png', 'boots-lavender-cream-right.png'),
      shoe('sky-ribbon', 'ブルーリボン', 'すっきり ブルー', 'boots-ribbon-sky-left.png', 'boots-ribbon-sky-right.png'),
      shoe('mint-button', 'ミントボタン', 'みどりの ボタン', 'boots-rose-mint-left.png', 'boots-rose-mint-right.png'),
      ...expandedCatalog.shoes,
    ],
  },
};

addPreviewAssets(catalog);
writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`wrote assets to ${PUBLIC_DIR}`);
console.log(`wrote catalog to ${CATALOG_PATH}`);
