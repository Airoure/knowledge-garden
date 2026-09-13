import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sushu-dojo-music-muted'

/**
 * 背景音乐 Hook
 *
 * 管理背景音乐的循环播放与静音切换。
 * 由于浏览器自动播放策略，音乐会在用户首次交互后开始播放。
 * 静音状态持久化到 localStorage。
 *
 * @param src 音频文件 URL
 * @returns { isMuted, toggleMute } 静音状态与切换函数
 */
export function useBackgroundMusic(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // 初始化 Audio 对象
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0.3
    audio.muted = isMuted
    audioRef.current = audio
  }

  // 静音状态同步到 audio 元素与 localStorage
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.muted = isMuted
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(isMuted))
    } catch {
      // 忽略 localStorage 不可用的情况
    }
  }, [isMuted])

  // 浏览器自动播放策略：监听首次用户交互后开始播放
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const tryPlay = () => {
      audio.play().catch(() => {
        // 忽略播放失败（如用户尚未交互）
      })
    }

    // 尝试立即播放（部分浏览器允许）
    tryPlay()

    // 监听首次点击/键盘交互
    const onFirstInteraction = () => {
      tryPlay()
      document.removeEventListener('click', onFirstInteraction)
      document.removeEventListener('keydown', onFirstInteraction)
    }

    document.addEventListener('click', onFirstInteraction)
    document.addEventListener('keydown', onFirstInteraction)

    return () => {
      document.removeEventListener('click', onFirstInteraction)
      document.removeEventListener('keydown', onFirstInteraction)
    }
  }, [])

  // 组件卸载时暂停并清理
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) {
        audio.pause()
      }
    }
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  return { isMuted, toggleMute }
}
