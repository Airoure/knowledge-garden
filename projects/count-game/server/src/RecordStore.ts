import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** 运算类型 */
export type Operation = 'add' | 'sub' | 'mul' | 'div'

/** 难度等级 */
export type Difficulty = 'easy' | 'hard'

/** 游戏模式 */
export type GameMode = 'fixed' | 'endless' | 'battle'

/** 做题记录（存储层） */
export interface RecordEntry {
  id: string
  userId: string
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  totalCount: number
  correctCount: number
  accuracy: number
  /** 用时（秒） */
  timeElapsed: number
  createdAt: number
  /** 对战模式：名次 */
  rank?: number
  /** 对战模式：参与人数 */
  playerCount?: number
}

/** 对外暴露的记录（带用户名） */
export interface RecordWithUser extends RecordEntry {
  username: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const DATA_FILE = join(DATA_DIR, 'records.json')

/** 单用户最多保留的记录条数 */
const MAX_RECORDS_PER_USER = 500

/**
 * 做题记录存储
 *
 * 用 JSON 文件持久化，与 UserStore 保持一致的存储模式。
 * 按用户 ID 分组管理，每人最多保留最近 500 条。
 */
class RecordStoreClass {
  private records: RecordEntry[] = []
  private loaded = false

  /** 懒加载磁盘数据 */
  private load(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(DATA_FILE)) {
        const raw = readFileSync(DATA_FILE, 'utf-8')
        this.records = JSON.parse(raw) as RecordEntry[]
      }
    } catch (e) {
      console.error('[RecordStore] 加载记录数据失败:', e)
    }
  }

  /** 持久化到磁盘 */
  private save(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(DATA_FILE, JSON.stringify(this.records, null, 2), 'utf-8')
    } catch (e) {
      console.error('[RecordStore] 保存记录数据失败:', e)
    }
  }

  /** 添加记录 */
  add(entry: Omit<RecordEntry, 'id' | 'createdAt'>): RecordEntry {
    this.load()
    const record: RecordEntry = {
      ...entry,
      id: randomBytes(12).toString('hex'),
      createdAt: Date.now(),
    }
    this.records.push(record)

    // 按用户分组，每人只保留最近 MAX_RECORDS_PER_USER 条
    this.trimByUser()

    this.save()
    return record
  }

  /** 限制单用户记录数量 */
  private trimByUser(): void {
    const byUser = new Map<string, RecordEntry[]>()
    for (const r of this.records) {
      const arr = byUser.get(r.userId) ?? []
      arr.push(r)
      byUser.set(r.userId, arr)
    }
    let trimmed: RecordEntry[] = []
    for (const arr of byUser.values()) {
      // 按 createdAt 降序，取最近 N 条
      arr.sort((a, b) => b.createdAt - a.createdAt)
      trimmed = trimmed.concat(arr.slice(0, MAX_RECORDS_PER_USER))
    }
    this.records = trimmed
  }

  /** 查询用户的历史记录（按时间倒序） */
  getByUser(userId: string, limit = 50): RecordEntry[] {
    this.load()
    return this.records
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  /** 获取用户统计数据 */
  getStats(userId: string): {
    totalSessions: number
    totalCorrect: number
    totalAnswered: number
    bestAccuracy: number
    battleWins: number
  } {
    this.load()
    const userRecords = this.records.filter((r) => r.userId === userId)
    const totalSessions = userRecords.length
    const totalCorrect = userRecords.reduce((s, r) => s + r.correctCount, 0)
    const totalAnswered = userRecords.reduce((s, r) => s + r.totalCount, 0)
    const bestAccuracy =
      userRecords.length > 0
        ? Math.max(...userRecords.map((r) => r.accuracy))
        : 0
    const battleWins = userRecords.filter(
      (r) => r.mode === 'battle' && r.rank === 1,
    ).length
    return { totalSessions, totalCorrect, totalAnswered, bestAccuracy, battleWins }
  }
}

/** 做题记录存储单例 */
export const RecordStore = new RecordStoreClass()
