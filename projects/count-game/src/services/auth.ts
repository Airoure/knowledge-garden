/** 服务器用户信息 */
export interface AuthUser {
  id: string
  username: string
  createdAt: number
}

/** API 返回结构 */
interface AuthResponse {
  token: string
  user: AuthUser
}

interface ErrorResponse {
  error: string
}

/** 服务器地址（与 socket.ts 一致） */
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : ''

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/** 获取本地存储的 token */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** 获取本地缓存的用户信息 */
export function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

/** 持久化 token 与用户 */
function saveAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // localStorage 不可用时静默失败
  }
}

/** 清除本地认证信息 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // ignore
  }
}

/** 统一请求封装 */
async function request(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as AuthResponse | ErrorResponse
  if (!res.ok || 'error' in data) {
    throw new Error((data as ErrorResponse).error || '请求失败')
  }
  saveAuth(data.token, data.user)
  return data
}

/** 注册 */
export async function register(username: string, password: string): Promise<AuthUser> {
  const data = await request('/api/auth/register', { username, password })
  return data.user
}

/** 登录 */
export async function login(username: string, password: string): Promise<AuthUser> {
  const data = await request('/api/auth/login', { username, password })
  return data.user
}

/** 用 token 恢复会话（返回最新用户信息，失败返回 null） */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user: AuthUser } | ErrorResponse
    if ('error' in data) return null
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    } catch {
      // ignore
    }
    return data.user
  } catch {
    return null
  }
}

/** 登出（清除本地认证） */
export function logout(): void {
  clearAuth()
}
