import { useEffect, useState } from 'react';
import { getLeaderboard, getPrompt, submitDrawing } from '../../lib/draw/apiMock';
import type { LeaderboardResponse, PromptInfo, SubmitResult } from '../../lib/draw/types';
import ResultCard from './ResultCard';
import Leaderboard from './Leaderboard';
import { buildShareCard, downloadDataUrl } from '../../lib/draw/shareCard';

type ResultState = {
  loading: boolean;
  result?: SubmitResult;
  leaderboard?: LeaderboardResponse;
  error?: string;
};

const getPromptFromStorage = () => {
  try {
    const raw = sessionStorage.getItem('drawPrompt');
    if (!raw) return null;
    return JSON.parse(raw) as PromptInfo;
  } catch {
    return null;
  }
};

export default function DrawResult() {
  const [prompt, setPrompt] = useState<PromptInfo | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [state, setState] = useState<ResultState>({ loading: true });
  const [sharing, setSharing] = useState(false);
  const [promptId, setPromptId] = useState<string | null>(null);

  useEffect(() => {
    const storedImage = sessionStorage.getItem('drawImage');
    if (storedImage) setImageDataUrl(storedImage);
    const params = new URLSearchParams(window.location.search);
    setPromptId(params.get('promptId') || sessionStorage.getItem('drawPromptId') || 'prompt-unknown');
    const storedPrompt = getPromptFromStorage();
    if (storedPrompt) {
      setPrompt(storedPrompt);
      return;
    }
    getPrompt().then((value) => setPrompt(value)).catch(() => setPrompt(null));
  }, []);

  useEffect(() => {
    if (!imageDataUrl) {
      setState({ loading: false, error: '絵が見つかりませんでした。もう一度挑戦してください。' });
      return;
    }
    if (!promptId) return;
    let mounted = true;
    setState({ loading: true });
    submitDrawing({ promptId, imageDataUrl })
      .then(async (result) => {
        if (!mounted) return;
        const leaderboard = await getLeaderboard(promptId, 20);
        setState({ loading: false, result, leaderboard });
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ loading: false, error: err?.message || '採点に失敗しました。' });
      });
    return () => { mounted = false; };
  }, [imageDataUrl, promptId]);

  const handleShare = async () => {
    if (!prompt || !state.result || !imageDataUrl) return;
    setSharing(true);
    try {
      const dataUrl = await buildShareCard({
        promptText: prompt.promptText,
        score: state.result.score,
        oneLiner: state.result.oneLiner,
        imageDataUrl,
      });
      downloadDataUrl(dataUrl, 'draw-score.png');
    } catch {
      setState((prev) => ({ ...prev, error: '共有画像の生成に失敗しました。' }));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="text-xs text-gray-500">今日のお題</div>
        <div className="text-lg font-semibold">{prompt?.promptText || '読み込み中…'}</div>
      </div>

      {state.loading && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
          採点中… 少しだけお待ちください。
        </div>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state.result && imageDataUrl && (
        <div className="space-y-4">
          <ResultCard result={state.result} imageDataUrl={imageDataUrl} />
          <div className="flex flex-wrap items-center gap-3">
            {state.result.isRanked ? (
              <div className="text-sm font-semibold text-blue-600">
                ランキング入り！ {state.result.rank}位
              </div>
            ) : (
              <div className="text-sm text-gray-600">今回はランク外（75点以上で掲載）</div>
            )}
            <button
              type="button"
              className="ml-auto px-4 py-2 rounded-md bg-gray-900 text-white"
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? '共有画像を生成中…' : '共有画像を保存'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-lg font-semibold">今日のランキング Top20</div>
        {state.leaderboard ? (
          <Leaderboard items={state.leaderboard.items} />
        ) : (
          <div className="text-sm text-gray-500">読み込み中…</div>
        )}
      </div>

      <div className="text-sm">
        <a href="/draw/" className="text-blue-600 underline">もう一度描く</a>
      </div>
    </div>
  );
}
