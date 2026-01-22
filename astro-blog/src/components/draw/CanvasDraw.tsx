import { useEffect, useRef, useState } from 'react';

type CanvasDrawProps = {
  width?: number;
  height?: number;
  disabled?: boolean;
  onFinish?: (dataUrl: string) => void;
  onSnapshot?: (dataUrl: string) => void;
};

export default function CanvasDraw({ width = 360, height = 360, disabled, onFinish, onSnapshot }: CanvasDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef(onSnapshot);

  useEffect(() => {
    snapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const displayWidth = rect.width || width;
    const displayHeight = rect.height || height;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    snapshotRef.current?.(canvas.toDataURL('image/png'));
  }, [height, width]);

  const getContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const setToolStyle = (ctx: CanvasRenderingContext2D) => {
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 14;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111827';
    }
  };

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const point = getPoint(e);
    if (!point) return;
    drawing.current = true;
    lastPoint.current = point;
  };

  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !drawing.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const current = getPoint(e);
    if (!current) return;
    const prev = lastPoint.current;
    if (!prev) {
      lastPoint.current = current;
      return;
    }
    setToolStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    lastPoint.current = current;
  };

  const pointerUp = () => {
    drawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas && onSnapshot) {
      onSnapshot(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSnapshot?.(canvas.toDataURL('image/png'));
  };

  const finish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSnapshot?.(dataUrl);
    onFinish?.(dataUrl);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ring-1 ring-inset ${tool === 'pen' ? 'bg-gray-900 text-white ring-gray-900' : 'ring-gray-300 text-gray-700'}`}
          onClick={() => setTool('pen')}
          disabled={disabled}
        >
          ペン
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-sm ring-1 ring-inset ${tool === 'eraser' ? 'bg-gray-900 text-white ring-gray-900' : 'ring-gray-300 text-gray-700'}`}
          onClick={() => setTool('eraser')}
          disabled={disabled}
        >
          消しゴム
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded-md text-sm ring-1 ring-inset ring-gray-300 text-gray-700"
          onClick={clearCanvas}
          disabled={disabled}
        >
          全消し
        </button>
        <button
          type="button"
          className="ml-auto px-3 py-1 rounded-md text-sm bg-blue-600 text-white"
          onClick={finish}
          disabled={disabled}
        >
          終了
        </button>
      </div>
      <div className="rounded-lg border border-gray-300 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto touch-none"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={pointerUp}
        />
      </div>
    </div>
  );
}
