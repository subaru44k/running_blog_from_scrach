import { useEffect, useRef, useState } from 'react';

type CanvasDrawProps = {
  width?: number;
  height?: number;
  disabled?: boolean;
  timeUp?: boolean;
  onFinish?: (dataUrl: string) => void;
  onSnapshot?: (dataUrl: string) => void;
};

const COLORS = [
  { name: 'くろ', value: '#263247' },
  { name: 'あか', value: '#e75b68' },
  { name: 'オレンジ', value: '#e99a35' },
  { name: 'みどり', value: '#269b84' },
  { name: 'あお', value: '#3986dd' },
  { name: 'むらさき', value: '#9168ce' },
] as const;

export default function CanvasDraw({ width = 360, height = 360, disabled, timeUp, onFinish, onSnapshot }: CanvasDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousImageRef = useRef<ImageData | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef(onSnapshot);
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    snapshotRef.current?.(canvas.toDataURL('image/png'));
  }, [height, width]);

  const getContext = () => canvasRef.current?.getContext('2d') || null;

  const savePrevious = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    previousImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setCanUndo(true);
  };

  const setToolStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = tool === 'eraser' ? 20 : 6;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
      y: Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height)),
    };
  };

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = getContext();
    const point = getPoint(event);
    if (!ctx || !point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    savePrevious(ctx);
    setToolStyle(ctx);
    ctx.beginPath();
    ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    drawing.current = true;
    lastPoint.current = point;
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawing.current) return;
    const ctx = getContext();
    const current = getPoint(event);
    const previous = lastPoint.current;
    if (!ctx || !current || !previous) return;
    setToolStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    lastPoint.current = current;
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const canvas = canvasRef.current;
    if (canvas) onSnapshot?.(canvas.toDataURL('image/png'));
  };

  const undo = () => {
    const ctx = getContext();
    if (!ctx || !previousImageRef.current) return;
    ctx.putImageData(previousImageRef.current, 0, 0);
    previousImageRef.current = null;
    setCanUndo(false);
    const canvas = canvasRef.current;
    if (canvas) onSnapshot?.(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const ctx = getContext();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    savePrevious(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    onSnapshot?.(canvas.toDataURL('image/png'));
  };

  const finish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = false;
    lastPoint.current = null;
    const dataUrl = canvas.toDataURL('image/png');
    onSnapshot?.(dataUrl);
    onFinish?.(dataUrl);
  };

  useEffect(() => {
    if (timeUp) finish();
  }, [timeUp]);

  return (
    <div className="mx-auto w-full max-w-[500px] space-y-3">
      <div className="rounded-2xl border border-rose-100 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2" aria-label="ペンの色">
            {COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                title={item.name}
                aria-label={`${item.name}のペン`}
                aria-pressed={tool === 'pen' && color === item.value}
                className={`h-9 w-9 rounded-full border-[3px] border-white shadow-sm ring-2 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 ${tool === 'pen' && color === item.value ? 'ring-rose-500' : 'ring-slate-200 dark:ring-slate-600'}`}
                style={{ backgroundColor: item.value }}
                onClick={() => { setColor(item.value); setTool('pen'); }}
                disabled={disabled}
              />
            ))}
          </div>
          <button
            type="button"
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${tool === 'eraser' ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}
            aria-pressed={tool === 'eraser'}
            onClick={() => setTool('eraser')}
            disabled={disabled}
          >
            消しゴム
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button type="button" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800" onClick={undo} disabled={disabled || !canUndo}>
            ↶ ひとつ戻す
          </button>
          <button type="button" className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" onClick={clearCanvas} disabled={disabled}>
            全消し
          </button>
          <button type="button" className="ml-auto rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50" onClick={finish} disabled={disabled}>
            描けた！
          </button>
        </div>
      </div>
      <div className="draw-canvas-frame mx-auto w-full max-w-[420px] rounded-[1.75rem] p-3 sm:p-4">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          aria-label="お絵かきキャンバス"
          className="aspect-square w-full rounded-2xl bg-white shadow-sm touch-none"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        />
      </div>
    </div>
  );
}
