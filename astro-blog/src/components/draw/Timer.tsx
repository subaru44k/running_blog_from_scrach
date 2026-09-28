import { useEffect, useRef, useState } from 'react';

type TimerProps = {
  seconds: number;
  running: boolean;
  onComplete?: () => void;
};

export default function Timer({ seconds, running, onComplete }: TimerProps) {
  const [left, setLeft] = useState(seconds);
  const triggered = useRef(false);

  useEffect(() => {
    setLeft(seconds);
    triggered.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (left === 0 && !triggered.current) {
      triggered.current = true;
      onComplete?.();
    }
  }, [left, onComplete]);

  return (
    <div className="min-w-20 sm:min-w-32" role="timer" aria-label={`残り${left}秒`}>
      <div className={`text-3xl font-black tabular-nums tracking-tight sm:text-4xl ${left <= 10 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50'}`}>
        {left}<span className="ml-0.5 text-lg font-semibold">秒</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${left <= 10 ? 'bg-rose-500' : 'bg-teal-500'}`}
          style={{ width: `${Math.max(0, Math.min(100, left / seconds * 100))}%` }}
        />
      </div>
    </div>
  );
}
