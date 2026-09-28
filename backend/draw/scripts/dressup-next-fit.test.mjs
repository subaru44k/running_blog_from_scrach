import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { fitStyle, layerFitFor } from '../../../astro-blog/src/lib/games/dressup-next-fit.mjs';

const root = new URL('../../../astro-blog/', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const models = json('src/lib/games/dressup-next-models.json');
const catalog = json('src/lib/games/dressup-next-catalog.json');
const images = new Map();
const png = (src) => {
  if (!images.has(src)) images.set(src, PNG.sync.read(readFileSync(new URL(`public${catalog.assetBase}${src}`, root))));
  return images.get(src);
};
const percent = (value, extent) => parseFloat(value || '0%') * extent / 100;
const transform = (fit, x, y, width, height) => {
  const sx = fit.scaleX ?? fit.scale ?? 1;
  const sy = fit.scaleY ?? fit.scale ?? 1;
  const ox = percent(fit.originX || '50%', width);
  const oy = percent(fit.originY || '50%', height);
  return [ox + (x - ox) * sx + percent(fit.x, width), oy + (y - oy) * sy + percent(fit.y, height)];
};
const alphaAt = (image, fit, x, y) => {
  const [dx, dy] = transform(fit, 0, 0, image.width, image.height);
  const ix = Math.round((x - dx) / (fit.scaleX ?? fit.scale ?? 1));
  const iy = Math.round((y - dy) / (fit.scaleY ?? fit.scale ?? 1));
  if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return 0;
  return image.data[(iy * image.width + ix) * 4 + 3];
};

test('partial item corrections retain model defaults and the individual shoe origin', () => {
  const model = { fit: { layers: { leftShoe: { originX: '44.5%', scaleY: 1.05 }, rightShoe: { originX: '54.5%' } }, items: { shoes: { ribbon: { leftShoe: { x: '-1%' } } } } } };
  assert.deepEqual(layerFitFor(model, 'shoes', 'ribbon', 'leftShoe'), { originX: '44.5%', scaleY: 1.05, x: '-1%' });
  assert.deepEqual(layerFitFor(model, 'shoes', 'ribbon', 'rightShoe'), { originX: '54.5%' });
  assert.match(fitStyle(layerFitFor(model, 'shoes', 'ribbon', 'leftShoe')), /--layer-origin-x:44.5%/);
});

test('model manifest and every catalog asset use the same canvas and valid corrections', () => {
  const size = [1024, 1536];
  for (const model of models) {
    assert.deepEqual([png(model.src).width, png(model.src).height], size);
    for (const [slot, corrections] of Object.entries(model.fit.items || {})) {
      for (const id of Object.keys(corrections)) assert.ok(catalog.catalog[slot].some((item) => item.id === id), `${model.id}/${slot}/${id}`);
    }
    for (const slot of catalog.slots) {
      for (const item of catalog.catalog[slot]) {
        for (const [key, src] of slot === 'shoes' ? [['leftShoe', item.left], ['rightShoe', item.right]] : [[slot, item.src]]) {
          if (!src) continue;
          const im = png(src);
          assert.deepEqual([im.width, im.height], size, src);
          const fit = layerFitFor(model, slot, item.id, key);
          for (const axis of ['x', 'y', 'originX', 'originY']) {
            if (fit[axis] !== undefined) assert.match(fit[axis], /^-?\d+(\.\d+)?%$/, `${model.id}/${item.id}/${axis}`);
          }
          for (const scale of ['scaleX', 'scaleY']) {
            if (fit[scale] !== undefined) assert.ok(Number.isFinite(fit[scale]) && fit[scale] > 0);
          }
        }
      }
    }
  }
});

// Measure the opaque foot silhouette in the original model, then project it
// through exactly the CSS translate/scale/origin order. This catches the old
// full-canvas scaling regression without relying on a screenshot snapshot.
for (const model of models) {
  test(`${model.id}: all twenty pairs cover the toes`, () => {
    const body = png(model.src);
    const feet = [];
    for (let y = 1390; y < body.height; y++) {
      for (let x = 390; x < 610; x++) {
        if (body.data[(y * body.width + x) * 4 + 3] < 240) continue;
        feet.push(transform(model.fit.body, x, y, body.width, body.height));
      }
    }
    assert.ok(feet.length > 1000, 'foot region must not be empty');
    for (const item of catalog.catalog.shoes.filter((item) => item.left)) {
      const left = png(item.left);
      const right = png(item.right);
      const lf = layerFitFor(model, 'shoes', item.id, 'leftShoe');
      const rf = layerFitFor(model, 'shoes', item.id, 'rightShoe');
      const exposed = feet.filter(([x, y]) => Math.max(alphaAt(left, lf, x, y), alphaAt(right, rf, x, y)) < 230).length;
      assert.ok(exposed / feet.length < 0.005, `${model.id}/${item.id}: ${(100 * exposed / feet.length).toFixed(2)}% of toes exposed`);
    }
  });
}
