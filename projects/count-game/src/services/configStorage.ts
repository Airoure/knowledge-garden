import type {
  Difficulty,
  EndlessSettings,
  GameMode,
  Operation,
  PracticeConfig,
  QuestionDirection,
} from '@/types'
import { shouldShowDifficulty } from '@/utils/questionGenerator'

/** 默认练习配置（首次使用 / 存储数据失效时的兜底值） */
export const DEFAULT_CONFIG: PracticeConfig = {
  mode: 'fixed',
  operations: ['add', 'sub', 'mul', 'div'],
  difficulty: 'easy',
  direction: 'forward',
  totalCount: 20,
  endless: {
    initialTime: 60,
    correctBonus: 3,
    wrongPenalty: 3,
  },
}

/** localStorage 键名 */
const LAST_CONFIG_KEY = 'cg_last_config'
const PRESETS_KEY = 'cg_presets'

/** 自定义出题方案最多保存个数 */
export const MAX_PRESETS = 6

/** 自定义出题方案 */
export interface ConfigPreset {
  id: string
  /** 方案名（按配置自动生成，如「平方 · 逆向 · 无尽」） */
  name: string
  config: PracticeConfig
  savedAt: number
}

const GAME_MODES: GameMode[] = ['fixed', 'endless', 'battle']
const OPERATIONS: Operation[] = ['add', 'sub', 'mul', 'div', 'square', 'mul19', 'pct']
const DIFFICULTIES: Difficulty[] = ['easy', 'hard']
const DIRECTIONS: QuestionDirection[] = ['forward', 'reverse', 'mixed']

/** 运算短标签（用于生成方案名） */
const OP_SHORT_LABEL: Record<Operation, string> = {
  add: '加',
  sub: '减',
  mul: '乘',
  div: '除',
  square: '平方',
  mul19: '九九',
  pct: '百分',
}

const DIRECTION_LABEL: Record<QuestionDirection, string> = {
  forward: '正向',
  reverse: '逆向',
  mixed: '混合',
}

/**
 * 校验并修复一份配置数据
 *
 * localStorage 里的数据可能来自旧版本或被手动改动，
 * 逐字段校验，非法字段回退到默认值，保证返回值始终是合法配置。
 */
export function sanitizeConfig(raw: unknown): PracticeConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  const r = raw as Record<string, unknown>

  const mode = GAME_MODES.includes(r.mode as GameMode) ? (r.mode as GameMode) : DEFAULT_CONFIG.mode

  const rawOps = Array.isArray(r.operations) ? (r.operations as unknown[]) : []
  const operations = OPERATIONS.filter((op) => rawOps.includes(op))
  const validOps = operations.length > 0 ? operations : [...DEFAULT_CONFIG.operations]

  const difficulty = DIFFICULTIES.includes(r.difficulty as Difficulty)
    ? (r.difficulty as Difficulty)
    : DEFAULT_CONFIG.difficulty

  const direction = DIRECTIONS.includes(r.direction as QuestionDirection)
    ? (r.direction as QuestionDirection)
    : DEFAULT_CONFIG.direction

  const totalCount =
    typeof r.totalCount === 'number' &&
    Number.isInteger(r.totalCount) &&
    r.totalCount > 0 &&
    r.totalCount <= 500
      ? r.totalCount
      : DEFAULT_CONFIG.totalCount

  const e = (r.endless && typeof r.endless === 'object' ? r.endless : {}) as Record<string, unknown>
  const seconds = (v: unknown, fb: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 3600 ? v : fb
  const endless: EndlessSettings = {
    initialTime: seconds(e.initialTime, DEFAULT_CONFIG.endless.initialTime),
    correctBonus: seconds(e.correctBonus, DEFAULT_CONFIG.endless.correctBonus),
    wrongPenalty: seconds(e.wrongPenalty, DEFAULT_CONFIG.endless.wrongPenalty),
  }

  return { mode, operations: validOps, difficulty, direction, totalCount, endless }
}

/** 读取上次使用的练习配置（无记录或数据失效时返回 null） */
export function loadLastConfig(): PracticeConfig | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY)
    if (!raw) return null
    return sanitizeConfig(JSON.parse(raw))
  } catch {
    return null
  }
}

/** 持久化当前练习配置（localStorage 不可用时静默失败） */
export function saveLastConfig(config: PracticeConfig): void {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // ignore
  }
}

/** 生成方案 ID */
function genId(): string {
  const c = crypto as Crypto & { randomUUID?: () => string }
  if (typeof crypto !== 'undefined' && c.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 读取全部自定义出题方案 */
export function loadPresets(): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((p) => p && typeof p === 'object' && typeof p.name === 'string')
      .slice(0, MAX_PRESETS)
      .map((p) => ({
        id: typeof p.id === 'string' ? p.id : genId(),
        name: p.name,
        config: sanitizeConfig(p.config),
        savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0,
      }))
  } catch {
    return []
  }
}

/** 持久化自定义出题方案列表 */
export function savePresets(presets: ConfigPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)))
  } catch {
    // ignore
  }
}

/**
 * 生成方案名：运算 · 难度 · 方向 · 模式
 *
 * 难度只在四则 / 大九九参与时展示，方向只在平方数 / 大九九参与时展示，
 * 与设置页各区块的显隐规则保持一致。
 */
export function describeConfig(config: PracticeConfig): string {
  const basic: Operation[] = ['add', 'sub', 'mul', 'div']
  const parts: string[] = []

  const ops = OPERATIONS.filter((op) => config.operations.includes(op))
  const isBasicOnly = ops.every((op) => basic.includes(op))
  if (ops.length === OPERATIONS.length) parts.push('全部')
  else if (isBasicOnly) parts.push('四则')
  else parts.push(ops.map((op) => OP_SHORT_LABEL[op]).join(''))

  if (shouldShowDifficulty(config.operations)) {
    parts.push(config.difficulty === 'easy' ? '入门' : '进阶')
  }
  if (
    config.operations.includes('square') ||
    config.operations.includes('mul19') ||
    config.operations.includes('pct')
  ) {
    parts.push(DIRECTION_LABEL[config.direction])
  }

  if (config.mode === 'endless') parts.push(`无尽 ${config.endless.initialTime}秒`)
  else if (config.mode === 'battle') parts.push('对战')
  else parts.push(`${config.totalCount}题`)

  return parts.join(' · ')
}

/** 用当前配置构造一个新方案（自动命名） */
export function makePreset(config: PracticeConfig): ConfigPreset {
  return { id: genId(), name: describeConfig(config), config, savedAt: Date.now() }
}
