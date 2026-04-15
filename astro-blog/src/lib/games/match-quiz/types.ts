export type MediaType = 'text' | 'image' | 'audio';

export type MediaContent = {
  type: MediaType;
  value: string;
};

export type Card = {
  id: string;
  setId: string;
  front: MediaContent;
  back: MediaContent;
  hint?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  stats?: {
    correctCount: number;
    wrongCount: number;
  };
};

export type CardSet = {
  id: string;
  name: string;
};

export interface CardRepository {
  listSets(): Promise<CardSet[]>;
  listCards(setId: string): Promise<Card[]>;
  createSet(set: CardSet): Promise<void>;
  deleteSet(setId: string): Promise<void>;
  createCard(card: Card): Promise<void>;
  deleteCard(cardId: string): Promise<void>;
}

export type QuizQuestion = {
  cardId: string;
  prompt: MediaContent;
  correctAnswer: MediaContent;
  choices: MediaContent[];
};
