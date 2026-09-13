import { useCallback, useEffect, useState } from 'react'
import {
  fetchRecords,
  fetchStats,
  type PracticeRecord,
  type RecordStats,
} from '@/services/record'

/**
 * 历史记录 Hook
 *
 * 提供记录列表与统计数据的加载、刷新能力。
 */
export function useHistory() {
  const [records, setRecords] = useState<PracticeRecord[]>([])
  const [stats, setStats] = useState<RecordStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [recs, sts] = await Promise.all([fetchRecords(50), fetchStats()])
      setRecords(recs)
      setStats(sts)
    } finally {
      setLoading(false)
    }
  }, [])

  /** 挂载时自动加载 */
  useEffect(() => {
    load()
  }, [load])

  return { records, stats, loading, reload: load }
}
