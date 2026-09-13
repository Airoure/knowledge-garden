/** 运算类型（square：平方数；mul19：大九九 11~19 互乘） */
export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'square' | 'mul19'

/** 难度等级 */
export type Difficulty = 'easy' | 'hard'

/** 出题方向：forward 正向（11² = ?）；reverse 逆向（?² = 121）；mixed 混合 */
export type QuestionDirection = 'forward' | 'reverse' | 'mixed'

/** 游戏模式 */
export type GameMode = 'fixed' | 'endless' | 'battle'

/** 应用阶段 */
export type Phase = 'setup' | 'practice' | 'result' | 'battle-lobby' | 'battle-practice' | 'battle-result' | 'history' | 'gaozhao'

/** 单道题目 */
export interface Question {
  a: number
  b: number
  op: Operation
  symbol: string
  answer: number
  /**
   * 逆向题标记（仅 square / mul19 会出现）
   *
   * 逆向时 a 为待求值（即答案），b 为题目中展示的已知数：
   * square：?² = b，answer = a；mul19：? × b = a × b，answer = a
   */
  reversed?: boolean
}

/** 无尽模式设置 */
export interface EndlessSettings {
  /** 初始总时间（秒） */
  initialTime: number
  /** 答对加时（秒） */
  correctBonus: number
  /** 答错扣时（秒） */
  wrongPenalty: number
}

/** 练习配置 */
export interface PracticeConfig {
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  /** 出题方向（仅平方数 / 大九九生效） */
  direction: QuestionDirection
  /** 固定模式：题目数量 */
  totalCount: number
  /** 无尽模式：时间设置 */
  endless: EndlessSettings
}

/** 答题状态 */
export type AnswerStatus = 'idle' | 'correct' | 'wrong'

/** 练习结果 */
export interface PracticeResult {
  mode: GameMode
  correctCount: number
  /** 固定模式：总题数；无尽模式：总答题数 */
  totalCount: number
  accuracy: number
  /** 固定模式：总用时；无尽模式：游戏时长 */
  timeElapsed: number
  grade: GradeInfo
}

/** 评级信息 */
export interface GradeInfo {
  symbol: string
  title: string
  subtitle: string
}

/** 运算元数据 */
export interface OperationMeta {
  op: Operation
  symbol: string
  label: string
}

/** 难度元数据 */
export interface DifficultyMeta {
  diff: Difficulty
  title: string
  desc: string
  example: string
}

// ===== 对战模式类型 =====

/** 对战配置 */
export interface BattleConfig {
  operations: Operation[]
  difficulty: Difficulty
  /** 出题方向（仅平方数 / 大九九生效） */
  direction: QuestionDirection
  totalCount: number
}

/** 对战玩家信息（房间内） */
export interface BattlePlayer {
  id: string
  name: string
  isHost: boolean
  /** 是否在线（断线时为 false，重连后恢复 true） */
  connected: boolean
}

/** 对战房间状态 */
export type BattleRoomState = 'lobby' | 'playing' | 'finished'

/** 对手进度（实时同步） */
export interface OpponentProgress {
  playerId: string
  name: string
  currentIndex: number
  correctCount: number
  wrongCount: number
  finished: boolean
  finishTime: number | null
}

/** 对战结果条目 */
export interface BattleResultEntry {
  playerId: string
  name: string
  correctCount: number
  wrongCount: number
  finished: boolean
  finishTime: number | null
  /** 实际耗时（秒） */
  elapsed: number
  /** 含罚时的总时间（秒） */
  totalTime: number
  rank: number
}

/** 答错罚时（秒） */
export const BATTLE_WRONG_PENALTY = 10

/** Socket 连接状态 */
export type ConnectionState = 'connected' | 'reconnecting'

/**
 * 重连归位快照（battle:rejoin 的 ack 返回）
 *
 * 包含房间完整状态，使前端可恢复到断线前的阶段与进度
 */
export interface BattleRejoinResult {
  ok: boolean
  error?: string
  roomId: string
  playerId: string
  isHost: boolean
  players: BattlePlayer[]
  config: BattleConfig
  /** 房间状态：waiting / playing / finished */
  status: 'waiting' | 'playing' | 'finished'
  /** 游戏中/已结束时携带题目 */
  questions?: Question[]
  startTime?: number | null
  /** 自己的进度 */
  currentIndex?: number
  correctCount?: number
  wrongCount?: number
  finished?: boolean
  /** 对手进度 */
  opponents?: OpponentProgress[]
  /** 已结束时携带结果 */
  results?: BattleResultEntry[] | null
}
