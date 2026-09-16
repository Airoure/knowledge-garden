// ===== 共享类型定义 =====

/** 运算类型（square：平方数；mul19：大九九 11~19 互乘；pct：分数 ↔ 百分数互化） */
export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'square' | 'mul19' | 'pct'

/** 难度等级 */
export type Difficulty = 'easy' | 'hard'

/** 出题方向：forward 正向（11² = ?）；reverse 逆向（?² = 121）；mixed 混合 */
export type QuestionDirection = 'forward' | 'reverse' | 'mixed'

/** 房间状态 */
export type RoomStatus = 'waiting' | 'playing' | 'finished'

/** 单道题目 */
export interface Question {
  a: number
  b: number
  op: Operation
  symbol: string
  answer: number
  /**
   * 逆向题标记（仅 square / mul19 / pct 会出现）
   *
   * 逆向时 a 为待求值（即答案），b 为题目中展示的已知数：
   * square：?² = b，answer = a；mul19：? × b = a × b，answer = a；
   * pct：b% = 1/?，answer = a（分母）
   */
  reversed?: boolean
}

/** 对战配置 */
export interface BattleConfig {
  operations: Operation[]
  difficulty: Difficulty
  /** 出题方向（仅平方数 / 大九九 / 百分数生效） */
  direction: QuestionDirection
  totalCount: number
}

/**
 * 玩家状态
 *
 * 身份以 playerId（前端持久化生成）为准，socketId 仅作传输通道绑定。
 * 断线时 connected 置为 false 但不从房间移除，进入宽限期等待重连。
 */
export interface PlayerState {
  /** 持久化玩家 ID（前端 localStorage 生成） */
  id: string
  name: string
  isHost: boolean
  currentIndex: number
  correctCount: number
  wrongCount: number
  finished: boolean
  finishTime: number | null
  /** 当前绑定的 socket.id，断线后置 null */
  socketId: string | null
  /** 是否在线（已绑定 socket） */
  connected: boolean
  /** 断线时间戳，用于宽限期判断 */
  disconnectedAt: number | null
}

/** 玩家进度（广播给对手） */
export interface PlayerProgress {
  playerId: string
  name: string
  currentIndex: number
  correctCount: number
  wrongCount: number
  finished: boolean
  finishTime: number | null
}

/** 对战玩家信息（房间内，下发给前端） */
export interface BattlePlayer {
  id: string
  name: string
  isHost: boolean
  /** 是否在线 */
  connected: boolean
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
export const WRONG_PENALTY_SECONDS = 10

/**
 * 断线宽限期（毫秒）
 *
 * 等待中：2 分钟，给房主/玩家足够时间从锁屏、切后台、网络波动中恢复。
 */
export const RECONNECT_GRACE_MS = 2 * 60 * 1000

/**
 * 游戏中断线宽限期（毫秒）
 *
 * 对战进行中断线，30 秒内重连可恢复进度；超时则该玩家被判离场，游戏结束。
 */
export const PLAYING_GRACE_MS = 30 * 1000

/**
 * 僵尸房间清理间隔（毫秒）
 */
export const CLEANUP_INTERVAL_MS = 60 * 1000

/**
 * 等待房间最长存活时间（毫秒）
 *
 * 全员离线且超过宽限期的等待房间会被兜底清理，避免内存泄漏。
 */
export const WAITING_ROOM_TTL_MS = 30 * 60 * 1000
