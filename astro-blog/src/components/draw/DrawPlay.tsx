import { useEffect, useMemo, useState } from 'react';
import CanvasDraw from './CanvasDraw';
import Timer from './Timer';

const getPromptFromStorage = () => {
  try {
    const raw = sessionStorage.getItem('drawPrompt');
    if (!raw) return null;
    return JSON.parse(raw) as { promptId: string; promptText: string };
  } catch {
    return null;
  }
};

export default function DrawPlay() {
  const [prompt, setPrompt] = useState<{ promptId: string; promptText: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const promptId = params.get('promptId');
    const stored = getPromptFromStorage();
    if (stored && (!promptId || stored.promptId === promptId)) {
      setPrompt(stored);
      return;
    }
    if (promptId) {
      setPrompt({ promptId, promptText: '30秒で熊を描いて' });
      return;
    }
  }, []);

  const finish = (dataUrl?: string) => {
    if (finished) return;
    const url = dataUrl || imageDataUrl;
    if (!url) return;
    setFinished(true);
    sessionStorage.setItem('drawImage', url);
    sessionStorage.setItem('drawPromptId', prompt?.promptId || 'prompt-unknown');
    const params = new URLSearchParams({ promptId: prompt?.promptId || 'prompt-unknown' });
    window.location.href = `/draw/result?${params.toString()}`;
  };

  const onFinish = (dataUrl: string) => {
    setImageDataUrl(dataUrl);
    finish(dataUrl);
  };

  const canvasKey = useMemo(() => prompt?.promptId || 'draw', [prompt?.promptId]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="text-xs text-gray-500">今日のお題</div>
        <div className="text-lg font-semibold">{prompt?.promptText || '読み込み中…'}</div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">残り時間</div>
          <Timer seconds={30} running={!finished} onComplete={() => finish(imageDataUrl || undefined)} />
        </div>
      </div>

      <CanvasDraw
        key={canvasKey}
        disabled={finished}
        onFinish={onFinish}
        onSnapshot={(dataUrl) => setImageDataUrl(dataUrl)}
      />
      <div className="text-xs text-gray-500">※ 30秒で自動終了します。</div>
    </div>
  );
}
