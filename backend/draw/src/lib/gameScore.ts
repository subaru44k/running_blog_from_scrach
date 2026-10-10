import specification from '../../../../tools/draw-evaluation/game-score-v1.json' with { type: 'json' };
export const evaluationVersions = { promptVersion: 'prompt-v3', rubricVersion: 'rubric-v2', scoringVersion: specification.version } as const;
export const rubricKeys = ['subject_match', 'feature_capture', 'form_coherence', 'finish_quality'] as const;
export type PrimaryRubric = Record<typeof rubricKeys[number], number>;
export function validatePrimaryEvaluation(input: any): PrimaryRubric {
  const rubric = input?.rubric;
  if (!rubric || Object.keys(rubric).length !== rubricKeys.length || rubricKeys.some(k => !Number.isInteger(rubric[k]) || rubric[k] < 0 || rubric[k] > 6)) throw new Error('Invalid four-axis rubric');
  if (!input.axis_evidence || Object.keys(input.axis_evidence).length !== rubricKeys.length) throw new Error('Missing axis evidence');
  for (const k of rubricKeys) {
    const evidence = input.axis_evidence[k];
    if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 2 || evidence.some((v: unknown) => typeof v !== 'string' || !v.trim() || v.length > 120)) throw new Error(`Invalid evidence: ${k}`);
    if (rubric[k] === 6 && new Set(evidence.map((v: string) => v.trim())).size !== 2) throw new Error(`Level 6 needs two distinct evidence points: ${k}`);
  }
  return { ...rubric };
}
export function computeGameScore(rubric: PrimaryRubric) {
  if (Object.keys(rubric).length !== 4 || rubricKeys.some(k => !Number.isInteger(rubric[k]) || rubric[k] < 0 || rubric[k] > 6)) throw new Error('Invalid four-axis rubric');
  const round = (n: number) => Math.round(n * 100) / 100;
  const weighted = rubricKeys.reduce((sum, k, i) => sum + specification.level_values[rubric[k]] * specification.weights[i], 0) / 100;
  const baseScore = round(Math.min(specification.subject_caps_before_transform[rubric.subject_match], weighted));
  let gameScore = 0;
  if (baseScore > 0) {
    const i = specification.anchors.findIndex(([x]) => x >= baseScore);
    const [x1, y1] = specification.anchors[i - 1];
    const [x2, y2] = specification.anchors[i];
    gameScore = round(y1 + (baseScore - x1) * (y2 - y1) / (x2 - x1));
  }
  return {baseScore, gameScore, score: Math.round(gameScore)};
}
export const toCompatibilityBreakdown = (r: PrimaryRubric) => ({
  likeness: Math.round((specification.level_values[r.subject_match] * 0.6 + specification.level_values[r.feature_capture] * 0.4)),
  composition: specification.level_values[r.form_coherence],
  originality: 0, // Not measured by rubric-v2; new clients display primaryRubric instead.
});
