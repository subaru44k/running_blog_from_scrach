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
  const [status, setStatus] = useState<'idle' | 'uploading' | 'submitting' | 'redirecting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const promptId = params.get('promptId');
    const month = params.get('month');
    const stored = getPromptFromStorage();
    if (stored && (!promptId || stored.promptId === promptId)) {
      setPrompt(stored);
      return;
    }
    if (promptId) {
      const fallback = month ? `30秒でお題(${month})を描いて` : '30秒でお題を描いて';
      setPrompt({ promptId, promptText: fallback });
      return;
    }
  }, []);

  useEffect(() => {
    if (status !== 'uploading' && status !== 'submitting') {
      setIsSlow(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsSlow(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

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
      setStatus('redirecting');
      const params = new URLSearchParams({ promptId: prompt.promptId });
      const month = prompt.promptId.replace(/^prompt-/, '');
      if (/^\d{4}-\d{2}$/.test(month)) params.set('month', month);
      window.location.href = `/draw/result?${params.toString()}`;
    } catch (err: any) {
      let message = '送信に失敗しました。時間をおいて再試行してください。';
      if (err instanceof ApiError && err.status === 429) {
        message = 'アクセスが集中しています。時間をおいて再試行してください。';
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
      setFinished(false);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            {(status === 'uploading' || status === 'submitting' || status === 'redirecting') && (
              <div className="space-y-3">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                <p className="text-center text-base font-medium text-gray-900 dark:text-gray-100">
                  {status === 'uploading' && '画像を送信中…'}
                  {status === 'submitting' && '採点リクエスト送信中…'}
                  {status === 'redirecting' && '結果ページへ移動中…'}
                </p>
                {(status === 'uploading' || status === 'submitting') && (
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                    送信中のため操作できません
                  </p>
                )}
                {isSlow && (status === 'uploading' || status === 'submitting') && (
                  <p className="rounded-md bg-amber-50 p-2 text-center text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    少し時間がかかっています。通信環境により数秒かかる場合があります。
                  </p>
                )}
              </div>
            )}
            {status === 'error' && (
              <div className="space-y-3">
                <p className="text-sm text-red-600">{error}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md bg-gray-900 text-white"
                    onClick={() => finish(imageDataUrl || undefined)}
                  >
                    再試行
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200"
                    onClick={() => {
                      const month = prompt?.promptId?.replace(/^prompt-/, '');
                      if (month && /^\d{4}-\d{2}$/.test(month)) {
                        window.location.href = `/draw/?month=${month}`;
                        return;
                      }
                      window.location.href = '/draw/';
                    }}
                  >
                    お題に戻る
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
