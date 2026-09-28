import { useEffect, useMemo, useState } from 'react';
import { getLeaderboard, getPrompt, getSubmissionDetail } from '../../lib/draw/api';
import type { LeaderboardItem, SubmissionDetail } from '../../lib/draw/types';
import { getSavedReviewMode, saveReviewMode, type ReviewMode } from '../../lib/draw/reviewMode';

type MonthEntry = {
  month: string;
  promptId: string;
  promptText: string;
  items: LeaderboardItem[];
  loading: boolean;
  error?: string;
};

const START_MONTH = '2026-02';

const toMonthKey = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const monthRange = (startMonth: string, endMonth: string) => {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const months: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      y += 1;
      m = 1;
    }
  }
  return months.reverse();
};

const previousMonthJst = () => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(1);
  jst.setUTCMonth(jst.getUTCMonth() - 1);
  return toMonthKey(jst);
};

export default function DrawArchive() {
  const [entries, setEntries] = useState<Record<string, MonthEntry>>({});
  const [selected, setSelected] = useState<{ promptId: string; submissionId: string; rank: number } | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const [reviewMode, setReviewMode] = useState<ReviewMode>('standard');
  const months = useMemo(() => monthRange(START_MONTH, previousMonthJst()), []);

  useEffect(() => {
    setReviewMode(getSavedReviewMode());
  }, []);

  const updateReviewMode = (mode: ReviewMode) => {
    setReviewMode(mode);
    saveReviewMode(mode);
  };

  useEffect(() => {
    let mounted = true;
    months.forEach((month) => {
      setEntries((prev) => ({
        ...prev,
        [month]: {
          month,
          promptId: '',
          promptText: '',
          items: [],
          loading: true,
        },
      }));

      (async () => {
        try {
          const prompt = await getPrompt(month);
          const board = await getLeaderboard(prompt.promptId, 20);
          if (!mounted) return;
          setEntries((prev) => ({
            ...prev,
            [month]: {
              month,
              promptId: prompt.promptId,
              promptText: prompt.promptText,
              items: board.items,
              loading: false,
            },
          }));
        } catch (err: any) {
          if (!mounted) return;
          setEntries((prev) => ({
            ...prev,
            [month]: {
              month,
              promptId: '',
              promptText: '',
              items: [],
              loading: false,
              error: err?.message || '取得に失敗しました',
            },
          }));
        }
      })();
    });
    return () => {
      mounted = false;
    };
  }, [months]);

  useEffect(() => {
    if (!selected) return undefined;
    let mounted = true;
    setDetail(null);
    setDetailError(undefined);
    setDetailLoading(true);
    getSubmissionDetail(selected.promptId, selected.submissionId)
      .then((response) => {
        if (!mounted) return;
        setDetail(response);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setDetailError(err?.message || '詳細の取得に失敗しました');
      })
      .finally(() => {
        if (!mounted) return;
        setDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const formatCreatedAt = (value: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).format(parsed);
  };

  return (
    <div className="space-y-6">
      <div className="draw-prompt-card rounded-[1.75rem] p-5 sm:p-6">
        <div className="text-xs font-bold tracking-[0.16em] text-rose-700 dark:text-rose-300">みんなの30秒アート</div>
        <h1 className="mb-0 mt-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">みんなの作品ギャラリー</h1>
        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">同じお題でも、絵はこんなに違う。</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          2026年2月から前月までの確定済み月次ランキング上位20件です。作品を選ぶと、絵と講評を詳しく見られます。
        </p>
      </div>
      <fieldset className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
        <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{reviewMode === 'child' ? 'こうひょうの ひょうじ' : '講評の表示'}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            { value: 'child' as const, label: 'こどもむけ' },
            { value: 'standard' as const, label: 'おとなむけ' },
          ]).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={reviewMode === option.value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${reviewMode === option.value ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-700 hover:border-teal-400 dark:border-slate-600 dark:text-slate-200'}`}
              onClick={() => updateReviewMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      {months.map((month) => {
        const entry = entries[month];
        const [year, monthNumber] = month.split('-');
        return (
          <section key={month} className="draw-album rounded-[1.75rem] p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-rose-500 px-3 py-2 text-center text-white shadow-sm">
                  <div className="text-[10px] font-bold tracking-wider">{year}</div>
                  <div className="text-xl font-black leading-none">{Number(monthNumber)}月</div>
                </div>
                <div>
                  <div className="text-xs font-bold tracking-wider text-teal-700 dark:text-teal-300">MONTHLY GALLERY</div>
                  <h2 className="m-0 text-lg font-bold text-slate-900 dark:text-white">この月の作品 Top20</h2>
                </div>
              </div>
              <a
                href={`/draw/?month=${month}`}
                className="rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-bold text-teal-700 no-underline transition hover:bg-teal-50 dark:border-teal-900 dark:bg-slate-900 dark:text-teal-300"
              >
                このお題で描いてみる →
              </a>
            </div>

            {!entry || entry.loading ? (
              <p className="text-sm text-gray-500">読み込み中…</p>
            ) : entry.error ? (
              <p className="text-sm text-red-600">{entry.error}</p>
            ) : (
              <div className="space-y-4">
                <p className="rounded-xl bg-white/70 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                  お題：<span className="font-bold text-slate-900 dark:text-white">{entry.promptText}</span>
                </p>
                {entry.items.length === 0 ? (
                  <p className="text-sm text-gray-500">投稿データがありません。</p>
                ) : (
                  <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {entry.items.map((item) => (
                      <li key={`${month}-${item.submissionId}`}>
                        <button
                          type="button"
                          className="draw-gallery-card group h-full w-full rounded-2xl p-2 text-left transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                          onClick={() => setSelected({ promptId: entry.promptId, submissionId: item.submissionId, rank: item.rank })}
                        >
                          <div className="relative overflow-hidden rounded-xl bg-white">
                            <img
                              src={item.imageDataUrl}
                              alt={`${item.rank}位の作品`}
                              className="aspect-square w-full object-contain transition group-hover:scale-[1.03]"
                              loading="lazy"
                              decoding="async"
                            />
                            <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-black shadow-sm ${item.rank === 1 ? 'bg-amber-300 text-amber-950' : item.rank === 2 ? 'bg-slate-200 text-slate-800' : item.rank === 3 ? 'bg-orange-200 text-orange-950' : 'bg-white/95 text-slate-700'}`}>
                              {item.rank}{reviewMode === 'child' ? 'ばん' : '位'}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-1 px-1 pt-2">
                            <div className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {item.nickname || '匿名'}
                            </div>
                            <div className="shrink-0 text-xs font-bold text-rose-600 dark:text-rose-300">{item.score}点</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        );
      })}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 transition-opacity duration-200 animate-in fade-in"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="card max-h-[85vh] w-full max-w-3xl overflow-y-auto p-5 md:p-6 transition duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-3"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-submission-title"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
                  {reviewMode === 'child' ? 'らんきんぐの くわしい けっか' : '月別ランキング詳細'}
                </div>
                <h3 id="archive-submission-title" className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {(detail?.rank ?? selected?.rank)
                    ? `${detail?.rank ?? selected?.rank}${reviewMode === 'child' ? 'ばんの え' : '位の作品'}`
                    : reviewMode === 'child' ? 'えの くわしい けっか' : '作品の詳細'}
                </h3>
                {detail?.promptText && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {reviewMode === 'child' ? 'おだい' : 'お題'}: <span className="font-medium">{detail.promptText}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-300/90 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setSelected(null)}
              >
                {reviewMode === 'child' ? 'とじる' : '閉じる'}
              </button>
            </div>

            {detailLoading ? (
              <div className="grid min-h-[420px] gap-6 md:grid-cols-[minmax(0,280px),1fr]">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800" />
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 dark:border-slate-700/80 dark:bg-slate-900/80">
                    <div className="h-7 w-16 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                    <div className="mt-3 h-4 w-32 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                    <div className="h-4 w-[92%] animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                    <div className="h-4 w-[76%] animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((key) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between">
                          <div className="h-3 w-24 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800" />
                          <div className="h-3 w-8 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800" />
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map((key) => (
                      <div key={key} className="h-7 w-24 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-800" />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400" />
                    {reviewMode === 'child' ? 'くわしい けっかを よんでいます…' : '詳細を読み込み中…'}
                  </div>
                </div>
              </div>
            ) : detailError ? (
              <p className="text-sm text-red-600">{detailError}</p>
            ) : detail ? (
              <div className="grid min-h-[420px] gap-6 md:grid-cols-[minmax(0,280px),1fr]">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <img
                      src={detail.imageDataUrl}
                      alt={`${detail.rank ?? selected?.rank ?? ''}位の作品`}
                      className="h-auto w-full rounded-xl object-cover"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-300">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{detail.score}{reviewMode === 'child' ? 'てん' : '点'}</div>
                    {detail.createdAt && (
                      <div className="mt-1 text-xs">投稿: {formatCreatedAt(detail.createdAt)}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                      {reviewMode === 'child'
                        ? detail.childOneLiner || 'げんきな えだね。つぎも のびのび かいてみよう。'
                        : detail.oneLiner}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: reviewMode === 'child' ? 'わかりやすさ' : '伝わりやすさ', value: detail.breakdown.likeness },
                      { label: 'まとまり', value: detail.breakdown.composition },
                      { label: reviewMode === 'child' ? 'くふう' : '工夫', value: detail.breakdown.originality },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {(reviewMode === 'child' ? detail.childTips : detail.tips).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(reviewMode === 'child' ? detail.childTips : detail.tips).map((tip) => (
                        <span
                          key={tip}
                          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-slate-800 dark:text-blue-200"
                        >
                          {tip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
