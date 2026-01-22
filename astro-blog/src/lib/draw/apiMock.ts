import type { LeaderboardResponse, PromptInfo, SubmitResult } from './types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const baseDate = '2026-01-19';

const prompt: PromptInfo = {
  promptId: 'prompt-2026-01-19',
  dateJst: baseDate,
  promptText: '30秒で熊を描いて',
};

const sketches = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#fff"/><circle cx="60" cy="60" r="38" stroke="#111" stroke-width="4" fill="none"/><circle cx="45" cy="52" r="6" fill="#111"/><circle cx="75" cy="52" r="6" fill="#111"/><path d="M50 75 Q60 85 70 75" stroke="#111" stroke-width="4" fill="none"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#fff"/><rect x="25" y="30" width="70" height="60" rx="12" ry="12" fill="none" stroke="#111" stroke-width="4"/><path d="M35 60 L55 50 L75 70" stroke="#111" stroke-width="4" fill="none"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#fff"/><path d="M20 90 Q60 20 100 90" stroke="#111" stroke-width="4" fill="none"/><circle cx="60" cy="55" r="8" fill="#111"/></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#fff"/><circle cx="35" cy="50" r="10" fill="#111"/><circle cx="85" cy="50" r="10" fill="#111"/><rect x="30" y="70" width="60" height="12" fill="#111"/></svg>',
];

const toDataUrl = (svg: string) => {
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
};

const randomScore = () => 60 + Math.floor(Math.random() * 36);

export async function getPrompt(): Promise<PromptInfo> {
  await delay(400);
  return prompt;
}

export async function submitDrawing(params: {
  promptId: string;
  imageDataUrl: string;
  nickname?: string;
}): Promise<SubmitResult> {
  await delay(1600);
  const score = randomScore();
  const breakdown = {
    likeness: Math.floor(score * 0.35),
    composition: Math.floor(score * 0.33),
    originality: Math.floor(score * 0.3),
  };
  const isRanked = score >= 75;
  const rank = isRanked ? Math.max(1, 20 - Math.floor((score - 70) / 2)) : undefined;
  return {
    submissionId: `sub-${Date.now()}`,
    score,
    breakdown,
    oneLiner: score >= 80 ? '形の捉え方が良く、勢いが伝わります。' : '輪郭が安定していて見やすいです。',
    tips: [
      '耳の位置を少し高くすると表情が締まります。',
      '輪郭は太さを揃えると安定感が出ます。',
    ],
    isRanked,
    rank,
  };
}

export async function getLeaderboard(promptId: string, limit = 20): Promise<LeaderboardResponse> {
  await delay(700);
  const items = Array.from({ length: limit }).map((_, i) => {
    const score = 70 + Math.floor(Math.random() * 26);
    const svg = sketches[i % sketches.length];
    return {
      rank: i + 1,
      score,
      nickname: i % 3 === 0 ? '匿名' : `Runner${i + 1}`,
      imageDataUrl: toDataUrl(svg),
    };
  });
  return { promptId, items };
}
