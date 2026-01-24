import { PNG } from 'pngjs';

export const computeInkRatio = (buffer: Buffer) => {
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const total = width * height;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a <= 10) continue;
    if (r >= 245 && g >= 245 && b >= 245) continue;
    ink += 1;
  }
  return total === 0 ? 0 : ink / total;
};

export const isInkGateFail = (ratio: number, threshold = 0.001) => ratio < threshold;
