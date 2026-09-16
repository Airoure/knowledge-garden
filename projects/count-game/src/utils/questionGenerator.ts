import type {
  Operation,
  OperationMeta,
  Difficulty,
  DifficultyMeta,
  Question,
  QuestionDirection,
  PracticeConfig,
  GameMode,
  GradeInfo,
  PracticeResult,
} from '@/types'

/** 运算符号与标签映射 */
export const OPERATION_META: Record<Operation, OperationMeta> = {
  add: { op: 'add', symbol: '+', label: '加法' },
  sub: { op: 'sub', symbol: '−', label: '减法' },
  mul: { op: 'mul', symbol: '×', label: '乘法' },
  div: { op: 'div', symbol: '÷', label: '除法' },
  square: { op: 'square', symbol: 'n²', label: '平方数' },
  mul19: { op: 'mul19', symbol: '九九', label: '大九九' },
}

/** 运算选项（按固定顺序） */
export const OPERATION_LIST: OperationMeta[] = [
  OPERATION_META.add,
  OPERATION_META.sub,
  OPERATION_META.mul,
  OPERATION_META.div,
  OPERATION_META.square,
  OPERATION_META.mul19,
]

/** 难度元数据 */
export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: {
    diff: 'easy',
    title: '入门 · 一位数',
    desc: '一位数 与 一位数 运算',
    example: '7 + 8 = ?',
  },
  hard: {
    diff: 'hard',
    title: '进阶 · 两位数',
    desc: '两位数 与 两位数 运算',
    example: '36 + 47 = ?',
  },
}

/** 难度选项（按固定顺序） */
export const DIFFICULTY_LIST: DifficultyMeta[] = [
  DIFFICULTY_META.easy,
  DIFFICULTY_META.hard,
]

/** 各运算组的难度文案：四则合并为一组，大九九按基数范围表述（平方数固定 11~30，不参与难度分档） */
const DIFFICULTY_GROUP_META = {
  basic: {
    easy: { desc: '四则 · 一位数与一位数', example: '7 + 8 = ?' },
    hard: { desc: '四则 · 两位数与两位数', example: '36 + 47 = ?' },
  },
  mul19: {
    easy: { desc: '大九九 · 11 ~ 15 互乘', example: '13 × 14 = ?' },
    hard: { desc: '大九九 · 11 ~ 19 互乘', example: '17 × 18 = ?' },
  },
} as const

/**
 * 根据所选运算生成难度选项文案
 *
 * 大九九的难度含义是基数范围而非位数，文案按所选运算动态生成，
 * 避免"一位数 / 两位数"的描述张冠李戴。
 * 纯四则时维持原有文案不变；混合选择时逐组列出说明。
 *
 * 平方数已固定考 11~30，与难度无关，因此不出现在难度文案里；
 * 若只选了平方数，难度区整体不展示（见 shouldShowDifficulty）。
 */
export function getDifficultyOptions(operations: Operation[]): DifficultyMeta[] {
  const groups: Array<keyof typeof DIFFICULTY_GROUP_META> = []
  if (operations.some((op) => op === 'add' || op === 'sub' || op === 'mul' || op === 'div')) {
    groups.push('basic')
  }
  if (operations.includes('mul19')) groups.push('mul19')

  if (groups.length === 0 || (groups.length === 1 && groups[0] === 'basic')) {
    return DIFFICULTY_LIST
  }

  return DIFFICULTY_LIST.map(({ diff }) => ({
    diff,
    title: diff === 'easy' ? '入门' : '进阶',
    desc: groups.map((g) => DIFFICULTY_GROUP_META[g][diff].desc).join('；'),
    example: DIFFICULTY_GROUP_META[groups[0]][diff].example,
  }))
}

/**
 * 是否需要展示「难度等级」选择
 *
 * 平方数已固定考 11~30（与难度无关），只选平方数时该选项没有意义，直接隐藏；
 * 与四则 / 大九九混合选择时仍需展示（难度对它们依然生效）。
 */
export function shouldShowDifficulty(operations: Operation[]): boolean {
  return operations.some((op) => op !== 'square')
}

/** 固定模式题量选项 */
export const COUNT_OPTIONS = [10, 20, 30, 50] as const

/** 出题方向选项（仅平方数 / 大九九生效） */
export const DIRECTION_OPTIONS: Array<{ value: QuestionDirection; label: string; desc: string }> = [
  { value: 'forward', label: '正向', desc: '12² = ?' },
  { value: 'reverse', label: '逆向', desc: '?² = 144' },
  { value: 'mixed', label: '混合', desc: '两种混出' },
]

/** 无尽模式初始时间选项（秒） */
export const TIME_OPTIONS = [60, 120, 180, 300] as const

/** 无尽模式答对加时选项（秒） */
export const BONUS_OPTIONS = [0, 3, 5, 10] as const

/** 无尽模式答错扣时选项（秒） */
export const PENALTY_OPTIONS = [0, 3, 5, 10] as const

/** 评级阈值配置 */
const GRADE_THRESHOLDS = [
  { min: 90, grade: { symbol: '优', title: '算无遗漏', subtitle: 'EXCELLENT' } },
  { min: 75, grade: { symbol: '良', title: '颇有功底', subtitle: 'GOOD' } },
  { min: 60, grade: { symbol: '中', title: '尚需修炼', subtitle: 'FAIR' } },
  { min: 0, grade: { symbol: '勉', title: '再接再厉', subtitle: 'KEEP GOING' } },
] as const

/**
 * 生成 [min, max] 范围内的随机整数
 */
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

/**
 * 根据配置生成单道题目
 */
function generateOne(config: PracticeConfig): Question {
  const ops = config.operations
  const op = ops[randInt(0, ops.length - 1)]
  const isEasy = config.difficulty === 'easy'
  const meta = OPERATION_META[op]

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
  }

  // 平方数题目符号为 ²，大九九用普通乘号；
  // meta.symbol 里的 n² / 九九 仅用于设置页按钮与履历标签
  const symbol = op === 'square' ? '²' : op === 'mul19' ? '×' : meta.symbol

  return { a, b, op, symbol, answer }
}

/**
 * 判断两道题是否完全相同
 */
function isSameQuestion(q1: Question, q2: Question | null): boolean {
  if (!q2) return false
  return q1.a === q2.a && q1.b === q2.b && q1.op === q2.op
}

/**
 * 生成单道题目（避免与上一题重复）
 */
export function generateSingleQuestion(
  config: PracticeConfig,
  lastQuestion?: Question | null,
): Question {
  let q: Question
  do {
    q = generateOne(config)
  } while (lastQuestion && isSameQuestion(q, lastQuestion))
  return q
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
export function generateQuestions(config: PracticeConfig): Question[] {
  const target = config.totalCount
  const questions: Question[] = []
  const used = new Set<string>()
  const maxDraws = Math.max(target * 20, target + 60)

  for (let i = 0; i < maxDraws && questions.length < target; i++) {
    const q = generateOne(config)
    const key = questionKey(q)
    if (used.has(key)) continue
    used.add(key)
    questions.push(q)
  }
  while (questions.length < target) {
    questions.push(generateSingleQuestion(config, questions[questions.length - 1]))
  }
  // 与上一题撞题时，与后面不同的题换位
  for (let i = 1; i < questions.length; i++) {
    if (questionKey(questions[i]) !== questionKey(questions[i - 1])) continue
    const j = questions.findIndex((q, k) => k > i && questionKey(q) !== questionKey(questions[i - 1]))
    if (j > 0) {
      const t = questions[i]
      questions[i] = questions[j]
      questions[j] = t
    }
  }

  return questions
}

/**
 * 根据正确率计算评级
 */
export function calculateGrade(accuracy: number): GradeInfo {
  for (const threshold of GRADE_THRESHOLDS) {
    if (accuracy >= threshold.min) {
      return { ...threshold.grade }
    }
  }
  return { ...GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1].grade }
}

/**
 * 汇总练习结果
 */
export function buildPracticeResult(
  mode: GameMode,
  correctCount: number,
  totalCount: number,
  timeElapsed: number,
): PracticeResult {
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  return {
    mode,
    correctCount,
    totalCount,
    accuracy,
    timeElapsed,
    grade: calculateGrade(accuracy),
  }
}
