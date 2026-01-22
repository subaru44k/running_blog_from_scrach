import type { SubmitResult } from '../../lib/draw/types';

type Props = {
  result: SubmitResult;
  imageDataUrl: string;
  displayScore: number;
  showDetails: boolean;
  positiveComment: string;
  improvementComment: string;
};

export default function ResultCard({
  result,
  imageDataUrl,
  displayScore,
  showDetails,
  positiveComment,
  improvementComment,
}: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-[260px,1fr]">
      <div className="rounded-lg border bg-white p-3">
        <img src={imageDataUrl} alt="あなたの絵" className="w-full h-auto" />
      </div>
      <div className="space-y-3">
        <div className="text-3xl font-bold text-gray-900">{displayScore}点</div>
        <div className="text-sm text-gray-600">
          <span className="font-semibold">{positiveComment}</span>
          <span className="ml-2">{improvementComment}</span>
        </div>
        {showDetails && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-gray-100 p-2">
              <div className="text-gray-500">似ている度</div>
              <div className="font-semibold">{result.breakdown.likeness}</div>
            </div>
            <div className="rounded bg-gray-100 p-2">
              <div className="text-gray-500">構図</div>
              <div className="font-semibold">{result.breakdown.composition}</div>
            </div>
            <div className="rounded bg-gray-100 p-2">
              <div className="text-gray-500">オリジナリティ</div>
              <div className="font-semibold">{result.breakdown.originality}</div>
            </div>
          </div>
        )}
        {showDetails && (
          <ul className="list-disc pl-4 text-sm text-gray-600">
            {result.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
