import type { AppData } from './types';

const API = '/api/data';

export async function loadData(): Promise<AppData> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('加载数据失败');
  const parsed: unknown = await res.json();
  const reason = validateData(parsed);
  if (reason) throw new Error(`数据文件格式不正确：${reason}`);
  return parsed as AppData;
}

export async function saveData(data: AppData): Promise<void> {
  const res = await fetch(API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('保存数据失败');
}

const VALID_STATUSES = ['unmastered', 'reviewing', 'mastered'];

/** Returns null when `x` matches the AppData schema, otherwise a specific Chinese reason. */
export function validateData(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return '文件不是对象';
  const o = x as Record<string, unknown>;
  if (o.dataVersion !== 1) return 'dataVersion 必须为 1';
  if (!Array.isArray(o.wrongQuestions)) return '缺少 wrongQuestions 数组';
  if (!Array.isArray(o.tricks)) return '缺少 tricks 数组';

  for (let i = 0; i < o.wrongQuestions.length; i++) {
    const e = o.wrongQuestions[i];
    const n = i + 1;
    if (typeof e !== 'object' || e === null) return `第 ${n} 条错题不是对象`;
    const rec = e as Record<string, unknown>;
    for (const f of ['id', 'createdAt', 'stem', 'myAnswer', 'correctAnswer', 'knowledgePoint', 'errorCause']) {
      if (rec[f] === undefined) return `第 ${n} 条错题缺少 ${f}`;
      if (typeof rec[f] !== 'string') return `第 ${n} 条错题的 ${f} 必须是字符串`;
    }
    if (!Array.isArray(rec.tags) || !rec.tags.every((t) => typeof t === 'string')) {
      return `第 ${n} 条错题的 tags 必须是字符串数组`;
    }
    if (rec.stemImages !== undefined && (!Array.isArray(rec.stemImages) || !rec.stemImages.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条错题的 stemImages 必须是字符串数组`;
    }
    if (rec.optionsImages !== undefined && (!Array.isArray(rec.optionsImages) || !rec.optionsImages.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条错题的 optionsImages 必须是字符串数组`;
    }
    if (rec.trickIds !== undefined && (!Array.isArray(rec.trickIds) || !rec.trickIds.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条错题的 trickIds 必须是字符串数组`;
    }
    if (typeof rec.status !== 'string' || !VALID_STATUSES.includes(rec.status)) {
      return `第 ${n} 条错题的 status 无效（应为 unmastered/reviewing/mastered）`;
    }
    if (typeof rec.reviewCount !== 'number') return `第 ${n} 条错题的 reviewCount 必须是数字`;
    if (rec.lastReviewAt !== null && typeof rec.lastReviewAt !== 'string') {
      return `第 ${n} 条错题的 lastReviewAt 必须是字符串或 null`;
    }
    if (!Array.isArray(rec.reviewLog) || !rec.reviewLog.every((r) => {
      return typeof r === 'object' && r !== null
        && typeof (r as Record<string, unknown>).at === 'string'
        && typeof (r as Record<string, unknown>).correct === 'boolean';
    })) {
      return `第 ${n} 条错题的 reviewLog 格式不正确（应为 {at: string, correct: boolean} 数组）`;
    }
  }

  for (let i = 0; i < o.tricks.length; i++) {
    const e = o.tricks[i];
    const n = i + 1;
    if (typeof e !== 'object' || e === null) return `第 ${n} 条 Trick 不是对象`;
    const rec = e as Record<string, unknown>;
    for (const f of ['id', 'createdAt', 'title', 'content']) {
      if (rec[f] === undefined) return `第 ${n} 条 Trick 缺少 ${f}`;
      if (typeof rec[f] !== 'string') return `第 ${n} 条 Trick 的 ${f} 必须是字符串`;
    }
    if (!Array.isArray(rec.tags) || !rec.tags.every((t) => typeof t === 'string')) {
      return `第 ${n} 条 Trick 的 tags 必须是字符串数组`;
    }
    if (typeof rec.pinned !== 'boolean') return `第 ${n} 条 Trick 的 pinned 必须是布尔值`;
    if (rec.contentImages !== undefined && (!Array.isArray(rec.contentImages) || !rec.contentImages.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条 Trick 的 contentImages 必须是字符串数组`;
    }
  }

  return null;
}

export function isValidData(x: unknown): x is AppData {
  return validateData(x) === null;
}
