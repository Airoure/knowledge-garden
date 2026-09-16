import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Keypad } from '@/components/shared/Keypad'
import { useSound } from '@/hooks/useSound'
import { formatTime, formatQuestionNumber, sanitizeDecimalInput, formatCorrectAnswer } from '@/utils/format'
import { isAnswerMatch } from '@/utils/questionGenerator'
import { Fraction, PercentNumber } from '@/components/shared/MathDisplay'
import { isTouchDevice } from '@/utils/touch'
import type { Question, AnswerStatus, GameMode } from '@/types'
import styles from './PracticePanel.module.css'
import correctSound from '../../../sound/right.wav'
import wrongSound from '../../../sound/wrong.wav'

interface PracticePanelProps {
  mode: GameMode
  currentQuestion: Question
  currentIndex: number
  totalCount: number
  totalAnswered: number
  correctCount: number
  elapsed: number
  remainingTime: number
  initialTime: number
  correctBonus: number
  wrongPenalty: number
  answerStatus: AnswerStatus
  isAnswered: boolean
  feedbackDelay: number
  onSubmit: (answer: number) => boolean
  onNext: () => void
  onQuit: () => void
}

/**
 * 练习面板
 *
 * 展示题目、接收答案输入、显示即时反馈
 * 提交后延迟自动进入下一题，也可手动跳过
 *
 * 固定模式：显示题号进度与正计时
 * 无尽模式：显示倒计时与已答题数，答对加时/答错扣时
 */
export function PracticePanel({
  mode,
  currentQuestion,
  currentIndex,
  totalCount,
  totalAnswered,
  correctCount,
  elapsed,
  remainingTime,
  initialTime,
  correctBonus,
  wrongPenalty,
  answerStatus,
  isAnswered,
  feedbackDelay,
  onSubmit,
  onNext,
  onQuit,
}: PracticePanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [isTouch] = useState(isTouchDevice)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playCorrect = useSound(correctSound)
  const playWrong = useSound(wrongSound)

  const isEndless = mode === 'endless'
  // 题目切换 key：固定模式用 currentIndex，无尽模式用 totalAnswered
  const questionKey = isEndless ? totalAnswered : currentIndex

  // 正向给数求结果（1/7 = ?%），逆向给结果求数（14.3% = 1/?）
  const reversed = currentQuestion.reversed === true
  // 百分数正向题答案带小数（如 14.3），需要小数输入
  const needDecimal = currentQuestion.op === 'pct' && !reversed

  // 题目切换时清空输入并聚焦
  useEffect(() => {
    setInputValue('')
    inputRef.current?.focus()
  }, [questionKey])

  // 答题反馈音效
  useEffect(() => {
    if (answerStatus === 'correct') {
      playCorrect()
    } else if (answerStatus === 'wrong') {
      playWrong()
    }
  }, [answerStatus, playCorrect, playWrong])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const handleSubmit = () => {
    // 已答题：手动跳过等待，立即下一题
    if (isAnswered) {
      clearTimer()
      onNext()
      return
    }

    const userAns = parseFloat(inputValue)
    if (Number.isNaN(userAns)) {
      inputRef.current?.focus()
      return
    }

    onSubmit(userAns)

    // 延迟后自动进入下一题
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      onNext()
    }, feedbackDelay)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSubmit()
    }
  }

  /**
   * 应用输入值：更新状态，并实时检测是否输入了正确答案
   *
   * 背景：去掉提交按钮后，用户输入正确答案时需要自动触发提交和跳转，
   * 避免用户每次答完还要手动点提交。
   * 设计意图：实时比对输入值与正确答案，匹配时立即提交并设置延迟跳转，
   * 与点提交按钮的效果一致。保留 Enter 提交错误答案的能力，确保答错
   * 也能被记录并显示反馈。
   * 约束：仅在未答题状态下检测，已答题后输入框禁用、键盘输入被忽略。
   * 物理键盘 onChange 与移动端内置数字键盘共用此入口。
   */
  const applyValue = (val: string) => {
    setInputValue(val)
    if (!isAnswered) {
      const userAns = parseFloat(val)
      if (!Number.isNaN(userAns) && isAnswerMatch(userAns, currentQuestion.answer)) {
        onSubmit(userAns)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          onNext()
        }, feedbackDelay)
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

  // 进度条：固定模式按题目进度，无尽模式按剩余时间占比
  const progressPercent = isEndless
    ? Math.min(100, (remainingTime / initialTime) * 100)
    : ((currentIndex + 1) / totalCount) * 100

  // 倒计时紧急状态（剩余 ≤ 10 秒）
  const isUrgent = isEndless && remainingTime <= 10

  // 反馈文案
  let feedbackText = ''
  let feedbackClass = ''
  if (answerStatus === 'correct') {
    feedbackText = '✓ 正确'
    if (isEndless && correctBonus > 0) {
      feedbackText += `  +${correctBonus}秒`
    }
    feedbackClass = `${styles.feedback} ${styles.show} ${styles.correct}`
  } else if (answerStatus === 'wrong') {
    feedbackText = `✗ 正确答案：${formatCorrectAnswer(currentQuestion)}`
    if (isEndless && wrongPenalty > 0) {
      feedbackText += `  −${wrongPenalty}秒`
    }
    feedbackClass = `${styles.feedback} ${styles.show} ${styles.wrong}`
  } else {
    feedbackClass = styles.feedback
  }

  // 输入框状态类
  const inputClass = `${styles.answerInput} ${
    answerStatus === 'correct' ? styles.inputCorrect : ''
  } ${answerStatus === 'wrong' ? styles.inputWrong : ''}`

  // 题目表达式与结果：正向给数求结果（1/7 = ?%），逆向给结果求数（14.3% = 1/?）
  const questionExpr =
    currentQuestion.op === 'square' ? (
      <span className={styles.num} key={`sq-${questionKey}`}>
        {reversed ? '?' : currentQuestion.a}
        <sup className={styles.squareExp}>2</sup>
      </span>
    ) : currentQuestion.op === 'pct' ? (
      reversed ? (
        <span className={styles.num} key={`pctr-${questionKey}`}>
          <PercentNumber>{currentQuestion.b}</PercentNumber>
        </span>
      ) : (
        <span className={styles.num} key={`pctf-${questionKey}`}>
          <Fraction numerator={currentQuestion.a} denominator={currentQuestion.b} />
        </span>
      )
    ) : reversed ? (
      <>
        <span className={styles.num} key={`q-${questionKey}`}>
          ?
        </span>
        <span className={styles.op}>{currentQuestion.symbol}</span>
        <span className={styles.num} key={`b-${questionKey}`}>
          {currentQuestion.b}
        </span>
      </>
    ) : (
      <>
        <span className={styles.num} key={`a-${questionKey}`}>
          {currentQuestion.a}
        </span>
        <span className={styles.op}>{currentQuestion.symbol}</span>
        <span className={styles.num} key={`b-${questionKey}`}>
          {currentQuestion.b}
        </span>
      </>
    )
  const questionResult = reversed ? (
    <span className={styles.num} key={`res-${questionKey}`}>
      {currentQuestion.op === 'square' ? (
        currentQuestion.b
      ) : currentQuestion.op === 'pct' ? (
        <Fraction numerator={1} denominator="?" />
      ) : (
        currentQuestion.a * currentQuestion.b
      )}
    </span>
  ) : currentQuestion.op === 'pct' ? (
    <span className={styles.num} key={`resp-${questionKey}`}>
      <PercentNumber>?</PercentNumber>
    </span>
  ) : (
    <span className={styles.num}>?</span>
  )

  return (
    <Card className={styles.practicePanel}>
      {/* 进度条 */}
      <div className={styles.progressBar}>
        <div
          className={`${styles.progressFill} ${isUrgent ? styles.progressUrgent : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 状态栏 */}
      <div className={styles.statusBar}>
        {isEndless ? (
          <>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>剩余</span>
              <span
                className={`${styles.statusValue} ${isUrgent ? styles.urgent : ''}`}
              >
                {remainingTime}s
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>已答</span>
              <span className={styles.statusValue}>{totalAnswered}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>正确</span>
              <span className={`${styles.statusValue} ${styles.jade}`}>
                {correctCount}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>进度</span>
              <span className={styles.statusValue}>
                {currentIndex + 1}/{totalCount}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>正确</span>
              <span className={`${styles.statusValue} ${styles.jade}`}>
                {correctCount}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>用时</span>
              <span className={styles.statusValue}>{formatTime(elapsed)}</span>
            </div>
          </>
        )}
      </div>

      {/* 题目区 */}
      <div className={styles.questionArea}>
        <div className={styles.questionNumber}>
          {isEndless
            ? `第 ${totalAnswered + 1} 题`
            : formatQuestionNumber(currentIndex)}
        </div>
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
          showDecimal={needDecimal}
        />
      )}

      {/* 反馈 */}
      <div className={feedbackClass}>{feedbackText}</div>

      {/* 退出 */}
      <button className={styles.quitBtn} onClick={onQuit} type="button">
        — 退出练习 —
      </button>
    </Card>
  )
}
