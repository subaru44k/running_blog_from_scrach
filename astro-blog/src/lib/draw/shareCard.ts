const WIDTH = 1200;
const HEIGHT = 630;

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split('');
  const lines: string[] = [];
  let line = '';
  words.forEach((ch) => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
};

export async function buildShareCard(params: {
  promptText: string;
  score: number;
  oneLiner: string;
  imageDataUrl: string;
}): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvasが初期化できません');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 40px sans-serif';
  const promptLines = wrapText(ctx, params.promptText, 1000).slice(0, 2);
  promptLines.forEach((line, idx) => {
    ctx.fillText(line, 80, 90 + idx * 48);
  });

  const image = await loadImage(params.imageDataUrl);
  const imageBox = { x: 120, y: 160, w: 420, h: 420 };
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 4;
  ctx.strokeRect(imageBox.x - 8, imageBox.y - 8, imageBox.w + 16, imageBox.h + 16);
  ctx.drawImage(image, imageBox.x, imageBox.y, imageBox.w, imageBox.h);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 88px sans-serif';
  ctx.fillText(`${params.score}点`, 620, 320);

  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#374151';
  const oneLinerLines = wrapText(ctx, params.oneLiner, 500).slice(0, 2);
  oneLinerLines.forEach((line, idx) => {
    ctx.fillText(line, 620, 380 + idx * 36);
  });

  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('subaru-is-running.com/draw', 620, 520);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
