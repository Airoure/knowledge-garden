import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import {
  OPERATION_LIST,
  getDifficultyOptions,
  shouldShowDifficulty,
  hasDirection,
  DIRECTION_OPTIONS,
  COUNT_OPTIONS,
} from '@/utils/questionGenerator'
import type { BattleConfig, Operation, Difficulty, QuestionDirection } from '@/types'
import styles from './BattleLobby.module.css'

interface BattleLobbyProps {
  onCreateRoom: (name: string, config: BattleConfig) => void
  onJoinRoom: (roomId: string, name: string) => void
  onBack: () => void
  error: string | null
  onClearError: () => void
  /** 默认昵称（登录用户名） */
  defaultName?: string
}

/**
 * 对战大厅
 *
 * 两种入口：创建房间 / 加入房间
 * 创建房间时可配置运算类型、难度、题量
 */
export function BattleLobby({ onCreateRoom, onJoinRoom, onBack, error, onClearError, defaultName }: BattleLobbyProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create')

  // 创建房间的表单状态
  const [name, setName] = useState(defaultName ?? '')
  const [operations, setOperations] = useState<Operation[]>(['add', 'sub', 'mul', 'div'])
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [direction, setDirection] = useState<QuestionDirection>('forward')
  const [totalCount, setTotalCount] = useState(20)

  // 加入房间的表单状态
  const [joinName, setJoinName] = useState(defaultName ?? '')
  const [roomCode, setRoomCode] = useState('')

  const toggleOperation = (op: Operation) => {
    const isSelected = operations.includes(op)
    if (isSelected && operations.length === 1) return
    setOperations(isSelected ? operations.filter((o) => o !== op) : [...operations, op])
  }

  const handleCreate = () => {
    if (!name.trim()) return
    onCreateRoom(name.trim(), { operations, difficulty, direction, totalCount })
  }

  const handleJoin = () => {
    if (!joinName.trim() || !roomCode.trim()) return
    onJoinRoom(roomCode.trim().toUpperCase(), joinName.trim())
  }

  return (
    <Card className={styles.lobby}>
      {/* 返回按钮 */}
      <button className={styles.backBtn} onClick={onBack} type="button">
        ← 返回
      </button>

      <h2 className={styles.title}>对战模式</h2>
      <p className={styles.desc}>与好友同台竞技，先答完者胜</p>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorBar} onClick={onClearError}>
          {error} ✕
        </div>
      )}

      {/* Tab 切换 */}
      <div className={styles.tabToggle}>
        <button
          className={`${styles.tabBtn} ${tab === 'create' ? styles.tabActive : ''}`}
          onClick={() => setTab('create')}
          type="button"
        >
          创建房间
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'join' ? styles.tabActive : ''}`}
          onClick={() => setTab('join')}
          type="button"
        >
          加入房间
        </button>
      </div>

      {tab === 'create' ? (
        <>
          {/* 昵称 */}
          <div className={styles.sectionLabel}>你的昵称</div>
          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入昵称"
            maxLength={10}
            autoComplete="off"
          />

          {/* 运算类型 */}
          <div className={styles.sectionLabel}>运算类型</div>
          <div className={styles.opGrid}>
            {OPERATION_LIST.map(({ op, symbol, label }) => (
              <button
                key={op}
                className={`${styles.opBtn} ${operations.includes(op) ? styles.opActive : ''}`}
                onClick={() => toggleOperation(op)}
                type="button"
              >
                <span className={styles.opSymbol}>{symbol}</span>
                <span className={styles.opLabel}>{label}</span>
              </button>
            ))}
          </div>
          {operations.includes('square') && (
            <p className={styles.opNote}>平方数固定练 11 ~ 30（20 个底数，一组练习内不重复）</p>
          )}
          {operations.includes('pct') && (
            <p className={styles.opNote}>
              百分数练《常见百分化分》1/2 ~ 1/20 共 18 个互化（不含 1/15）：
              正向答百分数，逆向答分母
            </p>
          )}

          {/* 难度（文案随所选运算变化，大九九按基数范围描述；
              平方数固定 11~30 与难度无关，只选平方数时整块隐藏） */}
          {shouldShowDifficulty(operations) && (
            <>
              <div className={styles.sectionLabel}>难度等级</div>
              <div className={styles.diffGrid}>
                {getDifficultyOptions(operations).map(({ diff, title, desc }) => (
                  <button
                    key={diff}
                    className={`${styles.diffBtn} ${difficulty === diff ? styles.diffActive : ''}`}
                    onClick={() => setDifficulty(diff)}
                    type="button"
                  >
                    <div className={styles.diffTitle}>{title}</div>
                    <div className={styles.diffDesc}>{desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 出题方向（仅平方数 / 大九九 / 百分数模块生效） */}
          {hasDirection(operations) && (
            <>
              <div className={styles.sectionLabel}>出题方向</div>
              <div className={styles.diffGrid}>
                {DIRECTION_OPTIONS.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    className={`${styles.diffBtn} ${direction === value ? styles.diffActive : ''}`}
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

          {/* 题量 */}
          <div className={styles.sectionLabel}>题目数量</div>
          <div className={styles.countOptions}>
            {COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                className={`${styles.countBtn} ${totalCount === count ? styles.countActive : ''}`}
                onClick={() => setTotalCount(count)}
                type="button"
              >
                {count}
              </button>
            ))}
          </div>

          <button
            className={styles.actionBtn}
            onClick={handleCreate}
            type="button"
            disabled={!name.trim()}
          >
            创建房间
          </button>
        </>
      ) : (
        <>
          {/* 昵称 */}
          <div className={styles.sectionLabel}>你的昵称</div>
          <input
            className={styles.nameInput}
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="输入昵称"
            maxLength={10}
            autoComplete="off"
          />

          {/* 房间号 */}
          <div className={styles.sectionLabel}>房间号</div>
          <input
            className={`${styles.nameInput} ${styles.codeInput}`}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="输入 4 位房间号"
            maxLength={4}
            autoComplete="off"
          />

          <button
            className={styles.actionBtn}
            onClick={handleJoin}
            type="button"
            disabled={!joinName.trim() || roomCode.length < 4}
          >
            加入房间
          </button>
        </>
      )}
    </Card>
  )
}
