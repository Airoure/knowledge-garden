import type { Question, Operation } from '@/types'

/** 高照题库仅支持四则运算文本；square / mul19 是设置页专属模块，不出现在题库 */
type WorksheetOperation = Extract<Operation, 'add' | 'sub' | 'mul' | 'div'>

/** 运算符字符 → Operation 类型映射 */
const OP_MAP: Record<string, WorksheetOperation> = {
  '+': 'add',
  '-': 'sub',
  '\u2212': 'sub', // − U+2212 MINUS SIGN
  '\u00d7': 'mul', // × U+00D7 MULTIPLICATION SIGN
  x: 'mul',
  X: 'mul',
  '*': 'mul',
  '\u00f7': 'div', // ÷ U+00F7 DIVISION SIGN
  '/': 'div',
}

/** Operation → 显示符号映射（与 OPERATION_META 保持一致） */
const SYMBOL_MAP: Record<WorksheetOperation, string> = {
  add: '+',
  sub: '\u2212', // −
  mul: '\u00d7', // ×
  div: '\u00f7', // ÷
}

/** 匹配 "数字 运算符 数字" 的正则 */
const QUESTION_RE = /^(\d+)\s*([+\-\u2212\u00d7xX*\u00f7/])\s*(\d+)$/

/**
 * 根据运算类型计算答案
 *
 * 除法使用向下取整（与高照数算练习场景一致）
 */
function computeAnswer(a: number, b: number, op: WorksheetOperation): number {
  switch (op) {
    case 'add':
      return a + b
    case 'sub':
      return a - b
    case 'mul':
      return a * b
    case 'div':
      return Math.floor(a / b)
  }
}

/**
 * 将单个题目字符串解析为 Question 对象
 *
 * @example
 * parseQuestionString('25×6')   // { a: 25, b: 6, op: 'mul', symbol: '×', answer: 150 }
 * parseQuestionString('57+64')  // { a: 57, b: 64, op: 'add', symbol: '+', answer: 121 }
 * parseQuestionString('57-64')  // { a: 57, b: 64, op: 'sub', symbol: '−', answer: -7 }
 * parseQuestionString('98585÷51') // { a: 98585, b: 51, op: 'div', symbol: '÷', answer: 1933 }
 *
 * @returns 解析失败时返回 null
 */
export function parseQuestionString(q: string): Question | null {
  const match = q.trim().match(QUESTION_RE)
  if (!match) return null

  const a = parseInt(match[1], 10)
  const opChar = match[2]
  const b = parseInt(match[3], 10)

  const op = OP_MAP[opChar]
  if (!op) return null

  // 除数为零无法计算
  if (op === 'div' && b === 0) return null

  return {
    a,
    b,
    op,
    symbol: SYMBOL_MAP[op],
    answer: computeAnswer(a, b, op),
  }
}

/**
 * 批量解析题目字符串，跳过无法解析的项
 */
export function parseQuestionStrings(qs: string[]): Question[] {
  const result: Question[] = []
  for (const q of qs) {
    const parsed = parseQuestionString(q)
    if (parsed) result.push(parsed)
  }
  return result
}
