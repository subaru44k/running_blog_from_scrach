import { useEffect, useState } from 'react';

type Props = {
  score: number;
  shortComment: string;
  richComment?: string;
  showRichComment?: boolean;
  secondaryPending?: boolean;
  phaseLabel?: string;
  badges?: string[];
  imageDataUrl: string;
};

export default function ResultCard({
  score,
  shortComment,
  richComment,
  showRichComment,
  secondaryPending,
  phaseLabel,
  badges = [],
  imageDataUrl,
}: Props) {
  const [commentVisible, setCommentVisible] = useState(true);
  const commentText = showRichComment && richComment ? richComment : shortComment;

  useEffect(() => {
    setCommentVisible(false);
    const timer = setTimeout(() => setCommentVisible(true), 10);
    return () => clearTimeout(timer);
  }, [commentText]);

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
        </div>
        {secondaryPending && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
            ✨ 注目作品レビュー中
          </div>
        )}
        <div
          className={`text-sm text-gray-600 transition-opacity duration-200 ${
            commentVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {commentText}
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.slice(0, 2).map((badge) => (
              <span key={badge} className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
