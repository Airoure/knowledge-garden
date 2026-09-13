import { useCallback, useEffect, useState } from 'react'
import {
  register,
  login,
  logout as logoutService,
  fetchMe,
  getCachedUser,
  type AuthUser,
} from '@/services/auth'

/**
 * 认证状态 Hook
 *
 * 首次挂载时尝试用本地 token 恢复会话；
 * 提供 register / login / logout 操作与 loading / error 状态。
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 启动时用 token 恢复会话 */
  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** 注册 */
  const handleRegister = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const u = await register(username, password)
      setUser(u)
      return u
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  /** 登录 */
  const handleLogin = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const u = await login(username, password)
      setUser(u)
      return u
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  /** 登出 */
  const handleLogout = useCallback(() => {
    logoutService()
    setUser(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register: handleRegister,
    login: handleLogin,
    logout: handleLogout,
    clearError,
  }
}
