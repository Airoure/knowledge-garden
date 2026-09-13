import { useCallback, useRef } from 'react'

/**
 * 音效播放 Hook
 *
 * 封装 Audio 对象的创建与播放逻辑，支持快速重置与重复播放。
 * 浏览器自动播放策略导致的错误会被静默忽略。
 *
 * @param src 音频文件 URL
 * @returns play 函数，调用即播放
 */
export function useSound(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio(src)
  }

  const play = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // 忽略浏览器自动播放策略导致的错误
      })
    }
  }, [])

  return play
}
