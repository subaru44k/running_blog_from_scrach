export type ScoreBreakdown = {
  likeness: number;
  composition: number;
  originality: number;
};

export type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } };

export type SubmitResult = {
  submissionId: string;
  score: number;
  breakdown: ScoreBreakdown;
  oneLiner: string;
  tips: string[];
  childOneLiner: string;
  childTips: string[];
  rankingEligible: boolean;
  isRanked: boolean;
  rank?: number;
};

export type LeaderboardItem = {
  rank: number;
  score: number;
  nickname: string;
  submissionId: string;
  imageDataUrl: string;
};

export type LeaderboardResponse = {
  promptId: string;
  items: LeaderboardItem[];
};

export type SubmissionDetailResponse = {
  submissionId: string;
  promptId: string;
  promptText: string;
  createdAt: string;
  rankingEligible: boolean;
  rank?: number;
  score: number;
  breakdown: ScoreBreakdown;
  oneLiner: string;
  tips: string[];
  childOneLiner: string;
  childTips: string[];
  imageDataUrl: string;
};

export type SecondaryReviewResult = {
  submissionId: string;
  enrichedComment: string;
};
