export type ReviewMode = 'standard' | 'child';

const STORAGE_KEY = 'drawReviewMode';

export const getSavedReviewMode = (): ReviewMode => {
  if (typeof window === 'undefined') return 'standard';
  return window.localStorage.getItem(STORAGE_KEY) === 'child' ? 'child' : 'standard';
};

export const saveReviewMode = (mode: ReviewMode) => {
  window.localStorage.setItem(STORAGE_KEY, mode);
};
