import type { Card, MediaContent, QuizQuestion } from './types';

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isQuizCard(card: Card) {
  return card.front.type === 'image' && card.back.type === 'text';
}

export function hasEnoughChoices(cards: Card[]) {
  const usable = cards.filter(isQuizCard);
  if (usable.length < 4) return false;
  const uniqueAnswers = new Set(usable.map((card) => card.back.value.trim()).filter(Boolean));
  return uniqueAnswers.size >= 4;
}

function uniqueDistractors(cards: Card[], cardId: string, answer: string) {
  const seen = new Set<string>([answer]);
  const distractors: MediaContent[] = [];
  for (const card of shuffle(cards)) {
    if (!isQuizCard(card) || card.id === cardId) continue;
    const value = card.back.value.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    distractors.push(card.back);
    if (distractors.length === 3) break;
  }
  return distractors;
}

export function generateQuiz(cards: Card[]): QuizQuestion[] {
  const usable = shuffle(cards.filter(isQuizCard));
  const questions: QuizQuestion[] = [];
  for (const card of usable) {
    const distractors = uniqueDistractors(usable, card.id, card.back.value.trim());
    if (distractors.length < 3) continue;
    questions.push({
      cardId: card.id,
      prompt: card.front,
      correctAnswer: card.back,
      choices: shuffle([card.back, ...distractors]),
    });
  }
  return questions;
}
