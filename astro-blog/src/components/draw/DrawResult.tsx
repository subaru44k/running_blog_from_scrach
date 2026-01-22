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
  const [nickname, setNickname] = useState<string>('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const RESULT_VERSION = 'v2-fixed-90';

  const loadSavedResult = () => {
    try {
      const version = localStorage.getItem('drawResultVersion');
      if (version !== RESULT_VERSION) return null;
      const raw = localStorage.getItem('drawResult');
      if (!raw) return null;
      return JSON.parse(raw) as SubmitResult;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const storedImage = sessionStorage.getItem('drawImage');
    if (storedImage) {
      setImageDataUrl(storedImage);
    } else {
      const persistedImage = localStorage.getItem('drawImage');
      if (persistedImage) setImageDataUrl(persistedImage);
    }
    const params = new URLSearchParams(window.location.search);
    setPromptId(params.get('promptId') || sessionStorage.getItem('drawPromptId') || 'prompt-unknown');
    const savedName = sessionStorage.getItem('drawNickname') || '';
    setNickname(savedName);
    setNameInput(savedName);
    const savedSubmissionId = localStorage.getItem('drawSubmissionId') || '';
    setSubmissionId(savedSubmissionId);
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
    const saved = loadSavedResult();
    if (saved) {
      setState({ loading: true, result: saved });
      getLeaderboard(promptId, 20).then((leaderboard) => {
        if (!mounted) return;
        setState({ loading: false, result: saved, leaderboard });
      });
      return () => { mounted = false; };
    }
    setState({ loading: true });
    submitDrawing({ promptId, imageDataUrl })
      .then(async (result) => {
        if (!mounted) return;
        const leaderboard = await getLeaderboard(promptId, 20);
        setState({ loading: false, result, leaderboard });
        localStorage.setItem('drawResult', JSON.stringify(result));
        localStorage.setItem('drawResultVersion', RESULT_VERSION);
        localStorage.setItem('drawSubmissionId', result.submissionId);
        setSubmissionId(result.submissionId);
        localStorage.setItem('drawPromptText', prompt?.promptText || '');
        localStorage.setItem('drawScore', String(result.score));
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ loading: false, error: err?.message || '採点に失敗しました。' });
      });
    return () => { mounted = false; };
  }, [imageDataUrl, promptId, prompt?.promptText]);

  useEffect(() => {
    if (state.result) {
      localStorage.setItem('drawImage', imageDataUrl || '');
      if (!nickname) setShowNameModal(true);
    }
  }, [state.result, nickname, imageDataUrl]);

  const saveName = (value: string) => {
    const trimmed = value.trim().slice(0, 20);
    const next = trimmed.length === 0 ? '' : trimmed;
    setNickname(next);
    setNameInput(next);
    sessionStorage.setItem('drawNickname', next);
    setShowNameModal(false);
  };

  const cancelName = () => {
    setNickname('');
    setNameInput('');
    sessionStorage.setItem('drawNickname', '');
    setShowNameModal(false);
  };

  const handleShare = async () => {
    if (!prompt || !state.result || !imageDataUrl) return;
    setSharing(true);
    try {
      const dataUrl = await buildShareCard({
        promptText: prompt.promptText,
        score: state.result.score,
        nickname: nickname || '匿名',
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

  const displayName = nickname && nickname.length > 0 ? nickname : '匿名';
  const leaderboardItems = state.leaderboard?.items || [];
  const mergedLeaderboard = (() => {
    if (!state.result || !state.result.isRanked) return leaderboardItems;
    const rank = state.result.rank && state.result.rank <= leaderboardItems.length ? state.result.rank : 1;
    const next = leaderboardItems.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
    const insertIndex = Math.max(0, Math.min(rank - 1, next.length - 1));
    next[insertIndex] = {
      rank,
      score: state.result.score,
      nickname: displayName,
      submissionId: state.result.submissionId,
      imageDataUrl: imageDataUrl || next[insertIndex]?.imageDataUrl || '',
    };
    return next;
  })();

  const hasMine = submissionId
    ? mergedLeaderboard.some((item) => item.submissionId === submissionId)
    : false;

  const shareText = (() => {
    if (!state.result || !prompt) return '';
    if (nickname && nickname.trim().length > 0) {
      return `${prompt.promptText} ${state.result.score}点！${displayName} #30秒お絵描き https://subaru-is-running.com/draw/`;
    }
    return `${prompt.promptText} ${state.result.score}点！ #30秒お絵描き https://subaru-is-running.com/draw/`;
  })();

  const shareUrl = shareText
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    : 'https://twitter.com/intent/tweet';

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
            <a
              className="px-4 py-2 rounded-md ring-1 ring-inset ring-gray-300"
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
            >
              Xで投稿
            </a>
          </div>
          <div className="text-xs text-gray-500">※ 共有カード画像は保存して、Xで手動添付してください</div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-lg font-semibold">今日のランキング Top20</div>
        {state.leaderboard ? (
          <div className="space-y-3">
            <Leaderboard items={mergedLeaderboard} highlightId={submissionId} />
            {!hasMine && state.result && (
              <div className="rounded-lg border border-dashed p-3 text-sm text-gray-700">
                あなた：{state.result.score}点（{displayName}）
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">読み込み中…</div>
        )}
      </div>

      <div className="text-sm">
        <a href="/draw/" className="text-blue-600 underline">もう一度描く</a>
      </div>

      {showNameModal && state.result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg space-y-4">
            <div className="text-lg font-semibold">名前を入力（任意）</div>
            <input
              type="text"
              value={nameInput}
              maxLength={20}
              className="w-full border rounded px-3 py-2"
              placeholder="匿名"
              onChange={(e) => setNameInput(e.target.value.replace(/\n/g, ''))}
            />
            <div className="text-xs text-gray-500">1〜20文字。未入力は匿名になります。</div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-md ring-1 ring-inset ring-gray-300"
                onClick={cancelName}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-md bg-blue-600 text-white"
                onClick={() => saveName(nameInput)}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
