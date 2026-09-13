import { Card } from '@/components/shared/Card'
import {
  OPERATION_LIST,
  getDifficultyOptions,
  DIRECTION_OPTIONS,
  COUNT_OPTIONS,
  TIME_OPTIONS,
  BONUS_OPTIONS,
  PENALTY_OPTIONS,
} from '@/utils/questionGenerator'
import type { PracticeConfig, Operation, Difficulty, GameMode, QuestionDirection } from '@/types'
import styles from './SetupPanel.module.css'

interface SetupPanelProps {
  config: PracticeConfig
  onConfigChange: (config: PracticeConfig) => void
  onStart: () => void
  onShowHistory: () => void
  onShowGaozhao: () => void
}

/**
 * 设置面板
 *
 * 四段式配置：模式选择、运算类型（多选）、难度等级（单选）、
 * 题目数量（固定模式）或时间设置（无尽模式）
 */
export function SetupPanel({ config, onConfigChange, onStart, onShowHistory, onShowGaozhao }: SetupPanelProps) {
  const setMode = (mode: GameMode) => {
    onConfigChange({ ...config, mode })
  }

  const toggleOperation = (op: Operation) => {
    const isSelected = config.operations.includes(op)
    if (isSelected && config.operations.length === 1) return
    const operations = isSelected
      ? config.operations.filter((o) => o !== op)
      : [...config.operations, op]
    onConfigChange({ ...config, operations })
  }

  const setDifficulty = (difficulty: Difficulty) => {
    onConfigChange({ ...config, difficulty })
  }

  const setDirection = (direction: QuestionDirection) => {
    onConfigChange({ ...config, direction })
  }

  const setTotalCount = (totalCount: number) => {
    onConfigChange({ ...config, totalCount })
  }

  const setEndlessField = (field: 'initialTime' | 'correctBonus' | 'wrongPenalty', value: number) => {
    onConfigChange({
      ...config,
      endless: { ...config.endless, [field]: value },
    })
  }

  return (
    <Card className={styles.setupPanel}>
      {/* 模式选择 */}
      <div className={styles.sectionLabel}>
        练习模式
        <span className={styles.sectionNumber}>01 / MODE</span>
      </div>
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${config.mode === 'fixed' ? styles.modeActive : ''}`}
          onClick={() => setMode('fixed')}
          type="button"
        >
          固定题数
        </button>
        <button
          className={`${styles.modeBtn} ${config.mode === 'endless' ? styles.modeActive : ''}`}
          onClick={() => setMode('endless')}
          type="button"
        >
          无尽模式
        </button>
        <button
          className={`${styles.modeBtn} ${config.mode === 'battle' ? styles.modeActive : ''}`}
          onClick={() => setMode('battle')}
          type="button"
        >
          对战模式
        </button>
      </div>

      {/* 对战模式：仅显示入口按钮 */}
      {config.mode === 'battle' ? (
        <div className={styles.battleIntro}>
          <p className={styles.battleIntroText}>
            通过房间号与好友实时对战，先答完所有题目者获胜。
            答错不跳过，罚时 10 秒。
          </p>
        </div>
      ) : (
        <>

      {/* 运算类型 */}
      <div className={styles.sectionLabel}>
        运算类型
        <span className={styles.sectionNumber}>02 / OPERATION</span>
      </div>
      <div className={styles.opGrid}>
        {OPERATION_LIST.map(({ op, symbol, label }) => (
          <button
            key={op}
            className={`${styles.opBtn} ${config.operations.includes(op) ? styles.active : ''}`}
            onClick={() => toggleOperation(op)}
            type="button"
          >
            <span className={styles.opSymbol}>{symbol}</span>
            <span className={styles.opLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* 难度选择（文案随所选运算变化，平方数/大九九按基数范围描述） */}
      <div className={styles.sectionLabel}>
        难度等级
        <span className={styles.sectionNumber}>03 / DIFFICULTY</span>
      </div>
      <div className={styles.diffGrid}>
        {getDifficultyOptions(config.operations).map(({ diff, title, desc, example }) => (
          <button
            key={diff}
            className={`${styles.diffBtn} ${config.difficulty === diff ? styles.active : ''}`}
            onClick={() => setDifficulty(diff)}
            type="button"
          >
            <div className={styles.diffTitle}>{title}</div>
            <div className={styles.diffDesc}>{desc}</div>
            <div className={styles.diffExample}>{example}</div>
          </button>
        ))}
      </div>

      {/* 出题方向（仅平方数 / 大九九模块生效） */}
      {(config.operations.includes('square') || config.operations.includes('mul19')) && (
        <>
          <div className={styles.sectionLabel}>
            出题方向
            <span className={styles.sectionNumber}>04 / DIRECTION</span>
          </div>
          <div className={styles.diffGrid}>
            {DIRECTION_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                className={`${styles.diffBtn} ${config.direction === value ? styles.active : ''}`}
                onClick={() => setDirection(value)}
                type="button"
              >
                <div className={styles.diffTitle}>{label}</div>
                <div className={styles.diffDesc}>{desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 题目数量 / 无尽设置 */}
      {config.mode === 'fixed' ? (
        <>
          <div className={styles.sectionLabel}>
            题目数量
            <span className={styles.sectionNumber}>05 / COUNT</span>
          </div>
          <div className={styles.countOptions}>
            {COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                className={`${styles.countBtn} ${config.totalCount === count ? styles.countActive : ''}`}
                onClick={() => setTotalCount(count)}
                type="button"
              >
                {count}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={styles.sectionLabel}>
            时间设置
            <span className={styles.sectionNumber}>05 / ENDLESS</span>
          </div>
          <div className={styles.endlessSection}>
            <div className={styles.endlessRow}>
              <span className={styles.endlessLabel}>初始时间</span>
              <div className={styles.countOptions}>
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`${styles.countBtn} ${config.endless.initialTime === t ? styles.countActive : ''}`}
                    onClick={() => setEndlessField('initialTime', t)}
                    type="button"
                  >
                    {t}秒
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.endlessRow}>
              <span className={styles.endlessLabel}>答对加时</span>
              <div className={styles.countOptions}>
                {BONUS_OPTIONS.map((b) => (
                  <button
                    key={b}
                    className={`${styles.countBtn} ${config.endless.correctBonus === b ? styles.countActive : ''}`}
                    onClick={() => setEndlessField('correctBonus', b)}
                    type="button"
                  >
                    {b === 0 ? '不加' : `+${b}秒`}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.endlessRow}>
              <span className={styles.endlessLabel}>答错扣时</span>
              <div className={styles.countOptions}>
                {PENALTY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    className={`${styles.countBtn} ${config.endless.wrongPenalty === p ? styles.countActive : ''}`}
                    onClick={() => setEndlessField('wrongPenalty', p)}
                    type="button"
                  >
                    {p === 0 ? '不扣' : `−${p}秒`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

        </>
      )}

      <div className={styles.actionRow}>
        <button className={styles.historyBtn} onClick={onShowHistory} type="button">
          修行履历
        </button>
        <button className={styles.historyBtn} onClick={onShowGaozhao} type="button">
          高照数算
        </button>
        <button className={styles.startBtn} onClick={onStart} type="button">
          <span>{config.mode === 'battle' ? '进 入 对 战' : '开 始 修 炼'}</span>
        </button>
      </div>
    </Card>
  )
}
