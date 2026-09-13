import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

/** 用户记录（存储层） */
interface UserRecord {
  id: string
  username: string
  /** scrypt 哈希，格式 saltHex:hashHex */
  passwordHash: string
  createdAt: number
}

/** 对外暴露的用户信息（不含密码） */
export interface PublicUser {
  id: string
  username: string
  createdAt: number
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const DATA_FILE = join(DATA_DIR, 'users.json')

/**
 * 用户存储
 *
 * 用 JSON 文件持久化，密码用 scrypt + 随机盐哈希。
 * 足够简单且重启不丢失，适合当前规模。
 */
class UserStoreClass {
  private users = new Map<string, UserRecord>()
  private loaded = false

  /** 懒加载磁盘数据 */
  private load(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(DATA_FILE)) {
        const raw = readFileSync(DATA_FILE, 'utf-8')
        const arr: UserRecord[] = JSON.parse(raw)
        for (const u of arr) {
          this.users.set(u.username.toLowerCase(), u)
        }
      }
    } catch (e) {
      console.error('[UserStore] 加载用户数据失败:', e)
    }
  }

  /** 持久化到磁盘 */
  private save(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      const arr = Array.from(this.users.values())
      writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf-8')
    } catch (e) {
      console.error('[UserStore] 保存用户数据失败:', e)
    }
  }

  /** 哈希密码 */
  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex')
    const hash = scryptSync(password, salt, 64).toString('hex')
    return `${salt}:${hash}`
  }

  /** 验证密码（恒定时间比较防时序攻击） */
  private verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const testHash = scryptSync(password, salt, 64)
    const hashBuf = Buffer.from(hash, 'hex')
    try {
      return timingSafeEqual(testHash, hashBuf)
    } catch {
      return false
    }
  }

  /** 注册新用户 */
  create(username: string, password: string): { user: PublicUser } | { error: string } {
    this.load()
    const key = username.toLowerCase()
    if (this.users.has(key)) {
      return { error: '用户名已被占用' }
    }
    const record: UserRecord = {
      id: randomBytes(12).toString('hex'),
      username,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
    }
    this.users.set(key, record)
    this.save()
    return { user: this.toPublic(record) }
  }

  /** 验证登录 */
  verify(username: string, password: string): { user: PublicUser } | { error: string } {
    this.load()
    const key = username.toLowerCase()
    const record = this.users.get(key)
    if (!record) {
      return { error: '用户名或密码错误' }
    }
    if (!this.verifyPassword(password, record.passwordHash)) {
      return { error: '用户名或密码错误' }
    }
    return { user: this.toPublic(record) }
  }

  /** 根据 ID 查找（用于 token 恢复会话） */
  findById(id: string): PublicUser | null {
    this.load()
    for (const record of this.users.values()) {
      if (record.id === id) return this.toPublic(record)
    }
    return null
  }

  private toPublic(record: UserRecord): PublicUser {
    return {
      id: record.id,
      username: record.username,
      createdAt: record.createdAt,
    }
  }
}

/** 用户存储单例 */
export const UserStore = new UserStoreClass()
