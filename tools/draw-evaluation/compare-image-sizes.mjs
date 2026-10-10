// Usage: node tools/draw-evaluation/compare-image-sizes.mjs INPUT_DIR NEW_OUTPUT_DIR
// Uses Astro's installed sharp. Original images are never modified.
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
const require = createRequire(new URL('../../astro-blog/package.json', import.meta.url));
const sharp = require('sharp');
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw Error('Usage: compare-image-sizes.mjs INPUT_DIR NEW_OUTPUT_DIR');
const input = resolve(inputArg), output = resolve(outputArg);
async function filesAt(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesAt(path));
    else if (entry.isFile() && /\.png$/i.test(entry.name)) result.push(path);
  }
  return result.sort();
}
const files = await filesAt(input);
if (!files.length) throw Error('No PNG images found; no report generated.');
// Fail if the output exists to preserve previous comparisons.
await mkdir(output);
const rows = [];
for (const [index, file] of files.entries()) {
  const bytes = await readFile(file), metadata = await sharp(bytes).metadata();
  const name = `${String(index + 1).padStart(4, '0')}-${basename(file, extname(file))}`;
  const variants = [{ name: 'original', bytes, width: metadata.width, height: metadata.height }];
  for (const size of ['native', '360']) {
    const pipeline = () => {
      const p = sharp(bytes);
      // Fit within 360x360; never upscale or distort rectangular images.
      return size === '360' ? p.resize(360, 360, { fit: 'inside', withoutEnlargement: true }) : p;
    };
    if (size === '360') {
      const result = await pipeline().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
      variants.push({ name: '360-png', bytes: result.data, width: result.info.width, height: result.info.height });
    }
    for (const quality of ['lossless', 90, 80, 70]) {
      const result = await pipeline().webp(quality === 'lossless' ? { lossless: true, effort: 4 } : { quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      variants.push({ name: `${size}-webp-${quality}`, bytes: result.data, width: result.info.width, height: result.info.height });
    }
  }
  for (const v of variants) {
    const path = `${name}-${v.name}.${v.name.includes('webp') ? 'webp' : 'png'}`;
    await writeFile(join(output, path), v.bytes, { flag: 'wx' });
    rows.push({ image: file, variant: v.name, width: v.width, height: v.height, originalBytes: bytes.length, bytes: v.bytes.length, KiB: +(v.bytes.length / 1024).toFixed(2), reductionPercent: +((1 - v.bytes.length / bytes.length) * 100).toFixed(2), preview: path });
  }
}
const summary = [...new Set(rows.map(r => r.variant))].map(variant => {
  const selected = rows.filter(r => r.variant === variant);
  const total = selected.reduce((s, r) => s + r.bytes, 0), original = selected.reduce((s, r) => s + r.originalBytes, 0);
  const sorted = selected.map(r => r.reductionPercent).sort((a, b) => a - b), midpoint = Math.floor(sorted.length / 2);
  return { variant, count: selected.length, totalBytes: total, meanKiB: +(total / selected.length / 1024).toFixed(2), totalReductionPercent: +((1 - total / original) * 100).toFixed(2), medianReductionPercent: sorted.length % 2 ? sorted[midpoint] : +(0.5 * (sorted[midpoint - 1] + sorted[midpoint])).toFixed(2) };
});
const csv = values => {
  const keys = Object.keys(values[0]);
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  return [keys, ...values.map(r => keys.map(k => r[k]))].map(row => row.map(quote).join(',')).join('\n') + '\n';
};
await writeFile(join(output, 'sizes.csv'), csv(rows), { flag: 'wx' });
await writeFile(join(output, 'summary.csv'), csv(summary), { flag: 'wx' });
await writeFile(join(output, 'report.json'), JSON.stringify({ encoder: 'sharp/libwebp (not browser canvas)', versions: sharp.versions, note: 'PNG360 includes encoder optimization. Lossless means lossless relative to the resized image when resized. Negative reduction means a larger file. Size comparison does not validate AI scoring equivalence.', rows, summary }, null, 2), { flag: 'wx' });
console.table(summary);
console.log(`Saved ${files.length} images and comparison reports to ${output}`);
