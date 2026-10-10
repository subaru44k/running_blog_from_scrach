import type { PrimaryRubric, ScoreBreakdown } from './types';
export function rubricPresentation(rubric: PrimaryRubric | undefined, breakdown: ScoreBreakdown | undefined, child: boolean) {
  if (rubric) return [
    {label: child ? 'おだいらしさ' : 'お題らしさ', value: rubric.subject_match, max: 6},
    {label: child ? 'とくちょう' : '特徴の表現', value: rubric.feature_capture, max: 6},
    {label: child ? 'かたちの まとまり' : '形の整合性', value: rubric.form_coherence, max: 6},
    {label: child ? 'しあがり' : '仕上がりの質', value: rubric.finish_quality, max: 6},
  ];
  return breakdown ? [
    {label: child ? 'わかりやすさ' : '伝わりやすさ', value: breakdown.likeness, max: 100},
    {label: 'まとまり', value: breakdown.composition, max: 100},
    {label: child ? 'くふう' : '工夫', value: breakdown.originality, max: 100},
  ] : [];
}
