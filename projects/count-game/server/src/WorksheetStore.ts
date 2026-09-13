import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** 题库分组 */
export interface WorksheetGroup {
  a_col: number
  b_col: number
  operators: string[]
}

/** 题库行 */
export interface WorksheetRow {
  row: number
  questions: string[]
}

/** 题库条目 */
export interface WorksheetEntry {
  id: string
  /** YYYY-MM-DD */
  date: string
  title: string
  source: string
  groups: WorksheetGroup[]
  questions: string[]
  rows: WorksheetRow[]
  createdAt: number
}

/** 打卡记录 */
export interface CheckInEntry {
  id: string
  userId: string
  /** YYYY-MM-DD */
  date: string
  worksheetId: string
  worksheetTitle: string
  correctCount: number
  totalCount: number
  accuracy: number
  timeElapsed: number
  createdAt: number
}

/** 打卡统计 */
export interface CheckInStats {
  totalCheckins: number
  streak: number
  dates: string[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const WORKSHEETS_FILE = join(DATA_DIR, 'worksheets.json')
const CHECKINS_FILE = join(DATA_DIR, 'checkins.json')

/** 格式化日期为 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 高照数算题库 & 打卡记录存储
 *
 * 用 JSON 文件持久化，与 RecordStore / UserStore 保持一致的存储模式。
 * 题库按日期管理，同日期覆盖；打卡按用户管理，同用户同日期同题库只保留最新。
 */
class WorksheetStoreClass {
  private worksheets: WorksheetEntry[] = []
  private checkins: CheckInEntry[] = []
  private worksheetsLoaded = false
  private checkinsLoaded = false

  // ============ 题库 ============

  /** 懒加载题库数据 */
  private loadWorksheets(): void {
    if (this.worksheetsLoaded) return
    this.worksheetsLoaded = true
    try {
      if (existsSync(WORKSHEETS_FILE)) {
        const raw = readFileSync(WORKSHEETS_FILE, 'utf-8')
        this.worksheets = JSON.parse(raw) as WorksheetEntry[]
      }
    } catch (e) {
      console.error('[WorksheetStore] 加载题库数据失败:', e)
    }
  }

  /** 持久化题库到磁盘 */
  private saveWorksheets(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(WORKSHEETS_FILE, JSON.stringify(this.worksheets, null, 2), 'utf-8')
    } catch (e) {
      console.error('[WorksheetStore] 保存题库数据失败:', e)
    }
  }

  /** 添加题库，同日期的会被覆盖 */
  add(entry: Omit<WorksheetEntry, 'id' | 'createdAt'>): WorksheetEntry {
    this.loadWorksheets()
    // 移除同日期的旧题库
    this.worksheets = this.worksheets.filter((w) => w.date !== entry.date)
    const worksheet: WorksheetEntry = {
      ...entry,
      id: randomBytes(12).toString('hex'),
      createdAt: Date.now(),
    }
    this.worksheets.push(worksheet)
    this.saveWorksheets()
    return worksheet
  }

  /** 获取所有题库（按日期倒序） */
  getAll(): WorksheetEntry[] {
    this.loadWorksheets()
    return [...this.worksheets].sort((a, b) => {
      if (a.date > b.date) return -1
      if (a.date < b.date) return 1
      return b.createdAt - a.createdAt
    })
  }

  /** 按日期获取题库 */
  getByDate(date: string): WorksheetEntry | null {
    this.loadWorksheets()
    return this.worksheets.find((w) => w.date === date) ?? null
  }

  /** 删除题库 */
  delete(id: string): boolean {
    this.loadWorksheets()
    const before = this.worksheets.length
    this.worksheets = this.worksheets.filter((w) => w.id !== id)
    if (this.worksheets.length < before) {
      this.saveWorksheets()
      return true
    }
    return false
  }

  // ============ 打卡 ============

  /** 懒加载打卡数据 */
  private loadCheckins(): void {
    if (this.checkinsLoaded) return
    this.checkinsLoaded = true
    try {
      if (existsSync(CHECKINS_FILE)) {
        const raw = readFileSync(CHECKINS_FILE, 'utf-8')
        this.checkins = JSON.parse(raw) as CheckInEntry[]
      }
    } catch (e) {
      console.error('[WorksheetStore] 加载打卡数据失败:', e)
    }
  }

  /** 持久化打卡到磁盘 */
  private saveCheckins(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(CHECKINS_FILE, JSON.stringify(this.checkins, null, 2), 'utf-8')
    } catch (e) {
      console.error('[WorksheetStore] 保存打卡数据失败:', e)
    }
  }

  /** 添加打卡记录（同用户同日期同worksheet只保留最新一条） */
  addCheckIn(entry: Omit<CheckInEntry, 'id' | 'createdAt'>): CheckInEntry {
    this.loadCheckins()
    // 移除同用户同日期同worksheet的旧记录
    this.checkins = this.checkins.filter(
      (c) =>
        !(
          c.userId === entry.userId &&
          c.date === entry.date &&
          c.worksheetId === entry.worksheetId
        ),
    )
    const checkin: CheckInEntry = {
      ...entry,
      id: randomBytes(12).toString('hex'),
      createdAt: Date.now(),
    }
    this.checkins.push(checkin)
    this.saveCheckins()
    return checkin
  }

  /** 获取用户打卡记录（按时间倒序） */
  getCheckIns(userId: string): CheckInEntry[] {
    this.loadCheckins()
    return this.checkins
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /** 获取用户打卡统计 */
  getCheckInStats(userId: string): CheckInStats {
    this.loadCheckins()
    const userCheckins = this.checkins.filter((c) => c.userId === userId)
    const totalCheckins = userCheckins.length

    // 去重日期，按日期倒序
    const dateSet = new Set(userCheckins.map((c) => c.date))
    const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a))

    // 计算连续打卡天数：从今天往前数
    // 若今天尚未打卡，则从昨天开始计数（今天还未结束）
    let streak = 0
    const cursor = new Date()
    if (!dateSet.has(formatDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1)
    }
    while (dateSet.has(formatDate(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    return { totalCheckins, streak, dates }
  }
}

/** 题库 & 打卡存储单例 */
export const WorksheetStore = new WorksheetStoreClass()
