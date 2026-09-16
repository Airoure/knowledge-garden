import type { Question } from '@/types'

/**
 * 将秒数格式化为 m:ss 形式
 */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 将题号转为中文序号（1~10 用汉字，其余用数字）
 */
const CN_NUMS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export function formatQuestionNumber(index: number): string {
  const idx = index + 1
  return idx <= 10 ? `第${CN_NUMS[idx]}题` : `第${idx}题`
}

/**
 * 清洗答案输入：只保留数字与一个小数点（百分数正向题要输 14.3 这类小数）
 */
export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
}

/**
 * 答错反馈里展示的正确答案
 *
 * 百分数正向带 % 号（如 14.3%），逆向展示分数形式（如 1/7），其余直接给数值
 */
export function formatCorrectAnswer(q: Question): string {
  if (q.op === 'pct') return q.reversed ? `1/${q.answer}` : `${q.answer}%`
  return `${q.answer}`
}
