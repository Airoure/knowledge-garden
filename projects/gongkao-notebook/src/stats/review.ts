import type { WrongQuestion } from '../store/types';

export function applyReviewResult(q: WrongQuestion, correct: boolean, now = new Date()): WrongQuestion {
  const at = now.toISOString();
  const status = correct
    ? (q.status === 'unmastered' ? 'reviewing' : q.status === 'reviewing' ? 'mastered' : 'mastered')
    : 'unmastered';
  return {
    ...q,
    status,
    reviewCount: q.reviewCount + 1,
    lastReviewAt: at,
    reviewLog: [...q.reviewLog, { at, correct }],
  };
}
