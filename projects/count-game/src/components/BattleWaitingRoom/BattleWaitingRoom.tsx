import { Card } from '@/components/shared/Card'
import type { BattlePlayer, BattleConfig } from '@/types'
import { OPERATION_META } from '@/utils/questionGenerator'
import styles from './BattleWaitingRoom.module.css'

interface BattleWaitingRoomProps {
  roomId: string
  players: BattlePlayer[]
  isHost: boolean
  config: BattleConfig
  onStart: () => void
  onLeave: () => void
}

/**
 * 对战等待室
 *
 * 展示房间号供分享、已加入的玩家列表、对战配置
 * 房主可点击"开始对战"
 */
export function BattleWaitingRoom({
  roomId,
  players,
  isHost,
  config,
  onStart,
  onLeave,
}: BattleWaitingRoomProps) {
  const connectedCount = players.filter((p) => p.connected).length
  const canStart = connectedCount >= 2

  const opSymbols = config.operations.map((op) => OPERATION_META[op].symbol).join(' ')

  return (
    <Card className={styles.waitingRoom}>
      <button className={styles.backBtn} onClick={onLeave} type="button">
        ← 离开房间
      </button>

      <h2 className={styles.title}>等待室</h2>

      {/* 房间号展示 */}
      <div className={styles.roomCodeArea}>
        <div className={styles.roomCodeLabel}>房间号</div>
        <div className={styles.roomCode}>{roomId}</div>
        <div className={styles.roomCodeHint}>将此房间号分享给对手</div>
      </div>

      {/* 玩家列表 */}
      <div className={styles.sectionLabel}>参赛选手（{players.length}/2）</div>
      <div className={styles.playerList}>
        {players.map((player, idx) => (
          <div
            key={player.id}
            className={`${styles.playerItem} ${!player.connected ? styles.playerOffline : ''}`}
          >
            <span className={styles.playerBadge}>{idx === 0 ? '主' : '客'}</span>
            <span className={styles.playerName}>{player.name}</span>
            {!player.connected && <span className={styles.offlineTag}>重连中</span>}
            {player.isHost && <span className={styles.hostTag}>房主</span>}
          </div>
        ))}
        {players.length < 2 && (
          <div className={styles.playerItemPlaceholder}>
            <span className={styles.playerBadgePlaceholder}>?</span>
            <span className={styles.placeholderText}>等待对手加入…</span>
          </div>
        )}
      </div>

      {/* 对战配置 */}
      <div className={styles.sectionLabel}>对战配置</div>
      <div className={styles.configRow}>
        <span className={styles.configLabel}>运算</span>
        <span className={styles.configValue}>{opSymbols}</span>
      </div>
      <div className={styles.configRow}>
        <span className={styles.configLabel}>难度</span>
        <span className={styles.configValue}>
          {config.difficulty === 'easy' ? '一位数' : '两位数'}
        </span>
      </div>
      <div className={styles.configRow}>
        <span className={styles.configLabel}>题量</span>
        <span className={styles.configValue}>{config.totalCount} 题</span>
      </div>
      <div className={styles.configRow}>
        <span className={styles.configLabel}>罚时</span>
        <span className={styles.configValue}>答错 +10 秒</span>
      </div>

      {/* 开始按钮 */}
      {isHost ? (
        <button
          className={styles.startBtn}
          onClick={onStart}
          type="button"
          disabled={!canStart}
        >
          {canStart ? '开 始 对 战' : '等待对手上线…'}
        </button>
      ) : (
        <div className={styles.waitingHint}>
          {canStart ? '等待房主开始游戏…' : '等待其他玩家上线…'}
        </div>
      )}
    </Card>
  )
}
