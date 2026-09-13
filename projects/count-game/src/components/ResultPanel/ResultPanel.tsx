import { Card } from '@/components/shared/Card'
import { formatTime } from '@/utils/format'
import type { PracticeResult } from '@/types'
import styles from './ResultPanel.module.css'

interface ResultPanelProps {
  result: PracticeResult
  onRetry: () => void
  onHome: () => void
}

/**
 * 结果面板
 *
 * 展示朱砂印章评级、正确率、答对题数、总用时
 */
export function ResultPanel({ result, onRetry, onHome }: ResultPanelProps) {
  const { grade, mode } = result
  const isEndless = mode === 'endless'

  return (
    <Card className={styles.resultPanel}>
      <div className={styles.seal}>{grade.symbol}</div>
      <h2 className={styles.title}>{grade.title}</h2>
      <p className={styles.subtitle}>{grade.subtitle}</p>

      <div className={styles.stats}>
        <div className={styles.statBox}>
          <div className={`${styles.statValue} ${styles.vermilion}`}>{result.accuracy}%</div>
          <div className={styles.statLabel}>正确率</div>
        </div>
        <div className={styles.statBox}>
          <div className={`${styles.statValue} ${styles.jade}`}>
            {result.correctCount}/{result.totalCount}
          </div>
          <div className={styles.statLabel}>
            {isEndless ? '答题数' : '答对题数'}
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={`${styles.statValue} ${styles.gold}`}>
            {formatTime(result.timeElapsed)}
          </div>
          <div className={styles.statLabel}>
            {isEndless ? '游戏时长' : '总用时'}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={`${styles.actionBtn} ${styles.primary}`} onClick={onRetry} type="button">
          {isEndless ? '再来一局' : '再来一组'}
        </button>
        <button className={`${styles.actionBtn} ${styles.secondary}`} onClick={onHome} type="button">
          返回设置
        </button>
      </div>
    </Card>
  )
}
