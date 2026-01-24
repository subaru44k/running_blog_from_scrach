import type { LeaderboardItem } from '../../lib/draw/types';

type Props = {
  items: LeaderboardItem[];
  highlightId?: string;
  mineRef?: React.Ref<HTMLDivElement>;
  flashMine?: boolean;
};

export default function Leaderboard({ items, highlightId, mineRef, flashMine }: Props) {
  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const isMine = highlightId && item.submissionId === highlightId;
        const isTop = item.rank <= 3;
        return (
        <div
          key={item.rank}
          ref={isMine ? mineRef : undefined}
          aria-label={isMine ? 'あなたの記録' : undefined}
          className={`flex items-center gap-3 rounded-lg border p-3 ${isTop ? 'bg-amber-50/70' : 'bg-white'} ${isMine ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200'} ${isMine && flashMine ? 'ring-4 ring-blue-300' : ''}`}
        >
          <div className={`w-8 font-semibold ${isTop ? 'text-base text-amber-700' : 'text-sm text-gray-500'}`}>#{item.rank}</div>
          {isMine && <div className="text-lg">👉</div>}
          <img src={item.imageDataUrl} alt="ランキングの絵" className={`${isTop ? 'w-14 h-14' : 'w-12 h-12'} rounded border`} />
          <div className="flex-1">
            <div className={`${isTop ? 'text-base' : 'text-sm'} font-medium text-gray-900`}>{item.nickname}</div>
            <div className={`${isTop ? 'text-sm' : 'text-xs'} text-gray-500`}>{item.score}点</div>
          </div>
          {isMine && (
            <span className="text-xs font-semibold rounded-full bg-blue-600 text-white px-2 py-1">あなた</span>
          )}
          {isMine && <span className="text-xs text-blue-700">この絵</span>}
        </div>
      )})}
    </div>
  );
}
