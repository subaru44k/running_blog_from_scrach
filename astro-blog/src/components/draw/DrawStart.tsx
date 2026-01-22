import { useEffect, useState } from 'react';
import { getPrompt } from '../../lib/draw/apiMock';
import type { PromptInfo } from '../../lib/draw/types';

type State = {
  loading: boolean;
  prompt?: PromptInfo;
  error?: string;
};

export default function DrawStart() {
  const [state, setState] = useState<State>({ loading: true });

  useEffect(() => {
    let mounted = true;
    getPrompt()
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
    const params = new URLSearchParams({ promptId: state.prompt.promptId });
    window.location.href = `/draw/play?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {state.loading && <div className="text-sm text-gray-500">お題を取得中…</div>}
      {state.error && <div className="text-sm text-red-600">{state.error}</div>}
      {state.prompt && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">{state.prompt.dateJst} のお題</div>
          <div className="text-xl font-semibold">{state.prompt.promptText}</div>
          <button className="px-4 py-2 rounded-md bg-blue-600 text-white" onClick={start}>
            スタート
          </button>
        </div>
      )}
      <div className="text-xs text-gray-500">
        このページをブックマークしてね。/draw からいつでも遊べます。
      </div>
    </div>
  );
}
