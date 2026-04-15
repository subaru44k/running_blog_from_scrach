import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createLocalRepository, type LocalRepository } from '../../lib/games/match-quiz/repository';
import { generateQuiz, hasEnoughChoices } from '../../lib/games/match-quiz/quiz';
import type { Card, CardSet, QuizQuestion } from '../../lib/games/match-quiz/types';

type Mode = 'start' | 'quiz' | 'manage';

function makeCardId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeSetId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSampleSet(setId: string) {
  return setId.startsWith('sample-');
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('画像の読み込みに失敗しました。'));
    };
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

export default function MatchQuizApp() {
  const repositoryRef = useRef<LocalRepository | null>(null);
  const [mode, setMode] = useState<Mode>('start');
  const [sets, setSets] = useState<CardSet[]>([]);
  const [cardsBySet, setCardsBySet] = useState<Record<string, Card[]>>({});
  const [selectedSetId, setSelectedSetId] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [manageAnswer, setManageAnswer] = useState('');
  const [manageImageDataUrl, setManageImageDataUrl] = useState('');
  const [managePreview, setManagePreview] = useState('');
  const [manageSetName, setManageSetName] = useState('');
  const [manageStatus, setManageStatus] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(activeSetId?: string) {
    const repository = repositoryRef.current;
    if (!repository) return;
    const loadedSets = await repository.listSets();
    const entries = await Promise.all(loadedSets.map(async (set) => [set.id, await repository.listCards(set.id)] as const));
    const nextCardsBySet = Object.fromEntries(entries);
    setSets(loadedSets);
    setCardsBySet(nextCardsBySet);
    setSelectedSetId((current) => {
      if (activeSetId && loadedSets.some((set) => set.id === activeSetId)) return activeSetId;
      if (current && loadedSets.some((set) => set.id === current)) return current;
      return loadedSets[0]?.id || '';
    });
  }

  useEffect(() => {
    repositoryRef.current = createLocalRepository(window.localStorage);
    refresh().finally(() => setLoading(false));
  }, []);

  const selectedSet = sets.find((set) => set.id === selectedSetId) ?? null;
  const selectedCards = cardsBySet[selectedSetId] ?? [];
  const selectedSetIsSample = selectedSet ? isSampleSet(selectedSet.id) : false;
  const canStartQuiz = hasEnoughChoices(selectedCards);
  const currentQuestion = quizQuestions[quizIndex];
  const isAnswered = selectedChoice !== null;
  const quizComplete = mode === 'quiz' && quizQuestions.length > 0 && quizIndex >= quizQuestions.length;

  async function startQuiz() {
    if (!canStartQuiz) return;
    const questions = generateQuiz(selectedCards);
    setQuizQuestions(questions);
    setQuizIndex(0);
    setSelectedChoice(null);
    setScore(0);
    setMode('quiz');
  }

  async function handleChoice(value: string) {
    if (!currentQuestion || isAnswered) return;
    setSelectedChoice(value);
    const isCorrect = value === currentQuestion.correctAnswer.value;
    if (isCorrect) {
      setScore((current) => current + 1);
    }
    await repositoryRef.current?.recordAnswer(currentQuestion.cardId, isCorrect);
    refresh(selectedSetId);
  }

  function goNextQuestion() {
    setSelectedChoice(null);
    setQuizIndex((current) => current + 1);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setManageImageDataUrl('');
      setManagePreview('');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setManageImageDataUrl(dataUrl);
      setManagePreview(dataUrl);
      setManageError(null);
    } catch (error) {
      setManageError(error instanceof Error ? error.message : '画像の読み込みに失敗しました。');
    }
  }

  async function handleCreateSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = manageSetName.trim();
    if (!name) {
      setManageError('セット名を入れてください。');
      return;
    }
    const nextSet: CardSet = {
      id: makeSetId(),
      name,
    };
    await repositoryRef.current?.createSet(nextSet);
    setManageSetName('');
    setManageError(null);
    setManageStatus('新しいセットを作りました。');
    await refresh(nextSet.id);
  }

  async function handleCreateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSetId) {
      setManageError('セットを選んでください。');
      return;
    }
    if (selectedSetIsSample) {
      setManageError('サンプルセットはそのまま使ってね。自作セットで問題を追加できます。');
      return;
    }
    if (!manageImageDataUrl || !manageAnswer.trim()) {
      setManageError('画像と答えを入れてください。');
      return;
    }
    const now = new Date().toISOString();
    await repositoryRef.current?.createCard({
      id: makeCardId(),
      setId: selectedSetId,
      front: { type: 'image', value: manageImageDataUrl },
      back: { type: 'text', value: manageAnswer.trim() },
      createdAt: now,
      updatedAt: now,
      stats: { correctCount: 0, wrongCount: 0 },
    });
    setManageAnswer('');
    setManageImageDataUrl('');
    setManagePreview('');
    setManageError(null);
    setManageStatus('問題を追加しました。');
    await refresh(selectedSetId);
  }

  async function handleDeleteCard(cardId: string) {
    if (selectedSetIsSample) return;
    if (!window.confirm('この問題を削除しますか？')) return;
    await repositoryRef.current?.deleteCard(cardId);
    setManageStatus('問題を削除しました。');
    setManageError(null);
    await refresh(selectedSetId);
  }

  async function handleDeleteSet() {
    if (!selectedSet || selectedSetIsSample) return;
    if (!window.confirm(`「${selectedSet.name}」を削除しますか？ 問題もいっしょに消えます。`)) return;
    await repositoryRef.current?.deleteSet(selectedSet.id);
    setManageStatus('セットを削除しました。');
    setManageError(null);
    setManageAnswer('');
    setManageImageDataUrl('');
    setManagePreview('');
    await refresh();
  }

  const startDisabledText = canStartQuiz
    ? null
    : 'このセットはまだ4択になりません。問題をあと1つ以上追加してください。';

  if (loading) {
    return <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300">クイズを準備しています…</div>;
  }

  return (
    <div className="mq-shell space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400">MINI GAME</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">えあわせクイズ</h2>
      </div>

      <section className="grid gap-3 md:grid-cols-2" aria-label="モードをえらぶ">
        <button
          type="button"
          className={`mq-mode-card ${mode !== 'manage' ? 'mq-mode-card-current' : ''}`}
          onClick={() => setMode('start')}
        >
          <span className="mq-mode-kicker">PLAY</span>
          <span className="mq-mode-title">プレイモード</span>
          <span className="mq-mode-body">セットをえらんで、4択クイズを遊びます。</span>
        </button>
        <button
          type="button"
          className={`mq-mode-card ${mode === 'manage' ? 'mq-mode-card-current' : ''}`}
          onClick={() => setMode('manage')}
        >
          <span className="mq-mode-kicker">MANAGE</span>
          <span className="mq-mode-title">管理モード</span>
          <span className="mq-mode-body">セットを作ったり、問題を追加・削除したりします。</span>
        </button>
      </section>

      {mode === 'start' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,.94),rgba(224,242,254,.86))] p-4 text-sm font-semibold text-slate-800 dark:border-sky-400/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,.94),rgba(30,41,59,.88))] dark:text-slate-100">
            セットをえらんで、すぐに4択クイズを始められます。
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sets.map((set) => {
              const cards = cardsBySet[set.id] ?? [];
              const isCurrent = selectedSetId === set.id;
              const hint = set.id === 'sample-flags'
                ? '国旗で ルールを つかめる セット'
                : set.id === 'sample-faces'
                  ? '顔イラストと 名前を むすぶ セット'
                  : '自分で作った クイズセット';
              return (
                <button
                  key={set.id}
                  type="button"
                  className={`mq-set-card ${isCurrent ? 'mq-set-card-current' : ''}`}
                  onClick={() => setSelectedSetId(set.id)}
                >
                  <span className="mq-set-title">{set.name}</span>
                  <span className="mq-set-sub">{cards.length}もん</span>
                  <span className="mq-set-hint">{hint}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400">えらんだセット</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{selectedSet?.name ?? 'セットをえらんでください'}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {startDisabledText ?? '画像を見て、あてはまる答えを4つの中からえらびます。'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="mq-btn mq-btn-primary" onClick={startQuiz} disabled={!canStartQuiz}>クイズを始める</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'quiz' && (
        <div className="space-y-5">
          {quizComplete || !currentQuestion ? (
            <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,.95),rgba(254,243,199,.82))] p-5 dark:border-amber-400/20 dark:bg-[linear-gradient(135deg,rgba(120,53,15,.45),rgba(113,63,18,.34))]">
              <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 dark:text-amber-200">RESULT</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">おつかれさま！</h3>
              <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{score} / {quizQuestions.length} もん せいかい</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="mq-btn mq-btn-primary" onClick={startQuiz} disabled={!canStartQuiz}>もういちど</button>
                <button type="button" className="mq-btn" onClick={() => setMode('start')}>セット選択へ</button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 dark:text-slate-400">QUESTION</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{quizIndex + 1} / {quizQuestions.length} もんめ</h3>
                  </div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">いまの せいかい: {score}</p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,.95),rgba(248,250,252,.9))] p-5 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.94),rgba(30,41,59,.88))]">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
                  <img src={currentQuestion.prompt.value} alt="クイズの画像" className="w-full rounded-[1.5rem] border border-slate-200/80 bg-white object-contain shadow-soft dark:border-slate-700/80 dark:bg-slate-950" />
                  <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">この画像に あう こたえを えらんでね。</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {currentQuestion.choices.map((choice) => {
                  const isCorrect = choice.value === currentQuestion.correctAnswer.value;
                  const isSelected = choice.value === selectedChoice;
                  const buttonClass = [
                    'mq-choice',
                    isAnswered && isCorrect ? 'mq-choice-correct' : '',
                    isAnswered && isSelected && !isCorrect ? 'mq-choice-wrong' : '',
                  ].join(' ').trim();
                  return (
                    <button key={choice.value} type="button" className={buttonClass} onClick={() => handleChoice(choice.value)} disabled={isAnswered}>
                      {choice.value}
                    </button>
                  );
                })}
              </div>

              <div className={`rounded-2xl border p-4 text-sm font-semibold ${isAnswered ? (selectedChoice === currentQuestion.correctAnswer.value ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-rose-200/80 bg-rose-50/90 text-rose-900 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-100') : 'border-slate-200/80 bg-white/80 text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-200'}`}>
                {isAnswered
                  ? (selectedChoice === currentQuestion.correctAnswer.value
                    ? 'せいかい！ つぎの問題へ 進めます。'
                    : `ざんねん。正解は「${currentQuestion.correctAnswer.value}」です。`)
                  : '4つの中から ひとつ えらんでください。'}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="mq-btn mq-btn-primary" onClick={goNextQuestion} disabled={!isAnswered}>つぎへ</button>
                <button type="button" className="mq-btn" onClick={() => setMode('start')}>セット選択へ</button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'manage' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">編集するセット</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:items-end">
              <div className="grid gap-2">
                <label htmlFor="manageSet" className="text-sm font-semibold text-slate-700 dark:text-slate-200">セットをえらぶ</label>
                <select
                  id="manageSet"
                  className="mq-select"
                  value={selectedSetId}
                  onChange={(event) => setSelectedSetId(event.target.value)}
                >
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3">
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {selectedSetIsSample
                    ? 'サンプルセットは読み取り専用です。内容を変えたいときは、新しいセットを作ってください。'
                    : 'この自作セットは、問題の追加・削除とセット削除ができます。'}
                </p>
                {!selectedSetIsSample && selectedSet ? (
                  <div>
                    <button type="button" className="mq-btn mq-btn-danger" onClick={handleDeleteSet}>このセットを削除</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4 dark:border-sky-400/20 dark:bg-sky-500/10">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">新しいセットを作る</h3>
            <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" onSubmit={handleCreateSet}>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                セット名
                <input type="text" value={manageSetName} onChange={(event) => setManageSetName(event.target.value)} className="mq-input" placeholder="例: のりものクイズ" />
              </label>
              <button type="submit" className="mq-btn mq-btn-primary">セットを作る</button>
            </form>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              作ったセットは自動で選択され、画像と答えを追加できるようになります。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">問題を追加する</h3>
            {selectedSetIsSample ? (
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-300">
                サンプルセットには問題を追加できません。自作セットを作ると、画像と答えを追加できます。
              </div>
            ) : (
              <form className="mt-4" onSubmit={handleCreateCard}>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    画像アップロード
                    <input type="file" accept="image/*" className="mq-file" onChange={handleImageChange} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    答えテキスト
                    <input type="text" value={manageAnswer} onChange={(event) => setManageAnswer(event.target.value)} className="mq-input" placeholder="例: カナダ" />
                  </label>
                </div>
                {managePreview && (
                  <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-950/60">
                    <img src={managePreview} alt="追加する画像のプレビュー" className="h-24 w-24 rounded-xl border border-slate-200/80 bg-white object-contain dark:border-slate-700/80 dark:bg-slate-900" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">この画像を問題の表に使います。</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="submit" className="mq-btn mq-btn-primary">この問題を保存する</button>
                  <button type="button" className="mq-btn" onClick={() => setMode('start')}>クイズへ戻る</button>
                </div>
              </form>
            )}
            {(manageError || manageStatus) && (
              <p className={`mt-4 text-sm font-semibold ${manageError ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{manageError ?? manageStatus}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950 dark:text-white">このセットの問題</h3>
              <button type="button" className="mq-btn" onClick={() => setMode('start')}>クイズへ戻る</button>
            </div>
            {selectedCards.map((card) => (
              <article key={card.id} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center gap-4">
                  <img src={card.front.value} alt="" className="h-20 w-20 rounded-xl border border-slate-200/80 bg-white object-contain dark:border-slate-700/80 dark:bg-slate-950" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">{card.back.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      せいかい {card.stats?.correctCount ?? 0} / まちがい {card.stats?.wrongCount ?? 0}
                    </p>
                  </div>
                  {!selectedSetIsSample && (
                    <button type="button" className="mq-btn mq-btn-danger" onClick={() => handleDeleteCard(card.id)}>削除</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
