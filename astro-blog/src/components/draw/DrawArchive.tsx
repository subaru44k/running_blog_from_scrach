import { useEffect, useMemo, useState } from 'react';
import { getLeaderboard, getPrompt, getSubmissionDetail } from '../../lib/draw/api';
import type { LeaderboardItem, SubmissionDetail } from '../../lib/draw/types';

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

const currentMonthJst = () => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return toMonthKey(jst);
};

export default function DrawArchive() {
  const [entries, setEntries] = useState<Record<string, MonthEntry>>({});
  const [selected, setSelected] = useState<{ promptId: string; submissionId: string } | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const months = useMemo(() => monthRange(START_MONTH, currentMonthJst()), []);

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
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        2026年2月以降の月次ランキング上位20件を表示します。気になる作品はカードを押すと詳しく見られます。
      </p>
      {months.map((month) => {
        const entry = entries[month];
        return (
          <section key={month} className="card p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{month} のTop20</h2>
              <a
                href={`/draw/?month=${month}`}
                className="text-xs text-blue-700 hover:underline dark:text-blue-300"
              >
                この月のお題で遊ぶ
              </a>
            </div>

            {!entry || entry.loading ? (
              <p className="text-sm text-gray-500">読み込み中…</p>
            ) : entry.error ? (
              <p className="text-sm text-red-600">{entry.error}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  お題: <span className="font-medium">{entry.promptText}</span>
                </p>
                {entry.items.length === 0 ? (
                  <p className="text-sm text-gray-500">投稿データがありません。</p>
                ) : (
                  <ol className="space-y-2">
                    {entry.items.map((item) => (
                      <li key={`${month}-${item.submissionId}`}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-md border border-gray-200 p-2 text-left transition hover:border-blue-300 hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:hover:border-blue-400 dark:hover:bg-slate-800/80"
                          onClick={() => setSelected({ promptId: entry.promptId, submissionId: item.submissionId })}
                        >
                          <div className="w-9 shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {item.rank}位
                          </div>
                          <img
                            src={item.imageDataUrl}
                            alt={`${item.rank}位の作品`}
                            className="h-12 w-12 shrink-0 rounded border border-gray-200 object-cover dark:border-gray-700"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                              {item.nickname || '匿名'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">{item.score}点</div>
                          </div>
                          <div className="shrink-0 text-xs text-blue-700 dark:text-blue-300">詳細</div>
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
          aria-hidden="true"
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
                  月別ランキング詳細
                </div>
                <h3 id="archive-submission-title" className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {detail?.rank ? `${detail.rank}位の作品` : '作品の詳細'}
                </h3>
                {detail?.promptText && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    お題: <span className="font-medium">{detail.promptText}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-300/90 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setSelected(null)}
              >
                閉じる
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
                    詳細を読み込み中…
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
                      alt={`${detail.rank ?? ''}位の作品`}
                      className="h-auto w-full rounded-xl object-cover"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-3 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-300">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{detail.score}点</div>
                    {detail.createdAt && (
                      <div className="mt-1 text-xs">投稿: {formatCreatedAt(detail.createdAt)}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="text-sm leading-7 text-slate-700 dark:text-slate-200">{detail.oneLiner}</div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: '伝わりやすさ', value: detail.breakdown.likeness },
                      { label: 'まとまり', value: detail.breakdown.composition },
                      { label: '工夫', value: detail.breakdown.originality },
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

                  {detail.tips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detail.tips.map((tip) => (
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
