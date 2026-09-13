import { useHistory } from '@/hooks/useHistory'
import { OPERATION_META } from '@/utils/questionGenerator'
import type { GameMode } from '@/services/record'
import type { Operation } from '@/types'
import styles from './HistoryPanel.module.css'

/** 模式标签映射 */
const MODE_LABELS: Record<GameMode, string> = {
  fixed: '固定',
  endless: '无尽',
  battle: '对战',
}

/** 运算符号拼接 */
function formatOps(ops: Operation[]): string {
  return ops.map((op) => OPERATION_META[op].symbol).join(' ')
}

/** 格式化时间 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

/** 格式化日期 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hour}:${min}`
}

/** 名次样式 */
function rankClass(rank: number): string {
  if (rank === 1) return styles.rank1
  if (rank === 2) return styles.rank2
  return styles.rankOther
}

/** 名次文字 */
function rankText(rank: number, playerCount: number): string {
  return `第${rank}名 / ${playerCount}人`
}

interface HistoryPanelProps {
  onBack: () => void
}

/**
 * 历史记录面板
 *
 * 展示用户的做题统计概览与最近记录列表。
 */
export function HistoryPanel({ onBack }: HistoryPanelProps) {
  const { records, stats, loading } = useHistory()

  return (
    <div className={styles.history}>
      <button className={styles.backBtn} onClick={onBack}>
        ← 返回
      </button>
      <h2 className={styles.title}>修 行 履 历</h2>
      <p className={styles.desc}>RECORDS · 最近的修行足迹</p>

      {/* 统计概览 */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.ink}`}>{stats.totalSessions}</div>
            <div className={styles.statLabel}>总场次</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.jade}`}>{stats.totalCorrect}</div>
            <div className={styles.statLabel}>总答对</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.gold}`}>{stats.bestAccuracy}%</div>
            <div className={styles.statLabel}>最高正确率</div>
          </div>
          <div className={styles.statBox}>
            <div className={`${styles.statValue} ${styles.vermilion}`}>{stats.battleWins}</div>
            <div className={styles.statLabel}>对战胜场</div>
          </div>
        </div>
      )}

      {/* 记录列表 */}
      <div className={styles.sectionLabel}>最近记录</div>
      {loading ? (
        <div className={styles.loading}>载入中…</div>
      ) : records.length === 0 ? (
        <div className={styles.empty}>尚无修行记录，开始练习吧</div>
      ) : (
        <div className={styles.recordList}>
          {records.map((r) => (
            <div key={r.id} className={styles.recordItem}>
              <span
                className={`${styles.modeTag} ${
                  r.mode === 'fixed'
                    ? styles.modeFixed
                    : r.mode === 'endless'
                      ? styles.modeEndless
                      : styles.modeBattle
                }`}
              >
                {MODE_LABELS[r.mode]}
              </span>
              <div className={styles.recordBody}>
                <span className={styles.recordOps}>{formatOps(r.operations)}</span>
                <div className={styles.recordStats}>
                  <span className={styles.recordStat}>
                    <span className={styles.recordStatValue}>{r.correctCount}</span>
                    <span>/{r.totalCount}</span>
                  </span>
                  <span className={styles.recordStat}>
                    <span className={styles.recordStatValue}>{r.accuracy}%</span>
                  </span>
                  <span className={styles.recordStat}>
                    <span className={styles.recordStatValue}>{formatTime(r.timeElapsed)}</span>
                  </span>
                </div>
              </div>
              {r.mode === 'battle' && r.rank && (
                <span className={`${styles.rankBadge} ${rankClass(r.rank)}`}>
                  {rankText(r.rank, r.playerCount ?? 0)}
                </span>
              )}
              <span className={styles.recordTime}>{formatDate(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
