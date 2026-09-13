import { createHmac, timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { UserStore, type PublicUser } from './UserStore.js'

/**
 * 认证模块
 *
 * Token 采用 HMAC-SHA256 签名的无状态方案（格式 payload.signature），
 * 不依赖 JWT 库。密钥在生产环境应通过环境变量注入。
 */

/** Token 签名密钥 */
const SECRET = process.env.AUTH_SECRET || 'sushu-daochang-secret-2026'

/** Token 有效期 7 天 */
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Token 载荷 */
interface TokenPayload {
  id: string
  username: string
  iat: number
}

/** Base64URL 编码 */
function b64urlEncode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64url')
}

/** Base64URL 解码 */
function b64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8')
}

/** 签名 */
function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

/** 签发 token */
export function createToken(user: PublicUser): string {
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    iat: Date.now(),
  }
  const payloadStr = b64urlEncode(JSON.stringify(payload))
  return `${payloadStr}.${sign(payloadStr)}`
}

/** 验证 token，返回载荷或 null */
export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadStr, sig] = parts
  const expectedSig = sign(payloadStr)
  // 恒定时间比较
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(b64urlDecode(payloadStr)) as TokenPayload
    if (Date.now() - payload.iat > TOKEN_TTL_MS) return null
    return payload
  } catch {
    return null
  }
}

/** 扩展 Request 类型，挂载已认证用户 */
export interface AuthedRequest extends Request {
  user?: PublicUser
}

/** 认证中间件：从 Authorization 头解析 token */
export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' })
    return
  }
  const token = header.slice(7)
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: '登录已过期' })
    return
  }
  const user = UserStore.findById(payload.id)
  if (!user) {
    res.status(401).json({ error: '用户不存在' })
    return
  }
  req.user = user
  next()
}

/** 注册认证相关路由 */
export function registerAuthRoutes(app: import('express').Express): void {
  /** 注册 */
  app.post('/api/auth/register', (req: AuthedRequest, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string }
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }
    if (username.trim().length < 2 || username.trim().length > 12) {
      res.status(400).json({ error: '用户名需 2-12 个字符' })
      return
    }
    if (password.length < 4) {
      res.status(400).json({ error: '密码至少 4 位' })
      return
    }
    const result = UserStore.create(username.trim(), password)
    if ('error' in result) {
      res.status(409).json({ error: result.error })
      return
    }
    const token = createToken(result.user)
    res.json({ token, user: result.user })
  })

  /** 登录 */
  app.post('/api/auth/login', (req: AuthedRequest, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string }
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }
    const result = UserStore.verify(username.trim(), password)
    if ('error' in result) {
      res.status(401).json({ error: result.error })
      return
    }
    const token = createToken(result.user)
    res.json({ token, user: result.user })
  })

  /** 获取当前用户（恢复会话） */
  app.get('/api/auth/me', authMiddleware, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user })
  })
}
