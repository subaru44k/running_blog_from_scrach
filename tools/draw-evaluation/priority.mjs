// Review ordering only; never changes evaluation or review records.
export function reviewPriority(evaluation, saved, reviewed, previousReview) {
  if (!['reference','candidate'].includes(evaluation.evaluator_type) || reviewed) return [];
  const reasons = [];
  if (evaluation.calculated_score >= 90) reasons.push('90点以上：高い段階の根拠に納得できるか');
  if (evaluation.confidence === 'low') reasons.push('確信度が低い：見えている部位とお題の認識を確認');
  if (saved && Number.isFinite(saved.calculated_score) && Math.abs(evaluation.calculated_score - saved.calculated_score) >= 25) reasons.push('既存方式との評価差が大きい：段階評価の根拠を確認');
  if (evaluation.rubric_version === 'rubric-v2' && ['check','inappropriate'].includes(previousReview?.status)) reasons.push('旧版で違和感あり：新しい評価で改善したか確認');
  return reasons;
}
