import { io, type Socket } from 'socket.io-client'
import type {
  BattleConfig,
  BattlePlayer,
  BattleRejoinResult,
  OpponentProgress,
  BattleResultEntry,
  Question,
} from '@/types'

/**
 * 服务器地址
 *
 * 开发环境：直连本地后端 localhost:3001
 * 生产环境：同源（空字符串），由 Nginx 反向代理 /socket.io/ 到后端
 */
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : ''

/** localStorage 中持久化 playerId 的键名 */
const PLAYER_ID_KEY = 'battle_player_id'

/**
 * 获取持久化玩家 ID
 *
 * 玩家身份以本地生成的 UUID 为准，存于 localStorage，跨会话/跨重连保持不变。
 * 这样即使 socket.id 在重连后变化，服务器仍能通过 playerId 识别同一玩家。
 */
export function getPlayerId(): string {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY)
    if (!id) {
      id = generatePlayerId()
      localStorage.setItem(PLAYER_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用时退化为临时 ID
    return generatePlayerId()
  }
}

/** 生成 RFC4122 v4 风格的 UUID */
function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // 兼容兜底
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Socket 单例 */
let socket: Socket | null = null

/** 获取 Socket 单例 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

/** 断开 Socket 连接 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

// ===== 事件类型定义 =====

export interface ServerToClientEvents {
  'battle:players_update': (payload: { players: BattlePlayer[] }) => void
  'battle:started': (payload: {
    questions: Question[]
    startTime: number
    config: BattleConfig
  }) => void
  'battle:progress': (progress: OpponentProgress) => void
  'battle:game_over': (payload: { results: BattleResultEntry[] }) => void
}

export interface ClientToServerEvents {
  'battle:create': (
    payload: { playerId: string; name: string; config: BattleConfig },
    ack: (res: {
      roomId: string
      playerId: string
      players: BattlePlayer[]
      config: BattleConfig
      isHost: boolean
      error?: string
    }) => void,
  ) => void
  'battle:join': (
    payload: { playerId: string; roomId: string; name: string },
    ack: (res: {
      roomId: string
      playerId: string
      players: BattlePlayer[]
      config: BattleConfig
      isHost: boolean
      error?: string
    }) => void,
  ) => void
  'battle:rejoin': (
    payload: { playerId: string; roomId: string },
    ack: (res: BattleRejoinResult) => void,
  ) => void
  'battle:start': (
    payload: { roomId: string },
    ack: (res: { ok?: boolean; error?: string }) => void,
  ) => void
  'battle:answer': (
    payload: { roomId: string; answer: number },
    ack: (res: {
      correct: boolean
      correctAnswer: number
      playerFinished: boolean
      error?: string
    }) => void,
  ) => void
  'battle:leave': (payload: { roomId: string }) => void
}
