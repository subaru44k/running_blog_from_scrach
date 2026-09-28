import { useEffect, useState } from 'react';

type Props = {
  score: number;
  shortComment: string;
  richComment?: string;
  showRichComment?: boolean;
  secondaryPending?: boolean;
  phaseLabel?: string;
  tips?: string[];
  breakdown?: {
    likeness: number;
    composition: number;
    originality: number;
  };
  imageDataUrl: string;
  childMode?: boolean;
};

export default function ResultCard({
  score,
  shortComment,
  richComment,
  showRichComment,
  secondaryPending,
  phaseLabel,
  tips = [],
  breakdown,
  imageDataUrl,
  childMode = false,
}: Props) {
  const [commentVisible, setCommentVisible] = useState(true);
  const [expandComment, setExpandComment] = useState(false);
  const commentText = showRichComment && richComment ? richComment : shortComment;
  const showToggle = commentText.length > 100;

  const standardTitleLabel = score >= 95
    ? 'キマった！'
    : score >= 80
      ? 'かなり上手い！'
      : score >= 60
        ? 'いい感じ！'
        : score >= 40
          ? '伝わる！'
          : '伸びしろ！';
  const childTitleLabel = score >= 95
    ? 'すごい！'
    : score >= 80
      ? 'とっても じょうず！'
      : score >= 60
        ? 'いい かんじ！'
        : score >= 40
          ? 'よく わかるよ！'
          : 'つぎも かいてみよう！';
  const titleLabel = childMode ? childTitleLabel : standardTitleLabel;

  useEffect(() => {
    setCommentVisible(false);
    const timer = setTimeout(() => setCommentVisible(true), 10);
    return () => clearTimeout(timer);
  }, [commentText]);

  useEffect(() => {
    setExpandComment(false);
  }, [commentText]);

  return (
    <div className="draw-result-card grid gap-6 rounded-[1.75rem] p-4 sm:p-6 md:grid-cols-[minmax(0,260px),1fr]">
      <div className="rounded-2xl border border-rose-100 bg-white p-3 shadow-sm dark:border-slate-700">
        <img src={imageDataUrl} alt="あなたの絵" className="aspect-square w-full rounded-xl bg-white object-contain" />
      </div>
      <div className="space-y-3 self-center">
        <div className="text-xs font-bold tracking-[0.16em] text-rose-700 dark:text-rose-300">{childMode ? 'あなたの え' : 'あなたの作品'}</div>
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-5xl font-black tracking-tight text-slate-900 dark:text-white">{score}<span className="ml-1 text-lg font-bold">{childMode ? 'てん' : '点'}</span></div>
          {phaseLabel && (
            <span className="text-xs text-gray-500">{phaseLabel}</span>
          )}
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            {titleLabel}
          </span>
        </div>
        {secondaryPending && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
            ✨ 注目作品レビュー中
          </div>
        )}
        <div className="space-y-2">
          <div
            className={`text-sm leading-7 text-slate-700 transition-opacity duration-200 dark:text-slate-200 ${
              commentVisible ? 'opacity-100' : 'opacity-0'
            } ${!expandComment ? 'line-clamp-3' : ''}`}
          >
            {commentText}
          </div>
          {showToggle && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setExpandComment((prev) => !prev)}
            >
              {childMode ? (expandComment ? 'とじる' : 'もっと みる') : (expandComment ? '閉じる' : 'もっと見る')}
            </button>
          )}
        </div>
        {breakdown && (
          <div className="space-y-2 pt-2">
            {[
              { label: childMode ? 'わかりやすさ' : '伝わりやすさ', value: breakdown.likeness },
              { label: 'まとまり', value: breakdown.composition },
              { label: childMode ? 'くふう' : '工夫', value: breakdown.originality },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{item.label}</span>
                  <span>{Math.max(0, Math.min(100, item.value))}</span>
                </div>
                <div className="h-2 rounded-full bg-white/80 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-teal-500"
                    style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {tips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tips.slice(0, 3).map((tip) => (
              <span key={tip} className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                {tip}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
