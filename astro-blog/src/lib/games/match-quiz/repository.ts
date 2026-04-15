import { SAMPLE_CARDS, SAMPLE_SETS } from './sample-data';
import type { Card, CardRepository, CardSet } from './types';

const STORAGE_KEY = 'match-quiz:db:v1';

type PersistedDatabase = {
  version: 1;
  sets: CardSet[];
  cards: Card[];
};

const LEGACY_SET_ID_MAP: Record<string, string> = {
  'set-flags': 'sample-flags',
  'set-faces': 'sample-faces',
};

function cloneCard(card: Card): Card {
  return {
    ...card,
    front: { ...card.front },
    back: { ...card.back },
    stats: card.stats ? { ...card.stats } : undefined,
    tags: card.tags ? [...card.tags] : undefined,
  };
}

function cloneSet(set: CardSet): CardSet {
  return { ...set };
}

function buildInitialDatabase(): PersistedDatabase {
  return {
    version: 1,
    sets: SAMPLE_SETS.map(cloneSet),
    cards: SAMPLE_CARDS.map(cloneCard),
  };
}

function normalizeDatabase(database: PersistedDatabase): PersistedDatabase {
  const sets = database.sets.map((set) => ({
    ...set,
    id: LEGACY_SET_ID_MAP[set.id] ?? set.id,
  }));
  const cards = database.cards.map((card) => ({
    ...card,
    setId: LEGACY_SET_ID_MAP[card.setId] ?? card.setId,
  }));
  const knownSetIds = new Set(sets.map((set) => set.id));
  for (const sampleSet of SAMPLE_SETS) {
    if (!knownSetIds.has(sampleSet.id)) {
      sets.push(cloneSet(sampleSet));
      knownSetIds.add(sampleSet.id);
    }
  }
  const knownCardIds = new Set(cards.map((card) => card.id));
  for (const sampleCard of SAMPLE_CARDS) {
    if (!knownCardIds.has(sampleCard.id)) {
      cards.push(cloneCard(sampleCard));
      knownCardIds.add(sampleCard.id);
    }
  }
  return {
    version: 1,
    sets,
    cards,
  };
}

function readDatabase(storage: Storage): PersistedDatabase {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = buildInitialDatabase();
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedDatabase;
    if (!Array.isArray(parsed.sets) || !Array.isArray(parsed.cards)) {
      throw new Error('invalid db');
    }
    const normalized = normalizeDatabase(parsed);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      writeDatabase(storage, normalized);
    }
    return normalized;
  } catch {
    const seeded = buildInitialDatabase();
    storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeDatabase(storage: Storage, database: PersistedDatabase) {
  storage.setItem(STORAGE_KEY, JSON.stringify(database));
}

export class LocalRepository implements CardRepository {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
    readDatabase(this.storage);
  }

  async listSets() {
    return readDatabase(this.storage).sets.map(cloneSet);
  }

  async listCards(setId: string) {
    return readDatabase(this.storage)
      .cards
      .filter((card) => card.setId === setId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(cloneCard);
  }

  async createSet(set: CardSet) {
    const database = readDatabase(this.storage);
    if (database.sets.some((entry) => entry.id === set.id)) return;
    database.sets.push(cloneSet(set));
    writeDatabase(this.storage, database);
  }

  async deleteSet(setId: string) {
    const database = readDatabase(this.storage);
    database.sets = database.sets.filter((set) => set.id !== setId);
    database.cards = database.cards.filter((card) => card.setId !== setId);
    writeDatabase(this.storage, database);
  }

  async createCard(card: Card) {
    const database = readDatabase(this.storage);
    database.cards.push(cloneCard(card));
    writeDatabase(this.storage, database);
  }

  async deleteCard(cardId: string) {
    const database = readDatabase(this.storage);
    database.cards = database.cards.filter((card) => card.id !== cardId);
    writeDatabase(this.storage, database);
  }

  async recordAnswer(cardId: string, isCorrect: boolean) {
    const database = readDatabase(this.storage);
    database.cards = database.cards.map((card) => {
      if (card.id !== cardId) return card;
      const stats = card.stats ?? { correctCount: 0, wrongCount: 0 };
      return {
        ...card,
        updatedAt: new Date().toISOString(),
        stats: {
          correctCount: stats.correctCount + (isCorrect ? 1 : 0),
          wrongCount: stats.wrongCount + (isCorrect ? 0 : 1),
        },
      };
    });
    writeDatabase(this.storage, database);
  }
}

export function createLocalRepository(storage: Storage) {
  return new LocalRepository(storage);
}
