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
    <div className="space-y-4">
      {state.loading && <div className="text-sm text-gray-500">お題を取得中…</div>}
      {state.error && <div className="text-sm text-red-600">{state.error}</div>}
      {state.prompt && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            {(() => {
              const m = /^prompt-(\d{4}-\d{2})$/.exec(state.prompt?.promptId || '');
              if (m) return `${m[1]} のお題`;
              return `${state.prompt.dateJst} のお題`;
            })()}
          </div>
          <div className="text-xl font-semibold">{state.prompt.promptText}</div>
          <fieldset className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-slate-900">
            <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">けっかの ことば</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                { value: 'child' as const, title: 'こどもむけ', body: 'ひらがなだけで、やさしく せつめいします' },
                { value: 'standard' as const, title: 'おとなむけ', body: 'くわしい ことばで せつめいします' },
              ]).map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border p-3 ${reviewMode === option.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}
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
          <button className="px-4 py-2 rounded-md bg-blue-600 text-white" onClick={start}>
            スタート
          </button>
        </div>
      )}
      <div className="text-xs text-gray-500">
        このページをブックマークしてね。/draw からいつでも遊べます。
      </div>
      <a
        href="/draw/archive/"
        className="inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
      >
        過去の月別ランキングを見る
      </a>
    </div>
  );
}
