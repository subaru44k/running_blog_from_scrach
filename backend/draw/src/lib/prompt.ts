const BASE_YEAR = 2026;
const BASE_MONTH = 2; // 2026-02 is index 0 (熊)

const TOPICS = [
  '熊',
  '猫',
  '犬',
  'うさぎ',
  'パンダ',
  'きつね',
  'ペンギン',
  'フクロウ',
  'イルカ',
  'くじら',
  'ライオン',
  'ゾウ',
  'キリン',
  'カメ',
  'タコ',
  'カニ',
  'いちご',
  'りんご',
  'バナナ',
  'コーヒーカップ',
  'ハンバーガー',
  'おにぎり',
  '富士山',
  '雲',
  '雪だるま',
  '虹',
  '自転車',
  '電車',
  'ロケット',
  '家',
  '観覧車',
  '桜',
  'ひまわり',
  'サボテン',
  'ギター',
  'ロボット',
] as const;

export type DrawPrompt = {
  promptId: string;
  dateJst: string;
  promptText: string;
  month: string;
  topic: string;
};

const pad2 = (v: number) => String(v).padStart(2, '0');

const jstNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));

export const getCurrentMonthJst = () => {
  const now = jstNow();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

export const normalizeMonth = (month?: string | null) => {
  const raw = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const mon = Number(raw.slice(5, 7));
  if (Number.isNaN(year) || Number.isNaN(mon) || mon < 1 || mon > 12) return null;
  return `${year}-${pad2(mon)}`;
};

export const monthFromPromptId = (promptId?: string | null) => {
  const raw = String(promptId || '').trim();
  const m = /^prompt-(\d{4}-\d{2})$/.exec(raw);
  return m ? normalizeMonth(m[1]) : null;
};

const monthDiffFromBase = (month: string) => {
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  return (year - BASE_YEAR) * 12 + (mon - BASE_MONTH);
};

export const resolveDrawPrompt = (input?: { month?: string | null; promptId?: string | null }): DrawPrompt => {
  const month = normalizeMonth(input?.month) || monthFromPromptId(input?.promptId) || getCurrentMonthJst();
  const diff = monthDiffFromBase(month);
  const idx = ((diff % TOPICS.length) + TOPICS.length) % TOPICS.length;
  const topic = TOPICS[idx];
  const dateJst = (() => {
    const now = jstNow();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  })();
  return {
    promptId: `prompt-${month}`,
    dateJst,
    promptText: `30秒で${topic}を描いて`,
    month,
    topic,
  };
};

