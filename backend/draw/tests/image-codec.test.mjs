import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { PNG } from 'pngjs';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(new URL('../../../astro-blog/package.json', import.meta.url));
const sharp = require('sharp');
const dir = await mkdtemp(join(tmpdir(), 'draw-webp-test-'));
after(() => rm(dir, { recursive: true, force: true }));
const outfile = join(dir, 'image.cjs');
await build({ entryPoints: [resolve(root, 'src/lib/image.ts')], bundle: true, platform: 'node', target: 'node20', format: 'cjs', loader: { '.wasm': 'binary' }, outfile });
const { asPng } = createRequire(import.meta.url)(outfile);
const fixture = (blank) => {
  const png = new PNG({ width: 32, height: 32 });
  png.data.fill(255);
  if (!blank) for (let y = 6; y < 26; y++) for (let x = 14; x < 18; x++) {
    const i = (y * 32 + x) * 4;
    png.data[i] = 38; png.data[i + 1] = 50; png.data[i + 2] = 71;
  }
  return PNG.sync.write(png);
};
test('existing PNG is returned unchanged; invalid image is rejected', async () => {
  const png = fixture(false);
  assert.strictEqual(await asPng(png), png);
  await assert.rejects(asPng(Buffer.from('not an image')));
  await assert.rejects(asPng(Buffer.from('RIFFxxxxWEBPbroken')));
});
test('bundled Lambda decoder works offline for lossy and lossless WebP', async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('Decoder must not download its WASM'); };
  try {
    for (const blank of [true, false]) for (const lossless of [true, false]) {
      const png = fixture(blank);
      const webp = await sharp(png).webp({ lossless, quality: 90 }).toBuffer();
      const decoded = PNG.sync.read(await asPng(webp));
      const reference = await sharp(webp).ensureAlpha().raw().toBuffer();
      assert.equal(decoded.width, 32);
      assert.equal(decoded.height, 32);
      assert.deepEqual(decoded.data, reference);
      if (lossless) assert.deepEqual(decoded.data, PNG.sync.read(png).data);
      let ink = 0;
      for (let i = 0; i < decoded.data.length; i += 4) {
        const [r, g, b, a] = decoded.data.subarray(i, i + 4);
        if (a > 10 && !(r >= 245 && g >= 245 && b >= 245)) ink++;
      }
      assert.equal(ink / 1024 < 0.001, blank);
    }
  } finally { globalThis.fetch = priorFetch; }
});
