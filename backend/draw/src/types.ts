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
  rank?: number;
  score: number;
  breakdown: ScoreBreakdown;
  oneLiner: string;
  tips: string[];
  imageDataUrl: string;
};

export type SecondaryReviewResult = {
  submissionId: string;
  enrichedComment: string;
};
