import { getToken } from './auth'
import type { Operation } from '@/types'

/** 服务器地址（与 auth.ts 一致） */
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : ''

/** 难度等级 */
export type Difficulty = 'easy' | 'hard'

/** 游戏模式 */
export type GameMode = 'fixed' | 'endless' | 'battle'

/** 做题记录 */
export interface PracticeRecord {
  id: string
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  totalCount: number
  correctCount: number
  accuracy: number
  timeElapsed: number
  createdAt: number
  rank?: number
  playerCount?: number
}

/** 统计数据 */
export interface RecordStats {
  totalSessions: number
  totalCorrect: number
  totalAnswered: number
  bestAccuracy: number
  battleWins: number
}

/** 保存记录的参数 */
export interface SaveRecordParams {
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  totalCount: number
  correctCount: number
  accuracy: number
  timeElapsed: number
  rank?: number
  playerCount?: number
}

/**
 * 保存一条做题记录
 *
 * 静默失败 —— 记录上报不应影响用户的主流程体验。
 */
export async function saveRecord(params: SaveRecordParams): Promise<void> {
  const token = getToken()
  if (!token) return
  try {
    await fetch(`${SERVER_URL}/api/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
  } catch {
    // 静默失败
  }
}

/** 查询历史记录 */
export async function fetchRecords(limit = 50): Promise<PracticeRecord[]> {
  const token = getToken()
  if (!token) return []
  try {
    const res = await fetch(`${SERVER_URL}/api/records?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { records: PracticeRecord[] }
    return data.records
  } catch {
    return []
  }
}

/** 查询统计数据 */
export async function fetchStats(): Promise<RecordStats | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${SERVER_URL}/api/records/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { stats: RecordStats }
    return data.stats
  } catch {
    return null
  }
}
