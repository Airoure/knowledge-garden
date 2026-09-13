import { describe, expect, it } from 'vitest';
import { byErrorCause, byKnowledgePoint, byStatus, filterQuestions, weakestTopics, weeklyTrend } from './stats';
import type { WrongQuestion } from '../store/types';

function q(over: Partial<WrongQuestion>): WrongQuestion {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-08-01',
    stem: '某省 2025 年 GDP 比上年增长 8.2%',
    myAnswer: 'A', correctAnswer: 'B',
    knowledgePoint: '增长率', errorCause: '计算失误',
    tags: [], status: 'unmastered', reviewCount: 0, lastReviewAt: null, reviewLog: [],
    ...over,
  };
}

describe('byKnowledgePoint', () => {
  it('counts per knowledge point in fixed order, omitting zeros', () => {
    const rows = byKnowledgePoint([q({ knowledgePoint: '比重' }), q({ knowledgePoint: '比重' }), q({ knowledgePoint: '增长率' })]);
    expect(rows).toEqual([
      { key: '增长率', count: 1 }, { key: '比重', count: 2 },
    ]);
  });
});

describe('byErrorCause', () => {
  it('counts per error cause', () => {
    const rows = byErrorCause([q({ errorCause: '审题不清' }), q({ errorCause: '计算失误' })]);
    expect(rows).toEqual([{ key: '计算失误', count: 1 }, { key: '审题不清', count: 1 }]);
  });
});

describe('byStatus', () => {
  it('counts per status', () => {
    const rows = byStatus([q({ status: 'unmastered' }), q({ status: 'mastered' }), q({ status: 'mastered' })]);
    expect(rows).toEqual([
      { status: 'unmastered', count: 1 }, { status: 'mastered', count: 2 },
    ]);
  });
});

describe('filterQuestions', () => {
  const all = [q({ stem: '比重计算', knowledgePoint: '比重', errorCause: '计算失误', tags: ['真题'] }),
               q({ stem: '增长率估算', knowledgePoint: '增长率', errorCause: '估算误差', tags: [] })];
  it('filters by knowledge points', () => {
    expect(filterQuestions(all, { kps: [], cause: '', status: '', keyword: '不存在', dateFrom: '', dateTo: '' }).length).toBe(0);
  });

  it('filters by date range inclusively (YYYY-MM-DD string compare)', () => {
    const a = q({ createdAt: '2026-07-28' });
    const b = q({ createdAt: '2026-08-01' });
    const c = q({ createdAt: '2026-08-05' });
    const base = { kps: [], cause: '', status: '', keyword: '', dateFrom: '', dateTo: '' };
    expect(filterQuestions([a, b, c], { ...base, dateFrom: '2026-08-01', dateTo: '2026-08-05' }).length).toBe(2);
  });

  it('filters by dateFrom only', () => {
    const a = q({ createdAt: '2026-07-28' });
    const b = q({ createdAt: '2026-08-01' });
    const base = { kps: [], cause: '', status: '', keyword: '', dateFrom: '', dateTo: '' };
    expect(filterQuestions([a, b], { ...base, dateFrom: '2026-08-01' }).length).toBe(1);
  });

  it('filters by dateTo only', () => {
    const a = q({ createdAt: '2026-07-28' });
    const b = q({ createdAt: '2026-08-01' });
    const base = { kps: [], cause: '', status: '', keyword: '', dateFrom: '', dateTo: '' };
    expect(filterQuestions([a, b], { ...base, dateTo: '2026-07-31' }).length).toBe(1);
  });
  it('filters by cause and status', () => {
    expect(filterQuestions(all, { kps: [], cause: '估算误差', status: '', keyword: '', dateFrom: '', dateTo: '' }).length).toBe(1);
    expect(filterQuestions(all, { kps: [], cause: '', status: 'mastered', keyword: '', dateFrom: '', dateTo: '' }).length).toBe(0);
  });
  it('matches keyword against stem, source and tags', () => {
    expect(filterQuestions(all, { kps: [], cause: '', status: '', keyword: '真题', dateFrom: '', dateTo: '' }).length).toBe(1);
    expect(filterQuestions(all, { kps: [], cause: '', status: '', keyword: '估算', dateFrom: '', dateTo: '' }).length).toBe(1);
    expect(filterQuestions(all, { kps: [], cause: '', status: '', keyword: '不存在', dateFrom: '', dateTo: '' }).length).toBe(0);
  });
});

describe('weeklyTrend', () => {
  it('buckets createdAt by ISO week start (deterministic with fixed now)', () => {
    const now = new Date('2026-08-05T12:00:00');
    const rows = weeklyTrend([q({ createdAt: '2026-07-06' }), q({ createdAt: '2026-07-07' })], 8, now);
    expect(rows.length).toBe(8);
    expect(rows[0].week).toBe('2026-06-15');
    expect(rows[0].count).toBe(0); // earliest of the 8 weeks: empty
    expect(rows[rows.length - 1].week).toBe('2026-08-03');
    expect(rows[rows.length - 1].count).toBe(0); // current week: empty (dates are past)
    const july = rows.find((r) => r.week === '2026-07-06');
    expect(july?.count).toBe(2);
  });
});

describe('weakestTopics', () => {
  it('ranks by unmastered count, default n=3', () => {
    const rows = weakestTopics([
      q({ knowledgePoint: '增长率' }),
      q({ knowledgePoint: '增长率' }),
      q({ knowledgePoint: '比重' }),
      q({ knowledgePoint: '比重', status: 'mastered' }),
      q({ knowledgePoint: '平均数' }),
      q({ knowledgePoint: '倍数' }),
      q({ knowledgePoint: '基期现期' }),
    ]);
    expect(rows).toEqual([
      { key: '增长率', count: 2 }, { key: '比重', count: 1 }, { key: '平均数', count: 1 },
    ]);
  });
});
