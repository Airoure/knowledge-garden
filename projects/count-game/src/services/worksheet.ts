import { getToken } from './auth'

/** 服务器地址（与 auth.ts 一致） */
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : ''

/** 题目分组 */
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

/** 题库 */
export interface Worksheet {
  id: string
  date: string
  title: string
  source: string
  groups: WorksheetGroup[]
  questions: string[]
  rows: WorksheetRow[]
  createdAt: number
}

/** 打卡记录 */
export interface CheckIn {
  id: string
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

/** 图片解析结果 */
export interface ParseResult {
  questions: string[]
  rows: WorksheetRow[]
  groups: WorksheetGroup[]
}

/** 保存题库参数 */
export interface SaveWorksheetParams {
  date: string
  title: string
  questions: string[]
  rows: WorksheetRow[]
  groups: WorksheetGroup[]
}

/** 保存打卡参数 */
export interface SaveCheckInParams {
  date: string
  worksheetId: string
  worksheetTitle: string
  correctCount: number
  totalCount: number
  accuracy: number
  timeElapsed: number
}

/**
 * 解析题目图片
 *
 * @param image base64 字符串（不含 data:image 前缀）
 */
export async function parseImage(image: string): Promise<ParseResult> {
  const token = getToken()
  if (!token) throw new Error('未登录')
  const res = await fetch(`${SERVER_URL}/api/worksheets/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || '解析失败')
  }
  const data = (await res.json()) as ParseResult
  return data
}

/** 保存题库 */
export async function saveWorksheet(data: SaveWorksheetParams): Promise<Worksheet> {
  const token = getToken()
  if (!token) throw new Error('未登录')
  const res = await fetch(`${SERVER_URL}/api/worksheets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || '保存失败')
  }
  const worksheet = (await res.json()) as Worksheet
  return worksheet
}

/** 查询所有题库 */
export async function fetchWorksheets(): Promise<Worksheet[]> {
  const token = getToken()
  if (!token) return []
  try {
    const res = await fetch(`${SERVER_URL}/api/worksheets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { worksheets: Worksheet[] }
    return data.worksheets
  } catch {
    return []
  }
}

/** 按日期查询题库 */
export async function fetchWorksheetByDate(date: string): Promise<Worksheet | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${SERVER_URL}/api/worksheets/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { worksheet: Worksheet }
    return data.worksheet
  } catch {
    return null
  }
}

/** 删除题库 */
export async function deleteWorksheet(id: string): Promise<void> {
  const token = getToken()
  if (!token) return
  try {
    await fetch(`${SERVER_URL}/api/worksheets/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // 静默失败
  }
}

/** 保存打卡 */
export async function saveCheckIn(data: SaveCheckInParams): Promise<CheckIn> {
  const token = getToken()
  if (!token) throw new Error('未登录')
  const res = await fetch(`${SERVER_URL}/api/worksheets/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error || '打卡失败')
  }
  const checkin = (await res.json()) as CheckIn
  return checkin
}

/** 查询打卡记录与统计 */
export async function fetchCheckIns(): Promise<{ checkins: CheckIn[]; stats: CheckInStats }> {
  const token = getToken()
  if (!token) return { checkins: [], stats: { totalCheckins: 0, streak: 0, dates: [] } }
  try {
    const res = await fetch(`${SERVER_URL}/api/worksheets/checkins`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { checkins: [], stats: { totalCheckins: 0, streak: 0, dates: [] } }
    const data = (await res.json()) as { checkins: CheckIn[]; stats: CheckInStats }
    return data
  } catch {
    return { checkins: [], stats: { totalCheckins: 0, streak: 0, dates: [] } }
  }
}
