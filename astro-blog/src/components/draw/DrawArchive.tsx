import { useEffect, useMemo, useState } from 'react';
import { getLeaderboard, getPrompt } from '../../lib/draw/api';
import type { LeaderboardItem } from '../../lib/draw/types';

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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        2026年2月以降の月次ランキング上位20件を表示します。
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
                      <li
                        key={`${month}-${item.submissionId}`}
                        className="flex items-center gap-3 rounded-md border border-gray-200 p-2 dark:border-gray-700"
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
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
