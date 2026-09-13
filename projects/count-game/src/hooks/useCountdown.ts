import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 倒计时 Hook
 *
 * 通过追踪 endTime 时间戳来计算剩余秒数，
 * 支持 adjust 动态加减时间（用于无尽模式奖惩）。
 *
 * @returns remaining 剩余秒数，isRunning 是否运行中，start 开始倒计时，adjust 加减时间，stop 停止，reset 归零
 */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const endTimeRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
    setRemaining(left)
    if (left <= 0) {
      clear()
      setIsRunning(false)
    }
  }, [clear])

  const start = useCallback((seconds: number) => {
    clear()
    endTimeRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    setIsRunning(true)
    // 每 200ms 检查一次，保证 adjust 后及时更新
    intervalRef.current = setInterval(tick, 200)
  }, [clear, tick])

  const adjust = useCallback((deltaSeconds: number) => {
    endTimeRef.current += deltaSeconds * 1000
    const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
    setRemaining(left)
    if (left <= 0) {
      clear()
      setIsRunning(false)
    }
  }, [clear])

  const stop = useCallback(() => {
    clear()
    setIsRunning(false)
  }, [clear])

  const reset = useCallback(() => {
    clear()
    setRemaining(0)
    setIsRunning(false)
  }, [clear])

  // 组件卸载时清理
  useEffect(() => {
    return clear
  }, [clear])

  return { remaining, isRunning, start, adjust, stop, reset }
}
