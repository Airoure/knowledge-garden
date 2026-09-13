import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/Header/Header'
import { SetupPanel } from '@/components/SetupPanel/SetupPanel'
import { PracticePanel } from '@/components/PracticePanel/PracticePanel'
import { ResultPanel } from '@/components/ResultPanel/ResultPanel'
import { MusicToggle } from '@/components/MusicToggle/MusicToggle'
import { BattleLobby } from '@/components/BattleLobby/BattleLobby'
import { BattleWaitingRoom } from '@/components/BattleWaitingRoom/BattleWaitingRoom'
import { BattlePracticePanel } from '@/components/BattlePracticePanel/BattlePracticePanel'
import { BattleResultPanel } from '@/components/BattleResultPanel/BattleResultPanel'
import { LoginPanel } from '@/components/LoginPanel/LoginPanel'
import { HistoryPanel } from '@/components/HistoryPanel/HistoryPanel'
import { GaozhaoPanel } from '@/components/GaozhaoPanel/GaozhaoPanel'
import { CornerOrnaments } from '@/components/shared/CornerOrnaments'
import { usePractice } from '@/hooks/usePractice'
import { useBattle } from '@/hooks/useBattle'
import { useBackgroundMusic } from '@/hooks/useBackgroundMusic'
import { useAuth } from '@/hooks/useAuth'
import { saveRecord } from '@/services/record'
import type { PracticeConfig, Phase } from '@/types'
import styles from './App.module.css'
import bgMusic from '../sound/bg.mp3'

/** 默认练习配置 */
const DEFAULT_CONFIG: PracticeConfig = {
  mode: 'fixed',
  operations: ['add', 'sub', 'mul', 'div'],
  difficulty: 'easy',
  direction: 'forward',
  totalCount: 20,
  endless: {
    initialTime: 60,
    correctBonus: 3,
    wrongPenalty: 3,
  },
}

/**
 * 应用根组件
 *
 * 未登录 → 显示登录/注册面板
 * 已登录 → 单人模式：setup → practice → result
 *          对战模式：setup → battle-lobby → battle-practice → battle-result
 */
export default function App() {
  const [config, setConfig] = useState<PracticeConfig>(DEFAULT_CONFIG)
  const [battleEntry, setBattleEntry] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showGaozhao, setShowGaozhao] = useState(false)
  const practice = usePractice()
  const battle = useBattle()
  const { isMuted, toggleMute } = useBackgroundMusic(bgMusic)
  const auth = useAuth()

  // 用于防止同一次结果重复上报
  const practiceRecordedRef = useRef(false)
  const battleRecordedRef = useRef(false)

  // 判断是否处于对战模式（已创建/加入房间）
  const inBattle = battle.phase !== 'idle'

  // 确定当前阶段
  let phase: Phase
  if (showHistory) {
    phase = 'history'
  } else if (showGaozhao) {
    phase = 'gaozhao'
  } else if (inBattle) {
    // 对战模式阶段
    switch (battle.phase) {
      case 'lobby':
        phase = 'battle-lobby'
        break
      case 'playing':
        phase = 'battle-practice'
        break
      case 'finished':
        phase = 'battle-result'
        break
      default:
        phase = 'setup'
    }
  } else if (battleEntry) {
    // 对战入口（BattleLobby）
    phase = 'setup' // 占位，实际由 battleEntry 控制渲染
  } else if (practice.result) {
    phase = 'result'
  } else if (practice.isActive) {
    phase = 'practice'
  } else {
    phase = 'setup'
  }

  // 从对战模式返回设置
  const handleBackToSetup = () => {
    if (battle.phase !== 'idle') {
      battle.leaveRoom()
    }
    setBattleEntry(false)
    setShowHistory(false)
    setShowGaozhao(false)
    setConfig({ ...config, mode: 'fixed' })
  }

  // ===== 单人模式：结果产生时上报记录 =====
  useEffect(() => {
    if (!practice.result || practiceRecordedRef.current) return
    practiceRecordedRef.current = true
    saveRecord({
      mode: practice.result.mode,
      operations: config.operations,
      difficulty: config.difficulty,
      totalCount: practice.result.totalCount,
      correctCount: practice.result.correctCount,
      accuracy: practice.result.accuracy,
      timeElapsed: practice.result.timeElapsed,
    })
  }, [practice.result, config])

  // ===== 对战模式：结果产生时上报记录 =====
  useEffect(() => {
    if (!battle.results || !battle.playerId || battleRecordedRef.current) return
    battleRecordedRef.current = true
    const myResult = battle.results.find((r) => r.playerId === battle.playerId)
    if (!myResult || !battle.config) return
    const accuracy =
      myResult.correctCount + myResult.wrongCount > 0
        ? Math.round((myResult.correctCount / (myResult.correctCount + myResult.wrongCount)) * 100)
        : 0
    saveRecord({
      mode: 'battle',
      operations: battle.config.operations,
      difficulty: battle.config.difficulty,
      totalCount: battle.config.totalCount,
      correctCount: myResult.correctCount,
      accuracy,
      timeElapsed: myResult.totalTime,
      rank: myResult.rank,
      playerCount: battle.results.length,
    })
  }, [battle.results, battle.playerId, battle.config])

  // 开始练习时重置上报标记
  const handleStartPractice = () => {
    practiceRecordedRef.current = false
    practice.start(config)
  }

  // ===== 未登录：显示登录/注册面板 =====
  if (!auth.isAuthenticated) {
    return (
      <div className={styles.app}>
        <MusicToggle isMuted={isMuted} onToggle={toggleMute} />
        <CornerOrnaments />
        <Header />
        {!auth.loading && (
          <LoginPanel
            onRegister={auth.register}
            onLogin={auth.login}
            loading={auth.loading}
            error={auth.error}
            onClearError={auth.clearError}
          />
        )}
      </div>
    )
  }

  // ===== 已登录：显示主应用 =====
  return (
    <div className={styles.app}>
      <MusicToggle isMuted={isMuted} onToggle={toggleMute} />
      <CornerOrnaments />
      <Header username={auth.user?.username} onLogout={auth.logout} />

      {/* ===== 对战模式：断线重连提示 ===== */}
      {inBattle && battle.connectionState === 'reconnecting' && (
        <div className={styles.reconnectBanner}>网络断开，正在重连…</div>
      )}

      {/* ===== 单人模式：设置 ===== */}
      {phase === 'setup' && !battleEntry && (
        <SetupPanel
          config={config}
          onConfigChange={setConfig}
          onStart={() => {
            if (config.mode === 'battle') {
              setBattleEntry(true)
            } else {
              handleStartPractice()
            }
          }}
          onShowHistory={() => setShowHistory(true)}
          onShowGaozhao={() => setShowGaozhao(true)}
        />
      )}

      {/* ===== 对战模式入口 ===== */}
      {phase === 'setup' && battleEntry && !inBattle && (
        <BattleLobby
          onCreateRoom={battle.createRoom}
          onJoinRoom={battle.joinRoom}
          onBack={() => {
            setBattleEntry(false)
            setConfig({ ...config, mode: 'fixed' })
          }}
          error={battle.error}
          onClearError={battle.clearError}
          defaultName={auth.user?.username}
        />
      )}

      {/* ===== 对战等待室 ===== */}
      {phase === 'battle-lobby' && battle.roomId && battle.config && (
        <BattleWaitingRoom
          roomId={battle.roomId}
          players={battle.players}
          isHost={battle.isHost}
          config={battle.config}
          onStart={battle.startGame}
          onLeave={handleBackToSetup}
        />
      )}

      {/* ===== 对战练习 ===== */}
      {phase === 'battle-practice' &&
        battle.currentQuestion &&
        battle.config &&
        battle.startTime && (
          <BattlePracticePanel
            question={battle.currentQuestion}
            currentIndex={battle.currentIndex}
            totalCount={battle.config.totalCount}
            correctCount={battle.correctCount}
            wrongCount={battle.wrongCount}
            answerStatus={battle.answerStatus}
            startTime={battle.startTime}
            opponents={battle.opponents}
            onSubmit={battle.submitAnswer}
            onQuit={handleBackToSetup}
          />
        )}

      {/* ===== 对战结果 ===== */}
      {phase === 'battle-result' && battle.results && battle.playerId && (
        <BattleResultPanel
          results={battle.results}
          playerId={battle.playerId}
          onLeave={handleBackToSetup}
          onRematch={battle.rematch}
        />
      )}

      {/* ===== 单人模式：练习 ===== */}
      {phase === 'practice' && practice.currentQuestion && (
        <PracticePanel
          mode={practice.mode}
          currentQuestion={practice.currentQuestion}
          currentIndex={practice.currentIndex}
          totalCount={practice.questions.length}
          totalAnswered={practice.totalAnswered}
          correctCount={practice.correctCount}
          elapsed={practice.elapsed}
          remainingTime={practice.remainingTime}
          initialTime={config.endless.initialTime}
          correctBonus={config.endless.correctBonus}
          wrongPenalty={config.endless.wrongPenalty}
          answerStatus={practice.answerStatus}
          isAnswered={practice.isAnswered}
          feedbackDelay={practice.FEEDBACK_DELAY}
          onSubmit={practice.submitAnswer}
          onNext={practice.next}
          onQuit={practice.quit}
        />
      )}

      {/* ===== 单人模式：结果 ===== */}
      {phase === 'result' && practice.result && (
        <ResultPanel
          result={practice.result}
          onRetry={handleStartPractice}
          onHome={practice.quit}
        />
      )}

      {/* ===== 历史记录 ===== */}
      {phase === 'history' && (
        <HistoryPanel onBack={() => setShowHistory(false)} />
      )}

      {/* ===== 高照数算 ===== */}
      {phase === 'gaozhao' && (
        <GaozhaoPanel onBack={() => setShowGaozhao(false)} />
      )}
    </div>
  )
}
