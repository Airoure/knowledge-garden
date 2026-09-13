import { describe, expect, it } from 'vitest';
import { isValidData, validateData } from './DataStore';
import type { AppData, Trick, WrongQuestion } from './types';

function wq(over: Partial<WrongQuestion> = {}): WrongQuestion {
  return {
    id: 'w1', createdAt: '2026-08-01', stem: '某省 2025 年 GDP 增长 8.2%',
    myAnswer: 'A', correctAnswer: 'B', knowledgePoint: '增长率', errorCause: '计算失误',
    tags: ['真题'], status: 'unmastered', reviewCount: 0, lastReviewAt: null, reviewLog: [],
    ...over,
  };
}

function trick(over: Partial<Trick> = {}): Trick {
  return { id: 't1', createdAt: '2026-08-01', title: '估算技巧', content: '先看选项差距', tags: [], pinned: false, ...over };
}

function data(over: Partial<AppData> = {}): AppData {
  return { dataVersion: 1, wrongQuestions: [wq()], tricks: [trick()], ...over };
}

describe('validateData / isValidData', () => {
  it('accepts a valid data file, including entries with optional fields absent', () => {
    const d = data({
      wrongQuestions: [{ ...wq(), source: undefined, options: undefined, analysis: undefined }],
      tricks: [{ ...trick(), knowledgePoint: undefined }],
    });
    expect(validateData(d)).toBeNull();
    expect(isValidData(d)).toBe(true);
  });

  it('accepts an empty data file', () => {
    expect(validateData({ dataVersion: 1, wrongQuestions: [], tricks: [] })).toBeNull();
  });

  it('rejects a non-object payload', () => {
    expect(validateData(null)).toContain('不是对象');
    expect(validateData('x')).toContain('不是对象');
  });

  it('rejects a wrong question missing createdAt, naming the offending entry and field', () => {
    const d = data();
    const bad = d.wrongQuestions[0] as Partial<WrongQuestion>;
    delete bad.createdAt;
    const reason = validateData(d);
    expect(reason).not.toBeNull();
    expect(isValidData(d)).toBe(false);
    expect(reason).toContain('第 1 条错题');
    expect(reason).toContain('createdAt');
  });

  it('rejects a wrong question with non-array tags', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).tags = '真题';
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('tags 必须是字符串数组');
  });

  it('rejects a wrong question with a tag that is not a string', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).tags = ['真题', 42];
    expect(isValidData(d)).toBe(false);
  });

  it('rejects a wrong question missing reviewLog', () => {
    const d = data();
    const bad = d.wrongQuestions[0] as Partial<WrongQuestion>;
    delete bad.reviewLog;
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('reviewLog');
  });

  it('rejects a wrong question with an invalid status', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).status = 'failed';
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('status');
  });

  it('rejects a trick missing pinned', () => {
    const d = data();
    const bad = d.tricks[0] as Partial<Trick>;
    delete bad.pinned;
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('第 1 条 Trick');
    expect(validateData(d)).toContain('pinned');
  });

  it('points at the second entry when the first is fine', () => {
    const d = data({ wrongQuestions: [wq(), { ...wq({ id: 'w2' }), tags: 'not-array' as unknown as string[] }] });
    expect(validateData(d)).toContain('第 2 条错题');
  });

  it('accepts wrong questions with stemImages', () => {
    const d = data({ wrongQuestions: [{ ...wq(), stemImages: ['data:image/jpeg;base64,abc'] }] });
    expect(validateData(d)).toBeNull();
  });

  it('rejects wrong questions whose stemImages is not a string array', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).stemImages = 'data:image/jpeg;base64,abc';
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('stemImages 必须是字符串数组');
  });

  it('rejects wrong questions with a non-string stemImages entry', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).stemImages = [42];
    expect(isValidData(d)).toBe(false);
  });

  it('accepts wrong questions with trickIds', () => {
    const d = data({ wrongQuestions: [{ ...wq(), trickIds: ['t1', 't2'] }] });
    expect(validateData(d)).toBeNull();
  });

  it('rejects wrong questions whose trickIds is not a string array', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).trickIds = 't1';
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('trickIds 必须是字符串数组');
  });

  it('rejects wrong questions with a non-string trickIds entry', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).trickIds = [42];
    expect(isValidData(d)).toBe(false);
  });

  it('accepts wrong questions with optionsImages', () => {
    expect(validateData(data({ wrongQuestions: [{ ...wq(), optionsImages: ['data:image/jpeg;base64,AAA'] }] }))).toBeNull();
  });

  it('rejects wrong questions whose optionsImages is not a string array', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).optionsImages = 'x';
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('optionsImages 必须是字符串数组');
  });

  it('rejects wrong questions with a non-string optionsImages entry', () => {
    const d = data();
    (d.wrongQuestions[0] as unknown as Record<string, unknown>).optionsImages = [42];
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('optionsImages');
  });

  it('accepts tricks with contentImages', () => {
    expect(validateData(data({ tricks: [{ ...trick(), contentImages: ['data:image/jpeg;base64,BBB'] }] }))).toBeNull();
  });

  it('rejects tricks whose contentImages is not a string array', () => {
    const d = data();
    (d.tricks[0] as unknown as Record<string, unknown>).contentImages = 42;
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('contentImages');
  });

  it('rejects tricks with a non-string contentImages entry', () => {
    const d = data();
    (d.tricks[0] as unknown as Record<string, unknown>).contentImages = [42];
    expect(isValidData(d)).toBe(false);
    expect(validateData(d)).toContain('contentImages');
  });
});
