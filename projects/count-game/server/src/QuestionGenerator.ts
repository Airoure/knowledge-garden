import type { Operation, Difficulty, Question, QuestionDirection, BattleConfig } from './types.js'

/** 运算符号映射 */
const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
  square: '²',
  mul19: '×',
}

/** 生成 [min, max] 范围内的随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 判断单道题是否应出逆向
 *
 * mixed 时每题独立随机，让正向 / 逆向交错出现
 */
function isReverseQuestion(direction: QuestionDirection | undefined): boolean {
  if (direction === 'reverse') return true
  if (direction === 'mixed') return Math.random() < 0.5
  return false
}

/** 根据配置生成单道题目 */
function generateOne(config: BattleConfig): Question {
  const ops = config.operations
  const op = ops[randInt(0, ops.length - 1)]
  const isEasy = config.difficulty === 'easy'
  const symbol = OPERATION_SYMBOLS[op]

  let a: number
  let b: number
  let answer: number

  if (isEasy) {
    a = randInt(1, 9)
    b = randInt(1, 9)
  } else {
    a = randInt(10, 99)
    b = randInt(10, 99)
  }

  switch (op) {
    case 'add':
      answer = a + b
      break
    case 'sub':
      if (a < b) [a, b] = [b, a]
      answer = a - b
      break
    case 'mul':
      answer = a * b
      break
    case 'div':
      b = isEasy ? randInt(1, 9) : randInt(2, 12)
      answer = isEasy ? randInt(1, 9) : randInt(2, 15)
      a = b * answer
      break
    case 'square': {
      // 平方数：入门练 2~15，进阶练 16~25，覆盖考公必背的 1~25 平方数
      const n = isEasy ? randInt(2, 15) : randInt(16, 25)
      if (isReverseQuestion(config.direction)) {
        // 逆向：?² = n²，求 n。a 为答案（根），b 为展示的平方值
        return { a: n, b: n * n, op, symbol: '²', answer: n, reversed: true }
      }
      a = n
      b = n
      answer = n * n
      break
    }
    case 'mul19': {
      // 大九九：入门 11~15 互乘，进阶完整 11~19 互乘
      const max = isEasy ? 15 : 19
      const x = randInt(11, max)
      const y = randInt(11, max)
      if (isReverseQuestion(config.direction)) {
        // 逆向：? × y = x·y，求 x。a 为答案（因子），b 为展示的已知因子
        return { a: x, b: y, op, symbol: '×', answer: x, reversed: true }
      }
      a = x
      b = y
      answer = x * y
      break
    }
  }

  return { a, b, op, symbol, answer }
}

/** 批量生成题目（避免连续重复） */
export function generateQuestions(config: BattleConfig): Question[] {
  const questions: Question[] = []
  let last: Question | null = null

  for (let i = 0; i < config.totalCount; i++) {
    let q: Question
    do {
      q = generateOne(config)
    } while (last && q.a === last.a && q.b === last.b && q.op === last.op)
    questions.push(q)
    last = q
  }

  return questions
}
