import { useEffect, useMemo, useState } from 'react';
import CanvasDraw from './CanvasDraw';
import Timer from './Timer';
import { ApiError, getUploadUrl, putToS3, submitDrawing } from '../../lib/draw/api';

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
  const [status, setStatus] = useState<'idle' | 'uploading' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

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

  const finish = async (dataUrl?: string) => {
    if (finished) return;
    const url = dataUrl || imageDataUrl;
    if (!url || !prompt?.promptId) return;
    setFinished(true);
    setStatus('uploading');
    setError(null);
    sessionStorage.setItem('drawImage', url);
    sessionStorage.setItem('drawPromptId', prompt.promptId);
    try {
      const upload = await getUploadUrl(prompt.promptId);
      const blob = await (await fetch(url)).blob();
      await putToS3(upload.putUrl, blob, 'image/png');
      setStatus('submitting');
      const nickname = sessionStorage.getItem('drawNickname') || undefined;
      const result = await submitDrawing({
        promptId: prompt.promptId,
        promptText: prompt.promptText,
        submissionId: upload.submissionId,
        imageKey: upload.imageKey,
        nickname: nickname || undefined,
      });
      localStorage.setItem('drawResult', JSON.stringify(result));
      localStorage.setItem('drawResultVersion', 'v3-judge-flow');
      localStorage.setItem('drawSubmissionId', result.submissionId);
      localStorage.setItem('drawScore', String(result.score));
      localStorage.setItem('drawPromptText', prompt.promptText);
      localStorage.setItem('drawImageKey', upload.imageKey);
      localStorage.setItem('drawImage', url);
      const params = new URLSearchParams({ promptId: prompt.promptId });
      window.location.href = `/draw/result?${params.toString()}`;
    } catch (err: any) {
      let message = '送信に失敗しました。時間をおいて再試行してください。';
      if (err instanceof ApiError && err.status === 429) {
        message = 'アクセスが集中しています。時間をおいて再試行してください。';
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
      setStatus('error');
    }
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
      {status !== 'idle' && (
        <div className="rounded-lg border bg-white p-3 text-sm text-gray-700">
          {status === 'uploading' && <div>アップロード中…</div>}
          {status === 'submitting' && <div>提出中…</div>}
          {status === 'error' && (
            <div className="space-y-2">
              <div className="text-red-600">{error}</div>
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-gray-900 text-white"
                onClick={() => finish(imageDataUrl || undefined)}
              >
                再試行
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
