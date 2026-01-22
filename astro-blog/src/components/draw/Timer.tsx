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
    <div className="text-3xl font-semibold text-gray-900">
      {left}s
    </div>
  );
}
