import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Keypad } from '@/components/shared/Keypad'
import { useSound } from '@/hooks/useSound'
import { formatTime, sanitizeDecimalInput, formatCorrectAnswer } from '@/utils/format'
import { isAnswerMatch } from '@/utils/questionGenerator'
import { Fraction, PercentNumber } from '@/components/shared/MathDisplay'
import { isTouchDevice } from '@/utils/touch'
import type { Question, AnswerStatus, OpponentProgress } from '@/types'
import { BATTLE_WRONG_PENALTY } from '@/types'
import styles from './BattlePracticePanel.module.css'
import correctSound from '../../../sound/right.wav'
import wrongSound from '../../../sound/wrong.wav'

interface BattlePracticePanelProps {
  question: Question
  currentIndex: number
  totalCount: number
  correctCount: number
  wrongCount: number
  answerStatus: AnswerStatus
  startTime: number
  opponents: OpponentProgress[]
  onSubmit: (answer: number) => void
  onQuit: () => void
}

/**
 * 对战练习面板
 *
 * 与单人练习的区别：
 * - 答错不跳过，需重新作答
 * - 答错罚时 +10 秒
 * - 实时显示对手进度
 */
export function BattlePracticePanel({
  question,
  currentIndex,
  totalCount,
  correctCount,
  wrongCount,
  answerStatus,
  startTime,
  opponents,
  onSubmit,
  onQuit,
}: BattlePracticePanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [isTouch] = useState(isTouchDevice)
  const inputRef = useRef<HTMLInputElement>(null)
  const playCorrect = useSound(correctSound)
  const playWrong = useSound(wrongSound)

  // 正向给数求结果（1/7 = ?%），逆向给结果求数（14.3% = 1/?）
  const reversed = question.reversed === true
  // 百分数正向题答案带小数（如 14.3），需要小数输入
  const needDecimal = question.op === 'pct' && !reversed

  // 正计时（每秒更新）
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  // 答题反馈音效
  useEffect(() => {
    if (answerStatus === 'correct') {
      playCorrect()
    } else if (answerStatus === 'wrong') {
      playWrong()
    }
  }, [answerStatus, playCorrect, playWrong])

  // 题目切换时清空输入并聚焦
  useEffect(() => {
    setInputValue('')
    inputRef.current?.focus()
  }, [currentIndex])

  const isAnswered = answerStatus !== 'idle'

  const handleSubmit = () => {
    if (isAnswered) return
    const userAns = parseFloat(inputValue)
    if (Number.isNaN(userAns)) {
      inputRef.current?.focus()
      return
    }
    onSubmit(userAns)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSubmit()
    }
  }

  /**
   * 应用输入值：更新状态，并实时检测是否输入了正确答案
   *
   * 背景：去掉提交按钮后，用户输入正确答案时需要自动触发提交和跳转。
   * 设计意图：实时比对输入值与正确答案，匹配时立即通过 Socket 提交，
   * 服务端判定答对后客户端自动跳转。保留 Enter 提交错误答案的能力，
   * 确保答错也能被记录并触发罚时。
   * 约束：仅在未答题状态下检测；已答题后输入框禁用、键盘输入被忽略。
   * 物理键盘 onChange 与移动端内置数字键盘共用此入口。
   * 与练习模式的区别：对战模式答错不跳转，需重答。
   */
  const applyValue = (val: string) => {
    setInputValue(val)
    if (!isAnswered) {
      const userAns = parseFloat(val)
      if (!Number.isNaN(userAns) && isAnswerMatch(userAns, question.answer)) {
        onSubmit(userAns)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyValue(needDecimal ? sanitizeDecimalInput(e.target.value) : e.target.value)
  }

  // ===== 移动端内置数字键盘 =====
  const handleDigit = (digit: string) => {
    if (isAnswered) return
    // 小数点只能有一个
    if (digit === '.' && inputValue.includes('.')) return
    const next = inputValue + digit
    if (next.length > 6) return
    applyValue(next)
  }

  const handleBackspace = () => {
    if (isAnswered) return
    applyValue(inputValue.slice(0, -1))
  }

  const handleClear = () => {
    if (isAnswered) return
    applyValue('')
  }

  // 进度条
  const progressPercent = ((currentIndex) / totalCount) * 100

  // 有效时间（含罚时）
  const effectiveTime = elapsed + wrongCount * BATTLE_WRONG_PENALTY

  // 反馈文案
  let feedbackText = ''
  let feedbackClass = styles.feedback
  if (answerStatus === 'correct') {
    feedbackText = '✓ 正确'
    feedbackClass = `${styles.feedback} ${styles.show} ${styles.correct}`
  } else if (answerStatus === 'wrong') {
    feedbackText = `✗ 错误 +${BATTLE_WRONG_PENALTY}秒 罚时（正确答案：${formatCorrectAnswer(question)}）`
    feedbackClass = `${styles.feedback} ${styles.show} ${styles.wrong}`
  }

  // 输入框状态
  const inputClass = `${styles.answerInput} ${
    answerStatus === 'correct' ? styles.inputCorrect : ''
  } ${answerStatus === 'wrong' ? styles.inputWrong : ''}`

  // 题目表达式与结果：正向给数求结果（1/7 = ?%），逆向给结果求数（14.3% = 1/?）
  const questionExpr =
    question.op === 'square' ? (
      <span className={styles.num}>
        {reversed ? '?' : question.a}
        <sup className={styles.squareExp}>2</sup>
      </span>
    ) : question.op === 'pct' ? (
      reversed ? (
        <PercentNumber className={styles.num}>{question.b}</PercentNumber>
      ) : (
        <Fraction
          className={styles.num}
          numerator={question.a}
          denominator={question.b}
        />
      )
    ) : reversed ? (
      <>
        <span className={styles.num}>?</span>
        <span className={styles.op}>{question.symbol}</span>
        <span className={styles.num}>{question.b}</span>
      </>
    ) : (
      <>
        <span className={styles.num}>{question.a}</span>
        <span className={styles.op}>{question.symbol}</span>
        <span className={styles.num}>{question.b}</span>
      </>
    )
  const questionResult = reversed ? (
    <span className={styles.num}>
      {question.op === 'square' ? (
        question.b
      ) : question.op === 'pct' ? (
        <Fraction numerator={1} denominator="?" />
      ) : (
        question.a * question.b
      )}
    </span>
  ) : question.op === 'pct' ? (
    <PercentNumber className={styles.num}>?</PercentNumber>
  ) : (
    <span className={styles.num}>?</span>
  )

  return (
    <Card className={styles.battlePanel}>
      {/* 顶部状态栏 */}
      <div className={styles.topBar}>
        <div className={styles.myStatus}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>进度</span>
            <span className={styles.statusValue}>
              {currentIndex + 1}/{totalCount}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>正确</span>
            <span className={`${styles.statusValue} ${styles.jadeColor}`}>{correctCount}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>用时</span>
            <span className={styles.statusValue}>{formatTime(effectiveTime)}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>错误</span>
            <span className={`${styles.statusValue} ${styles.wrongColor}`}>{wrongCount}</span>
          </div>
        </div>
        <button className={styles.quitBtn} onClick={onQuit} type="button">
          退出
        </button>
      </div>

      {/* 进度条 */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>

      {/* 对手进度 */}
      <div className={styles.opponentsArea}>
        {opponents.map((opp) => {
          const oppProgress = (opp.currentIndex / totalCount) * 100
          const oppFinished = opp.finished
          return (
            <div key={opp.playerId} className={styles.oppCard}>
              <div className={styles.oppHeader}>
                <span className={styles.oppName}>{opp.name}</span>
                {oppFinished ? (
                  <span className={styles.oppFinished}>已完成</span>
                ) : (
                  <span className={styles.oppProgress}>
                    第 {opp.currentIndex + 1} 题
                  </span>
                )}
              </div>
              <div className={styles.oppBar}>
                <div
                  className={`${styles.oppBarFill} ${oppFinished ? styles.oppBarDone : ''}`}
                  style={{ width: `${oppProgress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 题目区 */}
      <div className={styles.questionArea}>
        <div className={styles.questionNumber}>第 {currentIndex + 1} 题</div>
        <div className={styles.questionDisplay}>
          {questionExpr}
          <span className={styles.equals}>=</span>
          {questionResult}
        </div>
      </div>

      {/* 答案输入 */}
      <div className={styles.answerRow}>
        <input
          ref={inputRef}
          type={needDecimal ? 'text' : 'number'}
          className={inputClass}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isTouch ? '点下方键盘输入' : '输入答案'}
          autoComplete="off"
          disabled={isAnswered}
          inputMode={isTouch ? 'none' : needDecimal ? 'decimal' : undefined}
          readOnly={isTouch}
        />
      </div>

      {/* 触屏设备：内置数字键盘代替系统键盘，
          避免键盘反复弹出/收起后无法唤起，且不遮挡题目 */}
      {isTouch && (
        <Keypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onConfirm={handleSubmit}
          confirmDisabled={isAnswered}
          showDecimal={needDecimal}
        />
      )}

      {/* 反馈 */}
      <div className={feedbackClass}>{feedbackText}</div>
    </Card>
  )
}
