import type { Operation, Difficulty, Question, QuestionDirection, BattleConfig } from './types.js'

/** 运算符号映射 */
const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
  square: '²',
  mul19: '×',
  pct: '%',
}

/**
 * 百分数互化表（《常见百分化分》）
 *
 * 与前端 src/utils/questionGenerator.ts 保持一致：
 * 1/2 ~ 1/20 共 18 个常用互化，原表不含 1/15，故不收录。
 */
const PERCENT_CONVERSIONS: Array<{ den: number; pct: number }> = [
  // 一、一半一半再一半
  { den: 2, pct: 50 },
  { den: 4, pct: 25 },
  { den: 8, pct: 12.5 },
  { den: 16, pct: 6.25 },
  { den: 3, pct: 33.3 },
  { den: 6, pct: 16.7 },
  { den: 12, pct: 8.3 },
  { den: 5, pct: 20 },
  { den: 10, pct: 10 },
  { den: 20, pct: 5 },
  // 二、相互颠倒（7,14）（9,11）（6,16）
  { den: 7, pct: 14.3 },
  { den: 14, pct: 7.1 },
  { den: 11, pct: 9.1 },
  { den: 9, pct: 11.1 },
  // 三、5.963（等差数列）
  { den: 17, pct: 5.9 },
  { den: 18, pct: 5.6 },
  { den: 19, pct: 5.3 },
  // 四、1/8 → 1/13（加和为 20）中未与前文重复的
  { den: 13, pct: 7.7 },
]

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
      // 平方数：固定考 11~30（考公必背区间），不再按难度分段，
      // 20 个底数可保证一组练习内基本不重复
      const n = randInt(11, 30)
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
    case 'pct': {
      // 百分数：从《常见百分化分》表中等概率抽一个互化，与难度无关
      const { den, pct } = PERCENT_CONVERSIONS[randInt(0, PERCENT_CONVERSIONS.length - 1)]
      if (isReverseQuestion(config.direction)) {
        // 逆向：14.3% = 1/?，求分母。a 为答案（分母），b 为展示的百分数值
        return { a: den, b: pct, op, symbol: '%', answer: den, reversed: true }
      }
      // 正向：1/7 = ?%，答百分数值（可能是小数，如 14.3）
      return { a: 1, b: den, op, symbol: '/', answer: pct }
    }
  }

  return { a, b, op, symbol, answer }
}

/**
 * 题目指纹：用于判断一组练习内是否出现同一道题
 *
 * 大九九的 x×y 与 y×x 视为同一道题，故按大小排序后取指纹。
 */
function questionKey(q: Question): string {
  const lo = q.op === 'mul19' ? Math.min(q.a, q.b) : q.a
  const hi = q.op === 'mul19' ? Math.max(q.a, q.b) : q.b
  return `${q.op}:${lo}:${hi}:${q.reversed ? 'r' : 'f'}`
}

/**
 * 批量生成题目（一组练习内尽量不重复）
 *
 * 先抽一批候选，遇到组内已出现过的题就丢弃——文库上限够时整组题目不会重复；
 * 上限不足时（如平方数只有 20 个底数却要出 50 题）再补足题量，此时才允许重复。
 * 最后兜底保证不与上一题完全相同（保持原有「避免连续重复」的行为）。
 */
export function generateQuestions(config: BattleConfig): Question[] {
  const target = config.totalCount
  const questions: Question[] = []
  const used = new Set<string>()
  const maxDraws = Math.max(target * 20, target + 60)
  const same = (x: Question, y: Question) => x.a === y.a && x.b === y.b && x.op === y.op

  for (let i = 0; i < maxDraws && questions.length < target; i++) {
    const q = generateOne(config)
    const key = questionKey(q)
    if (used.has(key)) continue
    used.add(key)
    questions.push(q)
  }
  while (questions.length < target) questions.push(generateOne(config))
  // 与上一题撞题时，与后面不同的题换位
  for (let i = 1; i < questions.length; i++) {
    if (!same(questions[i], questions[i - 1])) continue
    const j = questions.findIndex((q, k) => k > i && !same(q, questions[i - 1]))
    if (j > 0) {
      const t = questions[i]
      questions[i] = questions[j]
      questions[j] = t
    }
  }

  return questions
}
