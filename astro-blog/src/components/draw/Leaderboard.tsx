import type { LeaderboardItem } from '../../lib/draw/types';

type Props = {
  items: LeaderboardItem[];
};

export default function Leaderboard({ items }: Props) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.rank} className="flex items-center gap-3 rounded-lg border bg-white p-3">
          <div className="w-8 text-sm font-semibold text-gray-500">#{item.rank}</div>
          <img src={item.imageDataUrl} alt="ランキングの絵" className="w-12 h-12 rounded border" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{item.nickname}</div>
            <div className="text-xs text-gray-500">{item.score}点</div>
          </div>
        </div>
      ))}
    </div>
  );
}
