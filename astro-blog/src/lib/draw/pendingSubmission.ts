import { submitDrawing } from './api';

export type PendingSubmission = { promptId: string; promptText?: string; submissionId: string; imageKey: string; nickname?: string };
export const PENDING_KEY = 'drawPendingSubmission';
export function getPendingSubmission(promptId: string, submissionId: string): PendingSubmission | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    return pending?.promptId === promptId && pending?.submissionId === submissionId && typeof pending.imageKey === 'string' ? pending : null;
  } catch { return null; }
}
// React effects and retry clicks can share the same request; reloads use backend idempotency.
const requests = new Map<string, ReturnType<typeof submitDrawing>>();
export function scorePendingSubmission(pending: PendingSubmission) {
  const key = `${pending.promptId}/${pending.submissionId}`;
  let request = requests.get(key);
  if (!request) {
    request = submitDrawing(pending).finally(() => requests.delete(key));
    requests.set(key, request);
  }
  return request;
}
