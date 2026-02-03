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
}: Props) {
  const [commentVisible, setCommentVisible] = useState(true);
  const [expandRich, setExpandRich] = useState(false);
  const commentText = showRichComment && richComment ? richComment : shortComment;
  const hasRich = Boolean(showRichComment && richComment);
  const showToggle = hasRich && (richComment?.length || 0) > 80;

  const titleLabel = score >= 95
    ? 'キマった！'
    : score >= 80
      ? 'かなり上手い！'
      : score >= 60
        ? 'いい感じ！'
        : score >= 40
          ? '伝わる！'
          : '伸びしろ！';

  useEffect(() => {
    setCommentVisible(false);
    const timer = setTimeout(() => setCommentVisible(true), 10);
    return () => clearTimeout(timer);
  }, [commentText]);

  useEffect(() => {
    setExpandRich(false);
  }, [richComment, showRichComment]);

  return (
    <div className="grid gap-6 md:grid-cols-[260px,1fr]">
      <div className="rounded-lg border bg-white p-3">
        <img src={imageDataUrl} alt="あなたの絵" className="w-full h-auto" />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-3xl font-bold text-gray-900">{score}点</div>
          {phaseLabel && (
            <span className="text-xs text-gray-500">{phaseLabel}</span>
          )}
          <span className="text-xs rounded-full bg-amber-100 px-2 py-1 text-amber-700">
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
            className={`text-sm text-gray-600 transition-opacity duration-200 ${
              commentVisible ? 'opacity-100' : 'opacity-0'
            } ${hasRich && !expandRich ? 'line-clamp-3' : ''}`}
          >
            {commentText}
          </div>
          {showToggle && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => setExpandRich((prev) => !prev)}
            >
              {expandRich ? '閉じる' : 'もっと見る'}
            </button>
          )}
        </div>
        {breakdown && (
          <div className="space-y-2 pt-2">
            {[
              { label: '伝わりやすさ', value: breakdown.likeness },
              { label: 'まとまり', value: breakdown.composition },
              { label: '工夫', value: breakdown.originality },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{item.label}</span>
                  <span>{Math.max(0, Math.min(100, item.value))}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500"
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
