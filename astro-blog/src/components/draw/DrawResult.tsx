import { useEffect, useRef, useState } from 'react';
import { getLeaderboard, getPrompt, getSecondaryReview, submitDrawing } from '../../lib/draw/apiMock';
import type { LeaderboardResponse, PromptInfo, SecondaryReviewResult, SubmitResult } from '../../lib/draw/types';
import ResultCard from './ResultCard';
import Leaderboard from './Leaderboard';
import { buildShareCard, downloadDataUrl } from '../../lib/draw/shareCard';

type ResultState = {
  result?: SubmitResult;
  leaderboard?: LeaderboardResponse;
  error?: string;
};

type JudgeState =
  | 'idle'
  | 'judging_primary'
  | 'primary_done'
  | 'judging_secondary'
  | 'secondary_done'
  | 'error';

type FirstReviewResult = {
  score: number;
  shortComment: string;
  badges?: string[];
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
  const [state, setState] = useState<ResultState>({});
  const [judgeState, setJudgeState] = useState<JudgeState>('idle');
  const [sharing, setSharing] = useState(false);
  const [promptId, setPromptId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [submissionId, setSubmissionId] = useState<string>('');
  const RESULT_VERSION = 'v3-judge-flow';
  const [displayScore, setDisplayScore] = useState(0);
  const [firstReview, setFirstReview] = useState<FirstReviewResult | null>(null);
  const [secondaryComment, setSecondaryComment] = useState<string | null>(null);
  const [flashMine, setFlashMine] = useState(false);
  const [primarySlow, setPrimarySlow] = useState(false);

  const mineRowRef = useRef<HTMLDivElement | null>(null);
  const leaderboardRef = useRef<HTMLDivElement | null>(null);
  const primaryTimerRef = useRef<number | null>(null);
  const slowTextRef = useRef<number | null>(null);
  const secondaryTimerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const secondaryStartedRef = useRef(false);

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

  const truncateText = (text: string, limit = 70) => {
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
  };

  const buildFirstReview = (result: SubmitResult): FirstReviewResult => {
    const fallbackComment = '勢いがあって気持ちいいです。';
    const shortComment = truncateText(result.oneLiner?.trim() || fallbackComment, 70);
    const tips = (result.tips || []).map((tip) => tip.trim()).filter(Boolean);
    const fallbackBadges = result.score >= 85
      ? ['勢い', 'まとまり']
      : result.score >= 70
        ? ['雰囲気', '素直さ']
        : ['丁寧さ', 'のびのび'];
    const badges = (tips.length > 0 ? tips : fallbackBadges).slice(0, 2);
    return { score: result.score, shortComment, badges };
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

  const clearPrimaryTimers = () => {
    if (primaryTimerRef.current) clearTimeout(primaryTimerRef.current);
    if (slowTextRef.current) clearTimeout(slowTextRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const clearSecondaryTimers = () => {
    if (secondaryTimerRef.current) clearTimeout(secondaryTimerRef.current);
  };

  const runPrimary = async () => {
    if (!imageDataUrl || !promptId) return;
    clearPrimaryTimers();
    secondaryStartedRef.current = false;
    setPrimarySlow(false);
    setJudgeState('judging_primary');
    setState({});
    setFirstReview(null);
    setSecondaryComment(null);

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
        const result = await submitDrawing({ promptId, imageDataUrl });
        setFirstReview(buildFirstReview(result));
        const leaderboard = await getLeaderboard(promptId, 20);
        setState({ result, leaderboard });
        setJudgeState('primary_done');
        localStorage.setItem('drawResult', JSON.stringify(result));
        localStorage.setItem('drawResultVersion', RESULT_VERSION);
        localStorage.setItem('drawSubmissionId', result.submissionId);
        setSubmissionId(result.submissionId);
        localStorage.setItem('drawPromptText', prompt?.promptText || '');
        localStorage.setItem('drawScore', String(result.score));
      } catch (err: any) {
        setState({ error: err?.message || '採点に失敗しました。' });
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
      if (saved.isRanked) {
        setSecondaryComment(null);
      }
      setState({ result: saved });
      getLeaderboard(promptId, 20).then((leaderboard) => {
        setState({ result: saved, leaderboard });
        setJudgeState('secondary_done');
        setDisplayScore(saved.score);
      });
      return;
    }
    runPrimary();
    return () => {
      clearPrimaryTimers();
      clearSecondaryTimers();
    };
  }, [imageDataUrl, promptId, prompt?.promptText]);

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

  useEffect(() => {
    if (!state.result || !state.result.isRanked) return;
    if (judgeState !== 'primary_done') return;
    if (secondaryStartedRef.current) return;
    secondaryStartedRef.current = true;
    setJudgeState('judging_secondary');
    const delay = 2500 + Math.floor(Math.random() * 3501);
    secondaryTimerRef.current = window.setTimeout(() => {
      getSecondaryReview({
        promptId: promptId || '',
        submissionId: state.result?.submissionId || '',
        score: state.result?.score || 0,
      })
        .then((review: SecondaryReviewResult) => {
          if (review?.enrichedComment) {
            setSecondaryComment(truncateText(review.enrichedComment, 120));
          }
          setJudgeState('secondary_done');
          setFlashMine(true);
          const flashTimer = window.setTimeout(() => setFlashMine(false), 1200);
          secondaryTimerRef.current = flashTimer;
        })
        .catch(() => {
          setSecondaryComment(null);
          setJudgeState('primary_done');
        });
    }, delay);
    return () => {
      clearSecondaryTimers();
    };
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

  useEffect(() => {
    if (!hasMine || !mineRowRef.current || !leaderboardRef.current) return;
    if (judgeState !== 'secondary_done') return;
    const flagKey = 'draw_result_autoscrolled';
    if (sessionStorage.getItem(flagKey)) return;
    const rect = leaderboardRef.current.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (inView) return;
    sessionStorage.setItem(flagKey, 'true');
    mineRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashMine(true);
    const timer = setTimeout(() => setFlashMine(false), 1200);
    return () => clearTimeout(timer);
  }, [hasMine, displayLeaderboard.length, judgeState]);

  const retry = () => {
    if (!promptId) return;
    clearPrimaryTimers();
    clearSecondaryTimers();
    sessionStorage.removeItem('drawImage');
    localStorage.removeItem('drawImage');
    localStorage.removeItem('drawResult');
    localStorage.removeItem('drawResultVersion');
    localStorage.removeItem('drawSubmissionId');
    localStorage.removeItem('drawScore');
    sessionStorage.removeItem('drawNickname');
    sessionStorage.removeItem('draw_result_autoscrolled');
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
    sessionStorage.removeItem('drawNickname');
    sessionStorage.removeItem('draw_result_autoscrolled');
    const params = new URLSearchParams({ promptId });
    window.location.href = `/draw/play?${params.toString()}`;
  };

  const showPrimaryResult = judgeState === 'primary_done' || judgeState === 'judging_secondary' || judgeState === 'secondary_done';
  const displayComment = judgeState === 'secondary_done'
    ? secondaryComment || firstReview?.shortComment || ''
    : firstReview?.shortComment || '';

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gray-50 p-4">
        <div className="text-xs text-gray-500">今日のお題</div>
        <div className="text-lg font-semibold">{prompt?.promptText || '読み込み中…'}</div>
      </div>

      {judgeState === 'judging_primary' && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-600">
          <div>採点中…</div>
          <div className="mt-1">{primarySlow ? '少し丁寧に見ています（自動で表示されます）' : 'あなたの絵を分析しています'}</div>
        </div>
      )}

      {judgeState === 'judging_primary' && (
        <div className="rounded-lg border bg-white p-4">
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="mt-3 h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        </div>
      )}

      {judgeState === 'error' && state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div>{state.error}</div>
          <button
            type="button"
            className="mt-3 px-3 py-2 rounded-md bg-red-600 text-white"
            onClick={retry}
          >
            再試行
          </button>
        </div>
      )}

      {state.result && imageDataUrl && showPrimaryResult && firstReview && (
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
            imageDataUrl={imageDataUrl}
            score={displayScore}
            shortComment={firstReview.shortComment}
            richComment={displayComment}
            badges={firstReview.badges}
            secondaryPending={judgeState === 'judging_secondary'}
            showRichComment={judgeState === 'secondary_done'}
          />

          {rankMessage && (!state.result.isRanked || judgeState === 'secondary_done') && (
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
              disabled={sharing || judgeState === 'judging_primary'}
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
        {state.result && hasMine && (
          <div className="flex items-center gap-3 rounded-lg border bg-blue-50 p-3">
            <div className="text-sm font-semibold">あなたは {state.result.rank} 位です</div>
            <span className="text-xs font-semibold rounded-full bg-blue-600 text-white px-2 py-1">TOP20</span>
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
          className="w-full md:w-auto px-5 py-3 rounded-md bg-blue-600 text-white"
          onClick={reloadToPlay}
          disabled={judgeState === 'judging_primary'}
        >
          もう一度描く（今日のお題）
        </button>
      </div>
    </div>
  );
}
