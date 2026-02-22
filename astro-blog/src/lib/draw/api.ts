import type { LeaderboardResponse, PromptInfo, SecondaryReviewResult, SubmitResult } from './types';

const apiBase = (import.meta as any).env?.PUBLIC_DRAW_API_BASE || '';

type UploadUrlResponse = {
  submissionId: string;
  imageKey: string;
  putUrl: string;
  promptId?: string;
  promptText?: string;
};

type SecondaryStatus =
  | { status: 'pending' }
  | { status: 'done'; result: SecondaryReviewResult }
  | { status: 'not_found' };

class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const buildUrl = (path: string) => `${apiBase}${path}`;

const parseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const requestJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body = await parseJson(res);
    const msg = body?.error || body?.message || res.statusText || 'request failed';
    throw new ApiError(msg, res.status);
  }
  return (await parseJson(res)) as T;
};

export async function getUploadUrl(promptId: string): Promise<UploadUrlResponse> {
  if (!apiBase) throw new ApiError('APIの設定が見つかりません。PUBLIC_DRAW_API_BASE を設定してください。');
  const month = (() => {
    const m = /^prompt-(\d{4}-\d{2})$/.exec(promptId || '');
    return m ? m[1] : undefined;
  })();
  return requestJson<UploadUrlResponse>(buildUrl('/api/draw/upload-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promptId, month }),
  });
}

export async function getPrompt(month?: string): Promise<PromptInfo> {
  if (!apiBase) throw new ApiError('APIの設定が見つかりません。PUBLIC_DRAW_API_BASE を設定してください。');
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  return requestJson<PromptInfo>(buildUrl(`/api/draw/prompt${qs}`));
}

export async function putToS3(putUrl: string, blob: Blob, contentType: string) {
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) {
    throw new ApiError(`アップロードに失敗しました (${res.status})`, res.status);
  }
}

export async function submitDrawing(params: {
  promptId: string;
  promptText?: string;
  submissionId: string;
  imageKey: string;
  nickname?: string;
}): Promise<SubmitResult> {
  if (!apiBase) throw new ApiError('APIの設定が見つかりません。PUBLIC_DRAW_API_BASE を設定してください。');
  return requestJson<SubmitResult>(buildUrl('/api/draw/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function getLeaderboard(promptId: string, limit = 20): Promise<LeaderboardResponse> {
  if (!apiBase) throw new ApiError('APIの設定が見つかりません。PUBLIC_DRAW_API_BASE を設定してください。');
  const qs = new URLSearchParams({ limit: String(limit) });
  if (/^prompt-\d{4}-\d{2}$/.test(promptId)) {
    qs.set('month', promptId.replace(/^prompt-/, ''));
  } else {
    qs.set('promptId', promptId);
  }
  return requestJson<LeaderboardResponse>(buildUrl(`/api/draw/leaderboard?${qs.toString()}`));
}

export async function getSecondaryReview(promptId: string, submissionId: string): Promise<SecondaryStatus> {
  if (!apiBase) throw new ApiError('APIの設定が見つかりません。PUBLIC_DRAW_API_BASE を設定してください。');
  const qs = new URLSearchParams({ promptId, submissionId });
  const res = await fetch(buildUrl(`/api/draw/secondary?${qs.toString()}`));
  if (res.status === 202) return { status: 'pending' };
  if (res.status === 404) return { status: 'not_found' };
  if (!res.ok) {
    const body = await parseJson(res);
    const msg = body?.error || body?.message || res.statusText || 'request failed';
    throw new ApiError(msg, res.status);
  }
  const json = (await parseJson(res)) as SecondaryReviewResult;
  return { status: 'done', result: json };
}

export { ApiError };
