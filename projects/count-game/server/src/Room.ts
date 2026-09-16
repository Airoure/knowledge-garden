import type {
  BattleConfig,
  BattlePlayer,
  PlayerState,
  PlayerProgress,
  Question,
  BattleResultEntry,
  RoomStatus,
} from './types.js'
import { WRONG_PENALTY_SECONDS } from './types.js'
import { generateQuestions } from './QuestionGenerator.js'

/**
 * 房间类
 *
 * 管理一个对战房间的完整生命周期：
 * 玩家加入/离开/断线重连、游戏开始、答题判定、进度同步、结果汇总
 *
 * 身份模型：玩家以 playerId（持久化）为唯一标识，socketId 仅作传输通道。
 * 断线时玩家被标记为 connected=false 但保留在房间内，等待宽限期内重连。
 */
export class Room {
  readonly id: string
  readonly config: BattleConfig
  /** 房间创建时间戳，用于 TTL 清理 */
  readonly createdAt: number

  /** 当前房主的 playerId（房主转移时会变更） */
  private _hostId: string
  private players = new Map<string, PlayerState>()
  private status: RoomStatus = 'waiting'
  private questions: Question[] = []
  private startTime: number | null = null
  private finishedCount = 0

  constructor(id: string, hostId: string, hostName: string, config: BattleConfig, hostSocketId: string) {
    this.id = id
    this.config = config
    this.createdAt = Date.now()
    this._hostId = hostId
    this.addPlayer(hostId, hostName, true, hostSocketId)
  }

  /** 房主 playerId */
  get hostId(): string {
    return this._hostId
  }

  /** 添加玩家 */
  addPlayer(playerId: string, name: string, isHost: boolean, socketId: string): boolean {
    if (this.players.has(playerId)) return false
    if (this.status !== 'waiting') return false

    this.players.set(playerId, {
      id: playerId,
      name,
      isHost,
      currentIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      finished: false,
      finishTime: null,
      socketId,
      connected: true,
      disconnectedAt: null,
    })
    return true
  }

  /** 移除玩家（真实移除，非断线标记） */
  removePlayer(playerId: string): PlayerState | null {
    const player = this.players.get(playerId)
    if (!player) return null
    this.players.delete(playerId)
    return player
  }

  /** 玩家是否存在（含断线未移除的） */
  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId)
  }

  /** 重新绑定 socket（重连时调用） */
  rebindSocket(playerId: string, socketId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false
    player.socketId = socketId
    player.connected = true
    player.disconnectedAt = null
    return true
  }

  /** 标记玩家断线（不移除，等待宽限期） */
  markDisconnected(playerId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false
    player.socketId = null
    player.connected = false
    player.disconnectedAt = Date.now()
    return true
  }

  /** 根据 socket.id 查找玩家 */
  getPlayerBySocketId(socketId: string): PlayerState | null {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player
    }
    return null
  }

  /** 转移房主给指定玩家 */
  transferHost(toPlayerId: string): boolean {
    const player = this.players.get(toPlayerId)
    if (!player) return false
    // 清除旧房主标记
    const oldHost = this.players.get(this._hostId)
    if (oldHost) oldHost.isHost = false
    player.isHost = true
    this._hostId = toPlayerId
    return true
  }

  /** 获取所有玩家 */
  getPlayers(): PlayerState[] {
    return Array.from(this.players.values())
  }

  /** 获取下发前端的玩家视图（含在线状态） */
  getPlayersView(): BattlePlayer[] {
    return this.getPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
    }))
  }

  /** 玩家总数（含断线未移除） */
  get playerCount(): number {
    return this.players.size
  }

  /** 在线玩家数 */
  get connectedPlayerCount(): number {
    let count = 0
    for (const p of this.players.values()) {
      if (p.connected) count++
    }
    return count
  }

  /** 是否在等待中 */
  get isWaiting(): boolean {
    return this.status === 'waiting'
  }

  /** 是否在游戏中 */
  get isPlaying(): boolean {
    return this.status === 'playing'
  }

  /** 是否已结束 */
  get isFinished(): boolean {
    return this.status === 'finished'
  }

  /** 房间状态 */
  get roomStatus(): RoomStatus {
    return this.status
  }

  /** 题目列表（重连时下发） */
  getQuestions(): Question[] {
    return this.questions
  }

  /** 开始游戏 */
  startGame(): Question[] | null {
    if (this.status !== 'waiting') return null
    if (this.players.size < 2) return null

    this.questions = generateQuestions(this.config)
    this.status = 'playing'
    this.startTime = Date.now()
    this.finishedCount = 0

    // 重置所有玩家状态
    for (const player of this.players.values()) {
      player.currentIndex = 0
      player.correctCount = 0
      player.wrongCount = 0
      player.finished = false
      player.finishTime = null
    }

    return this.questions
  }

  /** 强制结束游戏（玩家离场导致人数不足时） */
  endGame(): void {
    this.status = 'finished'
  }

  /**
   * 重置房间到等待状态（再来一局）
   *
   * 清除题目、计时、所有玩家的答题进度，
   * 房间回到 waiting 状态，房主可重新开始游戏。
   */
  resetToWaiting(): void {
    this.status = 'waiting'
    this.questions = []
    this.startTime = null
    this.finishedCount = 0
    for (const player of this.players.values()) {
      player.currentIndex = 0
      player.correctCount = 0
      player.wrongCount = 0
      player.finished = false
      player.finishTime = null
    }
  }

  /**
   * 提交答案
   *
   * 答对 → 前进到下一题（或完成）
   * 答错 → 留在当前题，罚时 10 秒
   *
   * @returns { correct, correctAnswer, playerFinished, gameEnded }
   */
  submitAnswer(
    playerId: string,
    answer: number,
  ): {
    correct: boolean
    correctAnswer: number
    playerFinished: boolean
    gameEnded: boolean
  } | null {
    if (this.status !== 'playing') return null
    const player = this.players.get(playerId)
    if (!player || player.finished) return null

    const question = this.questions[player.currentIndex]
    if (!question) return null

    // 百分数正向题答案带小数，用容差比较吸收浮点误差（整数题等价于严格相等）
    const correct = Math.abs(answer - question.answer) < 0.005

    if (correct) {
      player.correctCount++
      // 是否是最后一题
      if (player.currentIndex >= this.questions.length - 1) {
        player.finished = true
        player.finishTime = Date.now()
        this.finishedCount++

        // 第一个完成 → 游戏结束
        if (this.finishedCount === 1) {
          this.status = 'finished'
          return {
            correct: true,
            correctAnswer: question.answer,
            playerFinished: true,
            gameEnded: true,
          }
        }
      } else {
        player.currentIndex++
      }
    } else {
      player.wrongCount++
    }

    return {
      correct,
      correctAnswer: question.answer,
      playerFinished: player.finished,
      gameEnded: false,
    }
  }

  /** 获取指定玩家的进度（用于广播） */
  getPlayerProgress(playerId: string): PlayerProgress | null {
    const player = this.players.get(playerId)
    if (!player) return null
    return {
      playerId: player.id,
      name: player.name,
      currentIndex: player.currentIndex,
      correctCount: player.correctCount,
      wrongCount: player.wrongCount,
      finished: player.finished,
      finishTime: player.finishTime,
    }
  }

  /** 获取所有玩家的进度 */
  getAllProgress(): PlayerProgress[] {
    return this.getPlayers().map((p) => ({
      playerId: p.id,
      name: p.name,
      currentIndex: p.currentIndex,
      correctCount: p.correctCount,
      wrongCount: p.wrongCount,
      finished: p.finished,
      finishTime: p.finishTime,
    }))
  }

  /** 游戏开始时间戳 */
  get gameStartTime(): number | null {
    return this.startTime
  }

  /**
   * 汇总对战结果
   *
   * 排序规则：先完成的排名靠前；都未完成时按 currentIndex 降序
   * 总时间 = 实际耗时 + 错误数 × 10 秒
   */
  getResults(): BattleResultEntry[] {
    if (!this.startTime) return []

    const now = Date.now()
    const results: BattleResultEntry[] = this.getPlayers().map((player) => {
      const endTime = player.finishTime ?? now
      const elapsed = Math.floor((endTime - this.startTime!) / 1000)
      const totalTime = elapsed + player.wrongCount * WRONG_PENALTY_SECONDS
      return {
        playerId: player.id,
        name: player.name,
        correctCount: player.correctCount,
        wrongCount: player.wrongCount,
        finished: player.finished,
        finishTime: player.finishTime,
        elapsed,
        totalTime,
        rank: 0,
      }
    })

    // 排序：已完成的按 totalTime 升序，未完成的排后面按 currentIndex 降序
    results.sort((a, b) => {
      if (a.finished && b.finished) return a.totalTime - b.totalTime
      if (a.finished) return -1
      if (b.finished) return 1
      const playerA = this.players.get(a.playerId)!
      const playerB = this.players.get(b.playerId)!
      return playerB.currentIndex - playerA.currentIndex
    })

    results.forEach((r, i) => {
      r.rank = i + 1
    })

    return results
  }

  /** 是否为空房间 */
  get isEmpty(): boolean {
    return this.players.size === 0
  }
}
