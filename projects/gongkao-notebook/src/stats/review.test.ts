import { describe, expect, it } from 'vitest';
import { applyReviewResult } from './review';
import type { WrongQuestion } from '../store/types';

const base: WrongQuestion = {
  id: 'q1', createdAt: '2026-08-01', stem: '题干', myAnswer: 'A', correctAnswer: 'B',
  knowledgePoint: '增长率', errorCause: '计算失误', tags: [],
  status: 'unmastered', reviewCount: 0, lastReviewAt: null, reviewLog: [],
};

describe('applyReviewResult', () => {
  it('advances status on correct answer and logs it', () => {
    const r = applyReviewResult(base, true, new Date('2026-08-05T10:00:00Z'));
    expect(r.status).toBe('reviewing');
    expect(r.reviewCount).toBe(1);
    expect(r.lastReviewAt).toBe('2026-08-05T10:00:00.000Z');
    expect(r.reviewLog).toEqual([{ at: '2026-08-05T10:00:00.000Z', correct: true }]);
  });
  it('advances reviewing -> mastered', () => {
    const r = applyReviewResult({ ...base, status: 'reviewing' }, true);
    expect(r.status).toBe('mastered');
  });
  it('stays mastered when answered correctly again', () => {
    const r = applyReviewResult({ ...base, status: 'mastered' }, true);
    expect(r.status).toBe('mastered');
  });
  it('resets to unmastered on wrong answer', () => {
    const r = applyReviewResult({ ...base, status: 'mastered', reviewCount: 3 }, false);
    expect(r.status).toBe('unmastered');
    expect(r.reviewCount).toBe(4);
    expect(r.reviewLog.at(-1)).toEqual({ at: expect.any(String), correct: false });
  });
  it('does not mutate the input object', () => {
    const before = JSON.stringify(base);
    applyReviewResult(base, true);
    expect(JSON.stringify(base)).toBe(before);
  });
});
