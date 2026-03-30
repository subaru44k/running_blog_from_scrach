import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const RAW_DIR = resolve(process.cwd(), 'artifacts/dressup-asset-layers-b');
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-asset-layers-b-normalized');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');
const THRESHOLD = 16;
const CANVAS_SIZE = 1024;

const items = [
  {
    id: 'item-hair-tiara',
    file: 'item-hair-tiara.png',
    slot: 'hair',
    rect: { x: 344, y: 28, w: 340, h: 128 },
    alignY: 'bottom',
  },
  {
    id: 'item-necklace-heart',
    file: 'item-necklace-heart.png',
    slot: 'necklace',
    rect: { x: 392, y: 178, w: 248, h: 120 },
    alignY: 'center',
  },
  {
    id: 'item-top-frill-blouse',
    file: 'item-top-frill-blouse.png',
    slot: 'top',
    rect: { x: 244, y: 152, w: 536, h: 378 },
    alignY: 'center',
  },
  {
    id: 'item-bottom-fluffy-skirt',
    file: 'item-bottom-fluffy-skirt.png',
    slot: 'bottom',
    rect: { x: 230, y: 430, w: 560, h: 328 },
    alignY: 'top',
  },
  {
    id: 'item-shoes-ribbon',
    file: 'item-shoes-ribbon.png',
    slot: 'shoes',
    rect: { x: 388, y: 850, w: 244, h: 126 },
    alignY: 'bottom',
  },
];

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
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
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

mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest = {
  threshold: THRESHOLD,
  canvasSize: CANVAS_SIZE,
  generatedAt: new Date().toISOString(),
  items: [],
};

for (const item of items) {
  const inputPath = resolve(RAW_DIR, item.file);
  const png = readPng(inputPath);
  const bbox = getBBox(png, THRESHOLD);
  if (!bbox) {
    console.error(`No alpha bbox found for ${item.file}`);
    process.exit(1);
  }

  const cropped = cropPng(png, bbox);
  const scale = Math.min(item.rect.w / cropped.width, item.rect.h / cropped.height);
  const targetWidth = Math.max(1, Math.round(cropped.width * scale));
  const targetHeight = Math.max(1, Math.round(cropped.height * scale));
  const resized = resizeNearest(cropped, targetWidth, targetHeight);
  const placed = placeWithinRect(item.rect, targetWidth, targetHeight, item.alignY);

  const out = new PNG({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  composite(out, resized, placed.x, placed.y);

  const outputPath = resolve(OUTPUT_DIR, item.file);
  writeFileSync(outputPath, PNG.sync.write(out));

  manifest.items.push({
    id: item.id,
    file: item.file,
    slot: item.slot,
    rawBBox: bbox,
    anchorRect: item.rect,
    alignY: item.alignY,
    scale,
    outputPlacement: { x: placed.x, y: placed.y, width: targetWidth, height: targetHeight },
  });
  console.log(`normalized ${item.file}`);
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`manifest: ${MANIFEST_PATH}`);
