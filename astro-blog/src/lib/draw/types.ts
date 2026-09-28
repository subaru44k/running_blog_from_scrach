export type PromptInfo = {
  promptId: string;
  dateJst: string;
  promptText: string;
  rankingEligible: boolean;
};

export type ScoreBreakdown = {
  likeness: number;
  composition: number;
  originality: number;
};

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

export type SubmissionDetail = {
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
