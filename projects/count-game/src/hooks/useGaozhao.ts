import { useCallback, useEffect, useState } from 'react'
import {
  fetchWorksheets,
  fetchCheckIns,
  deleteWorksheet as deleteWorksheetApi,
  saveCheckIn as saveCheckInApi,
  type Worksheet,
  type CheckIn,
  type CheckInStats,
  type SaveCheckInParams,
} from '@/services/worksheet'

/**
 * 高照数算 Hook
 *
 * 管理题库列表、打卡记录与统计。
 * 题库通过命令行脚本导入，前端不负责上传。
 */
export function useGaozhao() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([])
  const [checkins, setCheckins] = useState<CheckIn[]>([])
  const [checkInStats, setCheckInStats] = useState<CheckInStats | null>(null)
  const [loading, setLoading] = useState(true)

  /** 返回今天的日期字符串 YYYY-MM-DD */
  const getTodayString = useCallback((): string => {
    const now = new Date()
    const y = now.getFullYear()
    const m = (now.getMonth() + 1).toString().padStart(2, '0')
    const d = now.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  /** 加载题库列表和打卡记录 */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sheets, checkInData] = await Promise.all([
        fetchWorksheets(),
        fetchCheckIns(),
      ])
      setWorksheets(sheets)
      setCheckins(checkInData.checkins)
      setCheckInStats(checkInData.stats)
    } finally {
      setLoading(false)
    }
  }, [])

  /** 挂载时自动加载 */
  useEffect(() => {
    load()
  }, [load])

  /** 删除题库 */
  const deleteWorksheet = useCallback(
    async (id: string): Promise<void> => {
      await deleteWorksheetApi(id)
      setWorksheets((prev) => prev.filter((w) => w.id !== id))
    },
    [],
  )

  /** 保存打卡并刷新 */
  const saveCheckIn = useCallback(
    async (data: SaveCheckInParams): Promise<void> => {
      await saveCheckInApi(data)
      await load()
    },
    [load],
  )

  return {
    worksheets,
    checkins,
    checkInStats,
    loading,
    load,
    deleteWorksheet,
    saveCheckIn,
    getTodayString,
  }
}
