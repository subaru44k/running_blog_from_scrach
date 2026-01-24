import type { ScoreBreakdown } from '../types';

export const scoreStub = () => {
  const score = 60 + Math.floor(Math.random() * 36);
  const breakdown: ScoreBreakdown = {
    likeness: Math.floor(score * 0.35),
    composition: Math.floor(score * 0.33),
    originality: Math.floor(score * 0.3),
  };
  const oneLiner = score >= 80
    ? '形の捉え方が良く、勢いが伝わります。'
    : '輪郭が安定していて見やすいです。';
  const tips = ['勢い', 'まとまり', '表情', '発想'].slice(0, 2 + (score % 2));
  return { score, breakdown, oneLiner, tips };
};
