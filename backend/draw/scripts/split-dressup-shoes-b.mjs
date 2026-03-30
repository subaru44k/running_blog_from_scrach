import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const INPUT_PATH = resolve(process.cwd(), 'artifacts/dressup-asset-layers-b-normalized/item-shoes-ribbon.png');
const OUTPUT_DIR = resolve(process.cwd(), 'artifacts/dressup-asset-layers-b-split');
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json');
const THRESHOLD = 16;

const png = PNG.sync.read(readFileSync(INPUT_PATH));

const alphaAt = (x, y) => png.data[(png.width * y + x) * 4 + 3];

const activeColumns = [];
for (let x = 0; x < png.width; x += 1) {
  let active = false;
  for (let y = 0; y < png.height; y += 1) {
    if (alphaAt(x, y) >= THRESHOLD) {
      active = true;
      break;
    }
  }
  if (active) activeColumns.push(x);
}

if (activeColumns.length === 0) {
  throw new Error('No non-transparent pixels found in shoe layer');
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
  throw new Error(`Expected 2 shoe components, found ${runs.length}`);
}

const copyRange = (startX, endX) => {
  const out = new PNG({ width: png.width, height: png.height });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const srcIdx = ((png.width * y) + x) * 4;
      const dstIdx = srcIdx;
      out.data[dstIdx + 0] = png.data[srcIdx + 0];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
};

const bboxFor = (image) => {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(image.width * y + x) * 4 + 3];
      if (alpha >= THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX >= minX && maxY >= minY
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
};

mkdirSync(OUTPUT_DIR, { recursive: true });

const left = copyRange(runs[0].start, runs[0].end);
const right = copyRange(runs[1].start, runs[1].end);

const leftPath = resolve(OUTPUT_DIR, 'item-shoes-ribbon-left.png');
const rightPath = resolve(OUTPUT_DIR, 'item-shoes-ribbon-right.png');

writeFileSync(leftPath, PNG.sync.write(left));
writeFileSync(rightPath, PNG.sync.write(right));

writeFileSync(
  MANIFEST_PATH,
  JSON.stringify(
    {
      source: 'dressup-asset-layers-b-normalized/item-shoes-ribbon.png',
      threshold: THRESHOLD,
      generatedAt: new Date().toISOString(),
      components: [
        { side: 'left', range: runs[0], bbox: bboxFor(left), file: 'item-shoes-ribbon-left.png' },
        { side: 'right', range: runs[1], bbox: bboxFor(right), file: 'item-shoes-ribbon-right.png' },
      ],
    },
    null,
    2,
  ),
);

console.log(`split shoes saved to ${OUTPUT_DIR}`);
