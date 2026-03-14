import { useEffect, useRef, useState } from 'react';
import { ApiError, getLeaderboard, getPrompt, submitDrawing } from '../../lib/draw/api';
import type { LeaderboardResponse, PromptInfo, SubmitResult } from '../../lib/draw/types';
import ResultCard from './ResultCard';
import Leaderboard from './Leaderboard';
import { buildShareCard, downloadDataUrl } from '../../lib/draw/shareCard';

type ResultState = {
  result?: SubmitResult;
  leaderboard?: LeaderboardResponse;
  error?: string;
};

type JudgeState = 'idle' | 'judging_primary' | 'primary_done' | 'error';

type FirstReviewResult = {
  score: number;
  shortComment: string;
  tips?: string[];
  breakdown?: SubmitResult['breakdown'];
};

const RESULT_VERSION = 'v4-openai-primary-only';

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
  const [state, setState] = useState<ResultState>({});
  const [judgeState, setJudgeState] = useState<JudgeState>('idle');
  const [sharing, setSharing] = useState(false);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const [imageKey, setImageKey] = useState<string>('');
  const [displayScore, setDisplayScore] = useState(0);
  const [firstReview, setFirstReview] = useState<FirstReviewResult | null>(null);
  const [flashMine, setFlashMine] = useState(false);
  const [primarySlow, setPrimarySlow] = useState(false);

  const mineRowRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRef = useRef<HTMLDivElement | null>(null);
  const primaryTimerRef = useRef<number | null>(null);
  const slowTextRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearPrimaryTimers = () => {
    if (primaryTimerRef.current) clearTimeout(primaryTimerRef.current);
    if (slowTextRef.current) clearTimeout(slowTextRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const loadSavedResult = (currentImage: string | null) => {
    try {
      const version = localStorage.getItem('drawResultVersion');
      if (version !== RESULT_VERSION) return null;
      const savedImage = localStorage.getItem('drawImage');
      if (!savedImage || !currentImage || savedImage !== currentImage) return null;
      const raw = localStorage.getItem('drawResult');
      if (!raw) return null;
      return JSON.parse(raw) as SubmitResult;
    } catch {
      return null;
    }
  };

  const buildFirstReview = (result: SubmitResult): FirstReviewResult => {
    const fallbackComment = '勢いがあって気持ちいいです。';
    const shortComment = result.oneLiner?.trim() || fallbackComment;
    const tips = (result.tips || []).map((tip) => tip.trim()).filter(Boolean);
    const fallbackTips = result.score >= 85
      ? ['勢い', 'まとまり', '表情']
      : result.score >= 70
        ? ['雰囲気', '素直さ', '丁寧さ']
        : ['丁寧さ', 'のびのび', '伸びしろ'];
    return {
      score: result.score,
      shortComment,
      tips: (tips.length > 0 ? tips : fallbackTips).slice(0, 3),
      breakdown: result.breakdown,
    };
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
    const month = params.get('month') || undefined;
    const promptIdFromQuery = params.get('promptId') || sessionStorage.getItem('drawPromptId') || 'prompt-unknown';
    setPromptId(promptIdFromQuery);
    setNickname(sessionStorage.getItem('drawNickname') || '');
    setSubmissionId(localStorage.getItem('drawSubmissionId') || '');
    setImageKey(localStorage.getItem('drawImageKey') || '');
    const storedPrompt = getPromptFromStorage();
    if (storedPrompt && (!promptIdFromQuery || storedPrompt.promptId === promptIdFromQuery)) {
      setPrompt(storedPrompt);
      return;
    }
    getPrompt(month)
      .then((value) => {
        setPrompt(value);
        setPromptId(value.promptId);
        sessionStorage.setItem('drawPrompt', JSON.stringify(value));
      })
      .catch(() => setPrompt(null));
  }, []);

  const runPrimary = async () => {
    if (!promptId || !submissionId || !imageKey) {
      setState({ error: '送信情報が見つかりませんでした。もう一度描いてください。' });
      setJudgeState('error');
      return;
    }
    clearPrimaryTimers();
    setPrimarySlow(false);
    setJudgeState('judging_primary');
    setState({});
    setFirstReview(null);

    slowTextRef.current = window.setTimeout(() => setPrimarySlow(true), 2500);
    timeoutRef.current = window.setTimeout(() => {
      setState({ error: '採点に失敗しました。時間をおいて再試行してください。' });
      setJudgeState('error');
    }, 10000);

    const isSlow = Math.random() < 0.1;
    const delay = isSlow
      ? 4000 + Math.floor(Math.random() * 3001)
      : 800 + Math.floor(Math.random() * 1701);

    primaryTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await submitDrawing({
          promptId,
          promptText: prompt?.promptText || localStorage.getItem('drawPromptText') || '',
          submissionId,
          imageKey,
          nickname: nickname || undefined,
        });
        const leaderboard = await getLeaderboard(promptId, 20);
        setFirstReview(buildFirstReview(result));
        setState({ result, leaderboard });
        setJudgeState('primary_done');
        localStorage.setItem('drawResult', JSON.stringify(result));
        localStorage.setItem('drawResultVersion', RESULT_VERSION);
        localStorage.setItem('drawSubmissionId', result.submissionId);
        localStorage.setItem('drawPromptText', prompt?.promptText || '');
        localStorage.setItem('drawScore', String(result.score));
        setSubmissionId(result.submissionId);
      } catch (err: any) {
        const message = err instanceof ApiError && err.status === 429
          ? 'アクセスが集中しています。時間をおいて再試行してください。'
          : err?.message || '採点に失敗しました。';
        setState({ error: message });
        setJudgeState('error');
      } finally {
        clearPrimaryTimers();
      }
    }, delay);
  };

  useEffect(() => {
    if (!imageDataUrl) {
      setState({ error: '絵が見つかりませんでした。もう一度挑戦してください。' });
      setJudgeState('error');
      return;
    }
    if (!promptId) return;
    const saved = loadSavedResult(imageDataUrl);
    if (saved) {
      setFirstReview(buildFirstReview(saved));
      setState({ result: saved });
      getLeaderboard(promptId, 20).then((leaderboard) => {
        setState({ result: saved, leaderboard });
        setJudgeState('primary_done');
        setDisplayScore(saved.score);
      });
      return;
    }
    runPrimary();
    return () => clearPrimaryTimers();
  }, [imageDataUrl, promptId, prompt?.promptText, submissionId, imageKey, nickname]);

  useEffect(() => {
    if (state.result) {
      localStorage.setItem('drawImage', imageDataUrl || '');
    }
  }, [state.result, imageDataUrl]);

  useEffect(() => {
    if (!firstReview) return;
    if (judgeState !== 'primary_done') {
      setDisplayScore(firstReview.score);
      return;
    }
    setDisplayScore(0);
    const target = firstReview.score;
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
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [firstReview, judgeState]);

  const updateName = (value: string) => {
    const trimmed = value.trim().slice(0, 20);
    setNickname(trimmed);
    if (trimmed) {
      sessionStorage.setItem('drawNickname', trimmed);
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
    const next = leaderboardItems.map((item, idx) => ({ ...item, rank: idx + 1 }));
    if (next.some((item) => item.submissionId === state.result?.submissionId)) {
      return next;
    }
    const rank = state.result.rank && state.result.rank <= Math.max(next.length, 1) ? state.result.rank : next.length + 1;
    const insertIndex = Math.max(0, Math.min(rank - 1, next.length));
    next.splice(insertIndex, 0, {
      rank,
      score: state.result.score,
      nickname: displayName,
      submissionId: state.result.submissionId,
      imageDataUrl: imageDataUrl || '',
    });
    return next.slice(0, 20).map((item, idx) => ({ ...item, rank: idx + 1 }));
  })();
  const displayLeaderboard = mergedLeaderboard.map((item) => (
    item.submissionId === submissionId ? { ...item, nickname: displayName } : item
  ));
  const hasMine = submissionId ? displayLeaderboard.some((item) => item.submissionId === submissionId) : false;
  const mineRank = submissionId
    ? displayLeaderboard.find((item) => item.submissionId === submissionId)?.rank
    : undefined;

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

  const rankMessage = state.result ? (() => {
    if (state.result.isRanked) {
      return {
        title: '🎉 ランキング入り！',
        sub: '今日の上位20作品に入りました',
      };
    }
    return {
      title: '今回はランク外（Top20）',
      sub: 'もう一度チャレンジしてみよう！',
    };
  })() : null;

  const retry = () => {
    if (!promptId) return;
    clearPrimaryTimers();
    sessionStorage.removeItem('drawImage');
    localStorage.removeItem('drawImage');
    localStorage.removeItem('drawResult');
    localStorage.removeItem('drawResultVersion');
    localStorage.removeItem('drawSubmissionId');
    localStorage.removeItem('drawScore');
    localStorage.removeItem('drawImageKey');
    sessionStorage.removeItem('drawNickname');
    runPrimary();
  };

  const reloadToPlay = () => {
    if (!promptId) return;
    sessionStorage.removeItem('drawImage');
    localStorage.removeItem('drawImage');
    localStorage.removeItem('drawResult');
    localStorage.removeItem('drawResultVersion');
    localStorage.removeItem('drawSubmissionId');
    localStorage.removeItem('drawScore');
    localStorage.removeItem('drawImageKey');
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

      {judgeState === 'judging_primary' && (
        <>
          <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
            <div>採点中…</div>
            <div className="mt-1">{primarySlow ? '少し丁寧に見ています（自動で表示されます）' : 'あなたの絵を分析しています'}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="h-8 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="mt-3 h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
          </div>
        </>
      )}

      {judgeState === 'error' && state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div>{state.error}</div>
          <button
            type="button"
            className="mt-3 rounded-md bg-red-600 px-3 py-2 text-white"
            onClick={retry}
          >
            再試行
          </button>
        </div>
      )}

      {state.result && imageDataUrl && judgeState === 'primary_done' && firstReview && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <label className="block text-sm font-medium text-gray-700">表示名（任意）</label>
            <input
              type="text"
              value={nickname}
              maxLength={20}
              className="mt-2 w-full rounded border px-3 py-2"
              placeholder="匿名"
              onChange={(e) => updateName(e.target.value.replace(/\n/g, ''))}
            />
            <div className="mt-1 text-xs text-gray-500">入力しなければ匿名のまま表示されます</div>
          </div>

          <ResultCard
            imageDataUrl={imageDataUrl}
            score={displayScore}
            shortComment={firstReview.shortComment}
            tips={firstReview.tips}
            breakdown={firstReview.breakdown}
          />

          {rankMessage && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="text-lg font-semibold">{rankMessage.title}</div>
              {rankMessage.sub && <div className="text-sm text-gray-600">{rankMessage.sub}</div>}
              {hasMine && (
                <button
                  type="button"
                  className="mt-3 text-sm text-blue-700 underline"
                  onClick={() => {
                    mineRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setFlashMine(true);
                    window.setTimeout(() => setFlashMine(false), 1200);
                  }}
                >
                  ランキングで自分の順位を見る
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ml-auto rounded-md bg-gray-900 px-4 py-2 text-white"
              onClick={handleShare}
              disabled={sharing || judgeState === 'judging_primary'}
            >
              {sharing ? '共有画像を生成中…' : '共有画像を保存'}
            </button>
            <a
              className="rounded-md px-4 py-2 ring-1 ring-inset ring-gray-300"
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
        {state.result && hasMine && (
          <div className="flex items-center gap-3 rounded-lg border bg-blue-50 p-3">
            <div className="text-sm font-semibold">あなたは {mineRank ?? state.result.rank} 位です</div>
            <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">TOP20</span>
            <button
              type="button"
              className="ml-auto text-sm text-blue-700 underline"
              onClick={() => mineRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              自分の行へ移動
            </button>
          </div>
        )}
        {state.result && !hasMine && (
          <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
            <div className="font-semibold">あなたの記録</div>
            <div className="mt-1">{displayName}・{state.result.score}点</div>
            <div className="text-xs text-gray-500">ランキングには入りませんでした（Top20）</div>
          </div>
        )}
        {state.leaderboard ? (
          <div className="space-y-3" ref={leaderboardRef}>
            <Leaderboard
              items={displayLeaderboard}
              highlightId={submissionId}
              mineRef={mineRowRef}
              flashMine={flashMine}
            />
          </div>
        ) : (
          <div className="text-sm text-gray-500">読み込み中…</div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="w-full rounded-md bg-blue-600 px-5 py-3 text-white md:w-auto"
          onClick={reloadToPlay}
          disabled={judgeState === 'judging_primary'}
        >
          もう一度描く（今日のお題）
        </button>
      </div>
    </div>
  );
}
