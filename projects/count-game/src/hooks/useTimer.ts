import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 倒计时 / 正计时 Hook
 * @returns elapsed 已过秒数，start 开始计时，stop 停止计时，reset 归零
 */
export function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  const start = useCallback(() => {
    startRef.current = Date.now()
    setElapsed(0)
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    setElapsed(0)
  }, [stop])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return { elapsed, start, stop, reset }
}
