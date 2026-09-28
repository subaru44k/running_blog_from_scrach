import { useEffect, useState } from 'react';
import { getPrompt } from '../../lib/draw/api';
import type { PromptInfo } from '../../lib/draw/types';
import { getSavedReviewMode, saveReviewMode, type ReviewMode } from '../../lib/draw/reviewMode';

type State = {
  loading: boolean;
  prompt?: PromptInfo;
  error?: string;
};

export default function DrawStart() {
  const [state, setState] = useState<State>({ loading: true });
  const [reviewMode, setReviewMode] = useState<ReviewMode>('standard');

  useEffect(() => {
    setReviewMode(getSavedReviewMode());
    let mounted = true;
    const month = new URLSearchParams(window.location.search).get('month') || undefined;
    getPrompt(month)
      .then((prompt) => {
        if (!mounted) return;
        sessionStorage.setItem('drawPrompt', JSON.stringify(prompt));
        setState({ loading: false, prompt });
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ loading: false, error: err?.message || '読み込みに失敗しました' });
      });
    return () => { mounted = false; };
  }, []);

  const start = () => {
    if (!state.prompt) return;
    saveReviewMode(reviewMode);
    const params = new URLSearchParams({ promptId: state.prompt.promptId });
    const month = new URLSearchParams(window.location.search).get('month');
    if (month) params.set('month', month);
    window.location.href = `/draw/play?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold tracking-wider text-rose-700 ring-1 ring-rose-200 dark:bg-slate-900/70 dark:text-rose-300 dark:ring-rose-900">
          <span aria-hidden="true">✦</span> 30秒の小さなアトリエ
        </div>
        <h2 className="m-0 text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">思いついたら、すぐ描こう。</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">上手に描こうとしなくて大丈夫。30秒のひらめきを楽しもう。</p>
      </div>
      {state.loading && <div className="draw-prompt-card rounded-[1.75rem] p-6 text-sm text-slate-500">お題を取得中…</div>}
      {state.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{state.error}</div>}
      {state.prompt && (
        <div className="space-y-5">
          <div className="draw-prompt-card relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
            <div className="relative z-10">
              <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-slate-900/80 dark:text-rose-300">
                {(() => {
                  const m = /^prompt-(\d{4}-\d{2})$/.exec(state.prompt?.promptId || '');
                  if (m) return `${m[1]} のお題`;
                  return `${state.prompt.dateJst} のお題`;
                })()}
              </div>
              <div className="mt-4 text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">{state.prompt.promptText}</div>
            </div>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-4 right-5 rotate-[-18deg] text-7xl text-rose-300/60 dark:text-rose-500/30">✎</span>
          </div>
          {!state.prompt.rankingEligible && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              これは過去月のお題です。練習として遊べますが、投稿はランキング対象外です。
            </div>
          )}
          <fieldset className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">結果のことばを選ぶ</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                { value: 'child' as const, title: 'こどもむけ', body: 'ひらがなだけで、やさしく せつめいします' },
                { value: 'standard' as const, title: 'おとなむけ', body: 'くわしい ことばで せつめいします' },
              ]).map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-3 transition ${reviewMode === option.value ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-950/30' : 'border-slate-200 hover:border-teal-300 dark:border-slate-700'}`}
                >
                  <input
                    type="radio"
                    name="reviewMode"
                    value={option.value}
                    checked={reviewMode === option.value}
                    onChange={() => setReviewMode(option.value)}
                    className="mr-2"
                  />
                  <span className="font-semibold">{option.title}</span>
                  <span className="mt-1 block pl-6 text-xs text-gray-600 dark:text-gray-300">{option.body}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="w-full rounded-full bg-rose-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-500/20 transition hover:-translate-y-0.5 hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 sm:w-auto" onClick={start}>
            お絵かきをはじめる →
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-slate-500 dark:text-slate-400">作品を見てみたい？</span>
        <a href="/draw/archive/" className="font-semibold text-teal-700 hover:underline dark:text-teal-300">みんなの作品ギャラリーへ →</a>
      </div>
    </div>
  );
}
