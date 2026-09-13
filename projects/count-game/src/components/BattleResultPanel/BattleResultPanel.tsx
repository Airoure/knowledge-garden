import { Card } from '@/components/shared/Card'
import { formatTime } from '@/utils/format'
import type { BattleResultEntry } from '@/types'
import styles from './BattleResultPanel.module.css'

interface BattleResultPanelProps {
  results: BattleResultEntry[]
  playerId: string
  onLeave: () => void
  onRematch: () => void
}

/**
 * 对战结果面板
 *
 * 展示排名、胜负判定、双方详细数据对比
 */
export function BattleResultPanel({ results, playerId, onLeave, onRematch }: BattleResultPanelProps) {
  const myResult = results.find((r) => r.playerId === playerId)
  const isWinner = myResult?.rank === 1

  return (
    <Card className={styles.resultPanel}>
      {/* 胜负印章 */}
      <div className={`${styles.seal} ${isWinner ? styles.sealWin : styles.sealLose}`}>
        {isWinner ? '胜' : '败'}
      </div>
      <h2 className={styles.title}>
        {isWinner ? '技高一筹' : '再接再厉'}
      </h2>
      <p className={styles.subtitle}>
        {isWinner ? 'VICTORY' : 'DEFEAT'}
      </p>

      {/* 排名列表 */}
      <div className={styles.rankList}>
        {results.map((entry) => {
          const isMe = entry.playerId === playerId
          return (
            <div
              key={entry.playerId}
              className={`${styles.rankItem} ${isMe ? styles.rankMe : ''}`}
            >
              <div className={styles.rankBadge}>
                {entry.rank === 1 ? '①' : entry.rank === 2 ? '②' : '③'}
              </div>
              <div className={styles.rankInfo}>
                <div className={styles.rankName}>
                  {entry.name}
                  {isMe && <span className={styles.meTag}>我</span>}
                </div>
                <div className={styles.rankStats}>
                  <span>答对 {entry.correctCount}</span>
                  <span>错误 {entry.wrongCount}</span>
                  <span className={styles.rankTime}>
                    {formatTime(entry.totalTime)}
                  </span>
                </div>
              </div>
              {entry.rank === 1 && <div className={styles.crown}>♛</div>}
            </div>
          )
        })}
      </div>

      {/* 时间明细 */}
      {myResult && (
        <div className={styles.timeDetail}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>实际用时</span>
            <span className={styles.detailValue}>{formatTime(myResult.elapsed)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>罚时</span>
            <span className={`${styles.detailValue} ${styles.penaltyTime}`}>
              +{myResult.wrongCount * 10}秒
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>总时间</span>
            <span className={`${styles.detailValue} ${styles.totalTime}`}>
              {formatTime(myResult.totalTime)}
            </span>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.rematchBtn} onClick={onRematch} type="button">
          再来一局
        </button>
        <button className={styles.leaveBtn} onClick={onLeave} type="button">
          返回大厅
        </button>
      </div>
    </Card>
  )
}
