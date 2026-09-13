import type { Server } from 'socket.io'
import { Room } from './Room.js'
import type {
  BattleConfig,
  BattlePlayer,
  PlayerState,
  Question,
  PlayerProgress,
  BattleResultEntry,
} from './types.js'
import {
  RECONNECT_GRACE_MS,
  PLAYING_GRACE_MS,
  CLEANUP_INTERVAL_MS,
} from './types.js'

/**
 * 房间管理器
 *
 * 负责房间的创建、查找、移除，以及断线重连的宽限期管理。
 * 房间号为 4 位大写字母+数字，避免易混淆字符（0/O, 1/I）。
 *
 * 身份模型：
 * - playerRooms: playerId → roomId（持久身份 → 房间，断线不丢失）
 * - socketToRoom: socketId → roomId（传输通道 → 房间，断线即清除）
 *
 * 断线流程：
 * 1. disconnect → 标记玩家 connected=false（不移除），广播 players_update
 * 2. 启动宽限期定时器（等待 2 分钟 / 游戏中 30 秒）
 * 3. 期间玩家 battle:rejoin → 重新绑定 socket、清除定时器、恢复进度
 * 4. 超时未重连 → 真实移除玩家，房主转移，必要时结束游戏，空房间销毁
 */
export class RoomManager {
  private rooms = new Map<string, Room>()
  /** playerId → roomId，持久身份映射，断线不丢失 */
  private playerRooms = new Map<string, string>()
  /** socketId → roomId，传输通道映射，断线即清除 */
  private socketToRoom = new Map<string, string>()
  /** playerId → 宽限期定时器 */
  private disconnectTimers = new Map<string, NodeJS.Timeout>()
  /** TTL 清理定时器引用 */
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(private io: Server) {}

  /** 生成唯一房间号 */
  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let id: string
    do {
      id = ''
      for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)]
      }
    } while (this.rooms.has(id))
    return id
  }

  /** 绑定 socket 与身份映射 */
  private bindSocket(socketId: string, playerId: string, roomId: string): void {
    this.socketToRoom.set(socketId, roomId)
    this.playerRooms.set(playerId, roomId)
  }

  /** 创建房间 */
  createRoom(hostPlayerId: string, hostName: string, config: BattleConfig, socketId: string): Room {
    const id = this.generateRoomId()
    const room = new Room(id, hostPlayerId, hostName, config, socketId)
    this.rooms.set(id, room)
    this.bindSocket(socketId, hostPlayerId, id)
    return room
  }

  /** 查找房间 */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /** 根据玩家 ID 查找房间 */
  getRoomByPlayer(playerId: string): Room | undefined {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return undefined
    return this.rooms.get(roomId)
  }

  /** 根据 socket.id 解析玩家与房间（用于 start/answer/leave 等事件） */
  resolvePlayer(socketId: string): { room: Room; player: PlayerState } | null {
    const roomId = this.socketToRoom.get(socketId)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (!room) return null
    const player = room.getPlayerBySocketId(socketId)
    if (!player) return null
    return { room, player }
  }

  /** 玩家加入房间 */
  joinRoom(roomId: string, playerId: string, name: string, socketId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    if (!room.isWaiting) return null
    if (!room.addPlayer(playerId, name, false, socketId)) return null
    this.bindSocket(socketId, playerId, roomId)
    return room
  }

  /**
   * 玩家重连归位
   *
   * 通过 playerId 找回原房间，重新绑定新 socket.id，恢复在线状态。
   * 返回房间供调用方构建重连快照。
   */
  rejoin(playerId: string, roomId: string, socketId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    if (!room.hasPlayer(playerId)) return null

    room.rebindSocket(playerId, socketId)
    this.bindSocket(socketId, playerId, roomId)
    this.clearDisconnectTimer(playerId)
    return room
  }

  /**
   * 处理断线
   *
   * 标记玩家为离线（不移除），启动宽限期定时器，广播 players_update。
   * 返回信息供日志记录。
   */
  handleDisconnect(socketId: string): { room: Room; player: PlayerState } | null {
    const resolved = this.resolvePlayer(socketId)
    // 清除传输映射（socket 已失效）
    this.socketToRoom.delete(socketId)
    if (!resolved) return null

    const { room, player } = resolved
    room.markDisconnected(player.id)

    // 广播在线状态变化
    this.emitPlayersUpdate(room)

    // 启动宽限期定时器（绑定房间，避免玩家换房后误删）
    const graceMs = room.isPlaying ? PLAYING_GRACE_MS : RECONNECT_GRACE_MS
    this.scheduleRemoval(player.id, room.id, graceMs)

    return { room, player }
  }

  /**
   * 安排宽限期后移除玩家
   *
   * 定时器捕获 roomId：触发时若玩家仍在该房间则正常移除；
   * 若玩家已加入其他房间（playerRooms 指向变更），则仅清理原房间的断线残留，
   * 不影响新房间。
   */
  private scheduleRemoval(playerId: string, roomId: string, ms: number): void {
    this.clearDisconnectTimer(playerId)
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(playerId)
      if (this.playerRooms.get(playerId) === roomId) {
        // 玩家仍在原房间 → 正常移除
        this.removePlayer(playerId)
      } else {
        // 玩家已换房或退出 → 仅清理原房间的断线残留
        this.removeGhostPlayer(roomId, playerId)
      }
    }, ms)
    this.disconnectTimers.set(playerId, timer)
  }

  /** 清除玩家的宽限期定时器 */
  private clearDisconnectTimer(playerId: string): void {
    const timer = this.disconnectTimers.get(playerId)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(playerId)
    }
  }

  /**
   * 真实移除玩家
   *
   * 用于主动离开或宽限期超时。处理房主转移、游戏完整性、空房间销毁，
   * 并广播 players_update / game_over。
   */
  removePlayer(playerId: string): { room: Room; player: PlayerState } | null {
    const roomId = this.playerRooms.get(playerId)
    if (!roomId) return null
    const room = this.rooms.get(roomId)
    if (!room) return null

    const player = room.removePlayer(playerId)
    if (!player) return null

    // 清理映射与定时器
    this.playerRooms.delete(playerId)
    this.clearDisconnectTimer(playerId)
    if (player.socketId) {
      this.socketToRoom.delete(player.socketId)
    }

    this.cleanupRoomAfterRemoval(room, playerId)
    return { room, player }
  }

  /**
   * 清理原房间中的断线残留玩家
   *
   * 当玩家断线后又加入新房间，原宽限期定时器触发时调用。
   * 不触碰 playerRooms（已指向新房间），仅从原房间移除残留并做善后。
   */
  private removeGhostPlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    const player = room.removePlayer(playerId)
    if (!player) return
    this.cleanupRoomAfterRemoval(room, playerId)
    console.log(`[清理残留] ${playerId} ← ${roomId}（已换房）`)
  }

  /**
   * 玩家移除后的房间善后：房主转移、空房间销毁、广播与游戏完整性
   */
  private cleanupRoomAfterRemoval(room: Room, removedPlayerId: string): void {
    // 房主转移：若离开的是房主且房间还有人，优先移交给在线玩家
    if (removedPlayerId === room.hostId && !room.isEmpty) {
      const players = room.getPlayers()
      const next = players.find((p) => p.connected) ?? players[0]
      if (next) {
        room.transferHost(next.id)
      }
    }

    if (room.isEmpty) {
      // 房间空了，直接销毁
      this.rooms.delete(room.id)
      console.log(`[房间销毁] ${room.id}（已空）`)
    } else {
      // 广播成员变化
      this.emitPlayersUpdate(room)

      // 游戏进行中且在线人数不足 → 结束游戏
      if (room.isPlaying && room.connectedPlayerCount < 2) {
        room.endGame()
        const results = room.getResults()
        this.io.to(room.id).emit('battle:game_over', { results })
        console.log(`[游戏中断] 房间 ${room.id}, 在线玩家不足`)
      }
    }
  }

  /** 广播房间成员列表（含在线状态）给房间内所有人 */
  emitPlayersUpdate(room: Room): void {
    this.io.to(room.id).emit('battle:players_update', {
      players: room.getPlayersView(),
    })
  }

  /**
   * 再来一局
   *
   * 任意玩家发起即可，房间重置到等待状态并广播给所有人。
   * 房间配置保持不变，房主可重新开始游戏。
   */
  rematch(playerId: string, roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    if (!room.hasPlayer(playerId)) return null
    if (!room.isFinished) return null

    room.resetToWaiting()

    // 广播再来一局通知 + 更新后的玩家列表
    this.io.to(room.id).emit('battle:rematch', {
      players: room.getPlayersView(),
    })

    return room
  }

  /**
   * 构建重连快照（供 battle:rejoin 的 ack 返回）
   *
   * 包含房间完整状态，使前端可恢复到断线前的阶段与进度。
   */
  buildRejoinSnapshot(room: Room, playerId: string) {
    const own = room.getPlayerProgress(playerId)
    const opponents: PlayerProgress[] = room
      .getAllProgress()
      .filter((p) => p.playerId !== playerId)

    const snapshot: {
      ok: boolean
      roomId: string
      playerId: string
      isHost: boolean
      players: BattlePlayer[]
      config: BattleConfig
      status: string
      questions: Question[]
      startTime: number | null
      currentIndex: number
      correctCount: number
      wrongCount: number
      finished: boolean
      opponents: PlayerProgress[]
      results: BattleResultEntry[] | null
    } = {
      ok: true,
      roomId: room.id,
      playerId,
      isHost: room.hostId === playerId,
      players: room.getPlayersView(),
      config: room.config,
      status: room.roomStatus,
      questions: room.isPlaying || room.isFinished ? room.getQuestions() : [],
      startTime: room.gameStartTime,
      currentIndex: own?.currentIndex ?? 0,
      correctCount: own?.correctCount ?? 0,
      wrongCount: own?.wrongCount ?? 0,
      finished: own?.finished ?? false,
      opponents,
      results: room.isFinished ? room.getResults() : null,
    }
    return snapshot
  }

  /**
   * 启动僵尸房间兜底清理
   *
   * 定期扫描：全员离线且超过宽限期的房间会被销毁，避免内存泄漏。
   * 这是 per-player 定时器之外的安全网。
   */
  startCleanup(): void {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [roomId, room] of this.rooms) {
        // 全员离线 → 判定是否清理
        if (room.connectedPlayerCount === 0) {
          const players = room.getPlayers()
          // 取最早断线时间；若没有断线记录（理论上不会），用创建时间
          const earliestDisconnect = players.length
            ? Math.min(...players.map((p) => p.disconnectedAt ?? room.createdAt))
            : room.createdAt
          if (now - earliestDisconnect > RECONNECT_GRACE_MS) {
            // 清理所有残留玩家的映射
            for (const p of players) {
              this.playerRooms.delete(p.id)
              this.clearDisconnectTimer(p.id)
              if (p.socketId) this.socketToRoom.delete(p.socketId)
            }
            this.rooms.delete(roomId)
            console.log(`[房间清理] ${roomId}（全员离线超时）`)
          }
        }
      }
    }, CLEANUP_INTERVAL_MS)
    // 不阻止进程退出
    this.cleanupTimer.unref()
  }

  /** 获取房间数量（调试用） */
  getRoomCount(): number {
    return this.rooms.size
  }
}
