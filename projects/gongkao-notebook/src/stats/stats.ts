import { KNOWLEDGE_POINTS, ERROR_CAUSES, type WrongQuestion } from '../store/types';

export interface QuestionFilter {
  kps: string[];
  cause: string;
  status: string;
  keyword: string;
  dateFrom: string; // YYYY-MM-DD，空串 = 不限制
  dateTo: string;
}

export function filterQuestions(qs: WrongQuestion[], f: QuestionFilter): WrongQuestion[] {
  const kw = f.keyword.trim().toLowerCase();
  return qs.filter((q) => {
    if (f.kps.length > 0 && !f.kps.includes(q.knowledgePoint)) return false;
    if (f.cause && q.errorCause !== f.cause) return false;
    if (f.status && q.status !== f.status) return false;
    if (f.dateFrom && q.createdAt < f.dateFrom) return false;
    if (f.dateTo && q.createdAt > f.dateTo) return false;
    if (kw) {
      const hay = [q.stem, q.source ?? '', ...q.tags].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

export function byKnowledgePoint(qs: WrongQuestion[]): { key: string; count: number }[] {
  return KNOWLEDGE_POINTS
    .map((key) => ({ key, count: qs.filter((q) => q.knowledgePoint === key).length }))
    .filter((r) => r.count > 0);
}

export function byErrorCause(qs: WrongQuestion[]): { key: string; count: number }[] {
  return ERROR_CAUSES
    .map((key) => ({ key, count: qs.filter((q) => q.errorCause === key).length }))
    .filter((r) => r.count > 0);
}

export function byStatus(qs: WrongQuestion[]): { status: string; count: number }[] {
  return (['unmastered', 'reviewing', 'mastered'] as const)
    .map((status) => ({ status, count: qs.filter((q) => q.status === status).length }))
    .filter((r) => r.count > 0);
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function weeklyTrend(qs: WrongQuestion[], weeks = 8, now = new Date()): { week: string; count: number }[] {
  const thisWeek = startOfWeek(now);
  const rows: { week: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = qs.filter((q) => {
      const d = parseDate(q.createdAt);
      return d >= start && d < end;
    }).length;
    const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    rows.push({ week: label, count });
  }
  return rows;
}

export function weakestTopics(qs: WrongQuestion[], n = 3): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const q of qs) {
    if (q.status === 'unmastered') counts.set(q.knowledgePoint, (counts.get(q.knowledgePoint) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
