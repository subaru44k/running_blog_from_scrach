import { useEffect, useMemo, useState } from 'react';
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
  const [submissionId, setSubmissionId] = useState<string>('');
  const RESULT_VERSION = 'v2-fixed-90';
  const [displayScore, setDisplayScore] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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

  useEffect(() => {
    if (!state.result) return;
    setDisplayScore(0);
    setShowDetails(false);
    setIsAnimating(true);
    const target = state.result.score;
    const duration = 800;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setDisplayScore(Math.floor(target * progress));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setDisplayScore(target);
        setTimeout(() => {
          setShowDetails(true);
          setIsAnimating(false);
        }, 200);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [state.result]);

  const updateName = (value: string) => {
    const trimmed = value.trim().slice(0, 20);
    const next = trimmed.length === 0 ? '' : trimmed;
    setNickname(next);
    if (next) {
      sessionStorage.setItem('drawNickname', next);
    } else {
      sessionStorage.removeItem('drawNickname');
    }
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

  const displayLeaderboard = mergedLeaderboard.map((item) => (
    item.submissionId === submissionId ? { ...item, nickname: displayName } : item
  ));

  const hasMine = submissionId
    ? displayLeaderboard.some((item) => item.submissionId === submissionId)
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

  const commentPair = useMemo(() => {
    if (!state.result) return { positive: '', improvement: '' };
    const s = state.result.score;
    if (s >= 90) return { positive: '輪郭が整っていて印象が強いです。', improvement: 'もう少し配置を意識すると良いです。' };
    if (s >= 80) return { positive: '形の捉え方が素直で伝わります。', improvement: 'もう少し線に強弱があると良いです。' };
    if (s >= 70) return { positive: '勢いがあって楽しく見えます。', improvement: 'もう少し中心を意識すると良いです。' };
    return { positive: '線が伸びやかで気持ちいいです。', improvement: 'もう少し輪郭を意識すると良いです。' };
  }, [state.result]);

  const rankMessage = state.result ? (() => {
    if (state.result.score >= 75) {
      return {
        title: '🎉 ランキング入り！',
        sub: '今日の上位20作品に入りました',
      };
    }
    const diff = Math.max(0, 75 - state.result.score);
    return {
      title: `あと${diff}点でランキング！`,
      sub: '',
    };
  })() : null;

  const retry = () => {
    if (!promptId) return;
    sessionStorage.removeItem('drawImage');
    localStorage.removeItem('drawImage');
    localStorage.removeItem('drawResult');
    localStorage.removeItem('drawResultVersion');
    localStorage.removeItem('drawSubmissionId');
    localStorage.removeItem('drawScore');
    sessionStorage.removeItem('drawNickname');
    const params = new URLSearchParams({ promptId });
    window.location.href = `/draw/play?${params.toString()}`;
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
          <div className="rounded-lg border bg-white p-4">
            <label className="block text-sm font-medium text-gray-700">表示名（任意）</label>
            <input
              type="text"
              value={nickname}
              maxLength={20}
              className="mt-2 w-full border rounded px-3 py-2"
              placeholder="匿名"
              onChange={(e) => updateName(e.target.value.replace(/\n/g, ''))}
            />
            <div className="mt-1 text-xs text-gray-500">入力しなければ匿名のまま表示されます</div>
          </div>
          <ResultCard
            result={state.result}
            imageDataUrl={imageDataUrl}
            displayScore={displayScore}
            showDetails={showDetails}
            positiveComment={commentPair.positive}
            improvementComment={commentPair.improvement}
          />
          {rankMessage && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-lg font-semibold">{rankMessage.title}</div>
              {rankMessage.sub && <div className="text-sm text-gray-600">{rankMessage.sub}</div>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ml-auto px-4 py-2 rounded-md bg-gray-900 text-white"
              onClick={handleShare}
              disabled={sharing || state.loading || isAnimating}
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
            <Leaderboard items={displayLeaderboard} highlightId={submissionId} />
            {!hasMine && state.result && (
              <div className="border-t pt-3 text-sm text-gray-700">
                あなた：{state.result.score}点（{displayName}）
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500">読み込み中…</div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="w-full md:w-auto px-5 py-3 rounded-md bg-blue-600 text-white"
          onClick={retry}
          disabled={state.loading}
        >
          もう一度描く（今日のお題）
        </button>
      </div>

    </div>
  );
}
