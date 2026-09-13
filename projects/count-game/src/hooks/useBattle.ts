import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket, disconnectSocket, getPlayerId } from '@/services/socket'
import type {
  BattleConfig,
  BattlePlayer,
  BattleRejoinResult,
  ConnectionState,
  OpponentProgress,
  BattleResultEntry,
  Question,
  AnswerStatus,
} from '@/types'
import { BATTLE_WRONG_PENALTY } from '@/types'

/** 对战阶段 */
export type BattlePhase = 'idle' | 'lobby' | 'playing' | 'finished'

/** useBattle Hook 的返回值 */
export interface UseBattleReturn {
  /** 当前阶段 */
  phase: BattlePhase
  /** 房间号 */
  roomId: string | null
  /** 当前玩家 ID */
  playerId: string | null
  /** 是否为房主 */
  isHost: boolean
  /** 房间内所有玩家 */
  players: BattlePlayer[]
  /** 对战配置 */
  config: BattleConfig | null
  /** 当前题目列表 */
  questions: Question[]
  /** 当前题目索引 */
  currentIndex: number
  /** 当前题目 */
  currentQuestion: Question | null
  /** 正确数 */
  correctCount: number
  /** 错误数 */
  wrongCount: number
  /** 答题状态 */
  answerStatus: AnswerStatus
  /** 是否已答题（当前题） */
  isAnswered: boolean
  /** 游戏开始时间戳 */
  startTime: number | null
  /** 对手进度列表 */
  opponents: OpponentProgress[]
  /** 对战结果 */
  results: BattleResultEntry[] | null
  /** 错误消息 */
  error: string | null
  /** Socket 连接状态 */
  connectionState: ConnectionState

  // 操作方法
  createRoom: (name: string, config: BattleConfig) => void
  joinRoom: (roomId: string, name: string) => void
  startGame: () => void
  submitAnswer: (answer: number) => void
  leaveRoom: () => void
  rematch: () => void
  clearError: () => void
}

/**
 * 对战模式核心 Hook
 *
 * 管理 Socket 连接、房间生命周期、游戏状态、对手进度同步
 *
 * 重连机制：
 * - 玩家身份用持久化 playerId（localStorage），不依赖 socket.id
 * - Socket 重连成功（connect 事件）后自动发起 battle:rejoin 恢复房间身份与进度
 * - 断线期间 connectionState 为 'reconnecting'，供 UI 提示
 */
export function useBattle(): UseBattleReturn {
  const [phase, setPhase] = useState<BattlePhase>('idle')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [players, setPlayers] = useState<BattlePlayer[]>([])
  const [config, setConfig] = useState<BattleConfig | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [opponents, setOpponents] = useState<OpponentProgress[]>([])
  const [results, setResults] = useState<BattleResultEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected')

  // 持久化玩家身份（跨重连不变）
  const playerIdRef = useRef<string>(getPlayerId())
  // 用 ref 存 roomId，供事件回调使用
  const roomIdRef = useRef<string | null>(null)

  // ===== 创建房间 =====
  const createRoom = useCallback((name: string, battleConfig: BattleConfig) => {
    const socket = getSocket()
    socket.emit(
      'battle:create',
      { playerId: playerIdRef.current, name, config: battleConfig },
      (res: {
        roomId: string
        playerId: string
        players: BattlePlayer[]
        config: BattleConfig
        isHost: boolean
        error?: string
      }) => {
        if (res.error) {
          setError(res.error)
          return
        }
        setRoomId(res.roomId)
        setPlayerId(res.playerId)
        setIsHost(res.isHost)
        setPlayers(res.players)
        setConfig(res.config)
        roomIdRef.current = res.roomId
        setPhase('lobby')
      },
    )
  }, [])

  // ===== 加入房间 =====
  const joinRoom = useCallback((id: string, name: string) => {
    const socket = getSocket()
    socket.emit(
      'battle:join',
      { playerId: playerIdRef.current, roomId: id, name },
      (res: {
        roomId: string
        playerId: string
        players: BattlePlayer[]
        config: BattleConfig
        isHost: boolean
        error?: string
      }) => {
        if (res.error) {
          setError(res.error)
          return
        }
        setRoomId(res.roomId)
        setPlayerId(res.playerId)
        setIsHost(res.isHost)
        setPlayers(res.players)
        setConfig(res.config)
        roomIdRef.current = res.roomId
        setPhase('lobby')
      },
    )
  }, [])

  // ===== 开始游戏 =====
  const startGame = useCallback(() => {
    if (!roomIdRef.current) return
    const socket = getSocket()
    socket.emit('battle:start', { roomId: roomIdRef.current }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) {
        setError(res.error)
      }
    })
  }, [])

  // ===== 提交答案 =====
  const submitAnswer = useCallback(
    (answer: number) => {
      if (!roomIdRef.current || phase !== 'playing') return
      if (answerStatus !== 'idle') return // 防止重复提交

      const socket = getSocket()
      socket.emit(
        'battle:answer',
        { roomId: roomIdRef.current, answer },
        (res: {
          correct: boolean
          correctAnswer: number
          playerFinished: boolean
          error?: string
        }) => {
          if (res.error) {
            setError(res.error)
            return
          }

          if (res.correct) {
            setCorrectCount((c) => c + 1)
            setAnswerStatus('correct')

            if (res.playerFinished) {
              // 自己完成了所有题目
              setCurrentIndex((idx) => idx + 1) // 越界表示完成
            } else {
              // 延迟后进入下一题
              setTimeout(() => {
                setCurrentIndex((idx) => idx + 1)
                setAnswerStatus('idle')
              }, 500)
            }
          } else {
            setWrongCount((w) => w + 1)
            setAnswerStatus('wrong')

            // 对战模式答错不跳过，短暂反馈后重置状态
            setTimeout(() => {
              setAnswerStatus('idle')
            }, 800)
          }
        },
      )
    },
    [phase, answerStatus],
  )

  // ===== 离开房间 =====
  const leaveRoom = useCallback(() => {
    if (roomIdRef.current) {
      const socket = getSocket()
      socket.emit('battle:leave', { roomId: roomIdRef.current })
    }
    disconnectSocket()
    setPhase('idle')
    setRoomId(null)
    setPlayerId(null)
    setIsHost(false)
    setPlayers([])
    setConfig(null)
    setQuestions([])
    setCurrentIndex(0)
    setCorrectCount(0)
    setWrongCount(0)
    setAnswerStatus('idle')
    setStartTime(null)
    setOpponents([])
    setResults(null)
    setConnectionState('connected')
    roomIdRef.current = null
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // ===== 再来一局 =====
  const rematch = useCallback(() => {
    if (!roomIdRef.current || !playerIdRef.current) return
    const socket = getSocket()
    socket.emit(
      'battle:rematch',
      { playerId: playerIdRef.current, roomId: roomIdRef.current },
      (res: { ok?: boolean; error?: string }) => {
        if (res.error) {
          setError(res.error)
        }
      },
    )
  }, [])

  // ===== 注册 Socket 事件监听（进入对战时） =====
  useEffect(() => {
    if (phase === 'idle') return

    const socket = getSocket()

    // 房间成员变化（加入/离开/断线/重连/房主转移）
    const onPlayersUpdate = (payload: { players: BattlePlayer[] }) => {
      setPlayers(payload.players)
      // 清理已离开玩家的对手进度
      setOpponents((prev) => prev.filter((o) => payload.players.some((p) => p.id === o.playerId)))
      // 同步房主身份（房主可能已转移）
      const me = payload.players.find((p) => p.id === playerIdRef.current)
      if (me) {
        setIsHost(me.isHost)
      }
    }

    // 游戏开始
    const onGameStarted = (payload: {
      questions: Question[]
      startTime: number
      config: BattleConfig
    }) => {
      setQuestions(payload.questions)
      setStartTime(payload.startTime)
      setCurrentIndex(0)
      setCorrectCount(0)
      setWrongCount(0)
      setAnswerStatus('idle')
      setOpponents([])
      setResults(null)
      setPhase('playing')
    }

    // 对手进度更新
    const onProgress = (progress: OpponentProgress) => {
      setOpponents((prev) => {
        const others = prev.filter((o) => o.playerId !== progress.playerId)
        return [...others, progress]
      })
    }

    // 游戏结束
    const onGameOver = (payload: { results: BattleResultEntry[] }) => {
      setResults(payload.results)
      setPhase('finished')
    }

    // 再来一局：房间重置回等待状态
    const onRematch = (payload: { players: BattlePlayer[] }) => {
      setPlayers(payload.players)
      setQuestions([])
      setCurrentIndex(0)
      setCorrectCount(0)
      setWrongCount(0)
      setAnswerStatus('idle')
      setStartTime(null)
      setOpponents([])
      setResults(null)
      setPhase('lobby')
    }

    // 断线 → 标记重连中
    const onDisconnect = () => {
      setConnectionState('reconnecting')
    }

    // 连接成功（含重连）→ 若已在房间则自动归位
    const onConnect = () => {
      setConnectionState('connected')
      if (roomIdRef.current && playerIdRef.current) {
        socket.emit(
          'battle:rejoin',
          { playerId: playerIdRef.current, roomId: roomIdRef.current },
          (res: BattleRejoinResult) => {
            if (res.error || !res.ok) {
              // 房间已失效，退回入口
              setError(res.error || '房间已失效')
              setPhase('idle')
              setRoomId(null)
              setIsHost(false)
              setPlayers([])
              setConfig(null)
              setQuestions([])
              setStartTime(null)
              setOpponents([])
              setResults(null)
              roomIdRef.current = null
              return
            }
            // 恢复房间身份与状态
            setRoomId(res.roomId)
            setPlayerId(res.playerId)
            setIsHost(res.isHost)
            setPlayers(res.players)
            setConfig(res.config)
            roomIdRef.current = res.roomId

            if (res.status === 'waiting') {
              setPhase('lobby')
            } else if (res.status === 'playing') {
              setQuestions(res.questions ?? [])
              setStartTime(res.startTime ?? null)
              setCurrentIndex(res.currentIndex ?? 0)
              setCorrectCount(res.correctCount ?? 0)
              setWrongCount(res.wrongCount ?? 0)
              setAnswerStatus('idle')
              setOpponents(res.opponents ?? [])
              setResults(null)
              setPhase('playing')
            } else if (res.status === 'finished') {
              setQuestions(res.questions ?? [])
              setStartTime(res.startTime ?? null)
              setResults(res.results ?? null)
              setPhase('finished')
            }
          },
        )
      }
    }

    socket.on('battle:players_update', onPlayersUpdate)
    socket.on('battle:started', onGameStarted)
    socket.on('battle:progress', onProgress)
    socket.on('battle:game_over', onGameOver)
    socket.on('battle:rematch', onRematch)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('battle:players_update', onPlayersUpdate)
      socket.off('battle:started', onGameStarted)
      socket.off('battle:progress', onProgress)
      socket.off('battle:game_over', onGameOver)
      socket.off('battle:rematch', onRematch)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [phase === 'idle']) // 仅在进入/退出 idle 时重新注册

  // ===== 派生状态 =====
  const currentQuestion =
    currentIndex < questions.length ? questions[currentIndex] ?? null : null

  const isAnswered = answerStatus !== 'idle'

  return {
    phase,
    roomId,
    playerId,
    isHost,
    players,
    config,
    questions,
    currentIndex,
    currentQuestion,
    correctCount,
    wrongCount,
    answerStatus,
    isAnswered,
    startTime,
    opponents,
    results,
    error,
    connectionState,
    createRoom,
    joinRoom,
    startGame,
    submitAnswer,
    leaveRoom,
    rematch,
    clearError,
  }
}

export { BATTLE_WRONG_PENALTY }
