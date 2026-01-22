import type { LeaderboardItem } from '../../lib/draw/types';

type Props = {
  items: LeaderboardItem[];
  highlightId?: string;
};

export default function Leaderboard({ items, highlightId }: Props) {
  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const isMine = highlightId && item.submissionId === highlightId;
        return (
        <div
          key={item.rank}
          className={`flex items-center gap-3 rounded-lg border p-3 ${isMine ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
        >
          <div className="w-8 text-sm font-semibold text-gray-500">#{item.rank}</div>
          <img src={item.imageDataUrl} alt="ランキングの絵" className="w-12 h-12 rounded border" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{item.nickname}</div>
            <div className="text-xs text-gray-500">{item.score}点</div>
          </div>
          {isMine && (
            <span className="text-xs font-semibold rounded-full bg-blue-600 text-white px-2 py-1">あなた</span>
          )}
        </div>
      )})}
    </div>
  );
}
