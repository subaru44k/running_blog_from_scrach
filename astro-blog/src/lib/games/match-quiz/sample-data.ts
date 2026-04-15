import type { Card, CardSet } from './types';

const seededAt = '2026-04-05T00:00:00.000Z';

export const SAMPLE_SETS: CardSet[] = [
  { id: 'sample-flags', name: '国旗クイズ' },
  { id: 'sample-faces', name: 'かおと なまえクイズ' },
];

export const SAMPLE_CARDS: Card[] = [
  {
    id: 'card-flag-japan',
    setId: 'sample-flags',
    front: { type: 'image', value: '/images/games/match-quiz/flag-japan.svg' },
    back: { type: 'text', value: '日本' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-flag-usa',
    setId: 'sample-flags',
    front: { type: 'image', value: '/images/games/match-quiz/flag-usa.svg' },
    back: { type: 'text', value: 'アメリカ' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-flag-france',
    setId: 'sample-flags',
    front: { type: 'image', value: '/images/games/match-quiz/flag-france.svg' },
    back: { type: 'text', value: 'フランス' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-flag-germany',
    setId: 'sample-flags',
    front: { type: 'image', value: '/images/games/match-quiz/flag-germany.svg' },
    back: { type: 'text', value: 'ドイツ' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-face-tanaka',
    setId: 'sample-faces',
    front: { type: 'image', value: '/images/games/match-quiz/face-tanaka.svg' },
    back: { type: 'text', value: 'たなかくん' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-face-sato',
    setId: 'sample-faces',
    front: { type: 'image', value: '/images/games/match-quiz/face-sato.svg' },
    back: { type: 'text', value: 'さとうさん' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-face-suzuki',
    setId: 'sample-faces',
    front: { type: 'image', value: '/images/games/match-quiz/face-suzuki.svg' },
    back: { type: 'text', value: 'すずきさん' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
  {
    id: 'card-face-takahashi',
    setId: 'sample-faces',
    front: { type: 'image', value: '/images/games/match-quiz/face-takahashi.svg' },
    back: { type: 'text', value: 'たかはしさん' },
    createdAt: seededAt,
    updatedAt: seededAt,
    stats: { correctCount: 0, wrongCount: 0 },
  },
];
