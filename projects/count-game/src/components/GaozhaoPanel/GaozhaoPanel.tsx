import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { Keypad } from '@/components/shared/Keypad'
import { useGaozhao } from '@/hooks/useGaozhao'
import { useTimer } from '@/hooks/useTimer'
import { useSound } from '@/hooks/useSound'
import { parseQuestionStrings } from '@/utils/worksheetParser'
import { calculateGrade } from '@/utils/questionGenerator'
import { formatTime, formatQuestionNumber } from '@/utils/format'
import { isTouchDevice } from '@/utils/touch'
import type { Question, AnswerStatus, PracticeResult } from '@/types'
import type { Worksheet } from '@/services/worksheet'
import styles from './GaozhaoPanel.module.css'
import correctSound from '../../../sound/right.wav'
import wrongSound from '../../../sound/wrong.wav'

/** 提交答案后的反馈延迟（毫秒） */
const FEEDBACK_DELAY = 700

interface GaozhaoPanelProps {
  onBack: () => void
}

type View = 'list' | 'practice' | 'result'

/**
 * 高照数算面板
 *
 * 三视图状态：
 * - list：题库列表与打卡统计
 * - practice：基于解析题目的练习
 * - result：练习结果与自动打卡
 *
 * 题库通过命令行脚本 tools/import_worksheet.py 导入，
 * 前端只负责浏览、做题和打卡。
 */
export function GaozhaoPanel({ onBack }: GaozhaoPanelProps) {
  const {
    worksheets,
    checkins,
    checkInStats,
    loading,
    deleteWorksheet,
    saveCheckIn,
    getTodayString,
  } = useGaozhao()

  const [view, setView] = useState<View>('list')
  const [selectedWorksheet, setSelectedWorksheet] = useState<Worksheet | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [inputValue, setInputValue] = useState('')
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [isTouch] = useState(isTouchDevice)

  const timer = useTimer()
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkInSavedRef = useRef(false)
  const startTimeRef = useRef(0)
  const correctCountRef = useRef(0)
  const playCorrect = useSound(correctSound)
  const playWrong = useSound(wrongSound)

  // 同步 correctCount 到 ref（供异步回调读取最新值）
  useEffect(() => {
    correctCountRef.current = correctCount
  }, [correctCount])

  // 已打卡的 worksheetId 集合
  const checkedInIds = new Set(checkins.map((c) => c.worksheetId))

  // 组件卸载时清理定时器与计时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timer.stop()
    }
  }, [timer])

  // 题目切换时清空输入并聚焦
  useEffect(() => {
    if (view === 'practice') {
      setInputValue('')
      inputRef.current?.focus()
    }
  }, [currentIndex, view])

  // 答题反馈音效
  useEffect(() => {
    if (answerStatus === 'correct') playCorrect()
    else if (answerStatus === 'wrong') playWrong()
  }, [answerStatus, playCorrect, playWrong])

  // 结果视图：自动保存打卡
  useEffect(() => {
    if (view !== 'result' || !result || !selectedWorksheet || checkInSavedRef.current) return
    checkInSavedRef.current = true
    saveCheckIn({
      date: getTodayString(),
      worksheetId: selectedWorksheet.id,
      worksheetTitle: selectedWorksheet.title,
      correctCount: result.correctCount,
      totalCount: result.totalCount,
      accuracy: result.accuracy,
      timeElapsed: result.timeElapsed,
    }).catch(() => {
      // 静默失败
    })
  }, [view, result, selectedWorksheet, saveCheckIn, getTodayString])

  /** 开始练习 */
  const startPractice = (worksheet: Worksheet) => {
    const parsed = parseQuestionStrings(worksheet.questions)
    if (parsed.length === 0) return
    setSelectedWorksheet(worksheet)
    setQuestions(parsed)
    setCurrentIndex(0)
    setCorrectCount(0)
    correctCountRef.current = 0
    setAnswerStatus('idle')
    setInputValue('')
    setResult(null)
    checkInSavedRef.current = false
    setView('practice')
    startTimeRef.current = Date.now()
    timer.start()
  }

  /** 进入下一题或结束练习 */
  const advance = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex >= questions.length) {
      // 练习结束
      timer.stop()
      const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const correct = correctCountRef.current
      const total = questions.length
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      setResult({
        mode: 'fixed',
        correctCount: correct,
        totalCount: total,
        accuracy,
        timeElapsed: totalElapsed,
        grade: calculateGrade(accuracy),
      })
      setView('result')
    } else {
      setCurrentIndex(nextIndex)
      setAnswerStatus('idle')
    }
  }

  /** 提交答案 / 手动进入下一题 */
  const handleSubmit = () => {
    // 已答题：手动跳过等待，立即下一题
    if (answerStatus !== 'idle') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      advance()
      return
    }

    const userAns = parseInt(inputValue, 10)
    if (Number.isNaN(userAns)) {
      inputRef.current?.focus()
      return
    }

    const currentQ = questions[currentIndex]
    const isCorrect = userAns === currentQ.answer
    if (isCorrect) {
      setCorrectCount((c) => c + 1)
      correctCountRef.current += 1
      setAnswerStatus('correct')
    } else {
      setAnswerStatus('wrong')
    }

    // 延迟后自动进入下一题
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      advance()
    }, FEEDBACK_DELAY)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit()
  }

  /**
   * 应用输入值：更新状态，并实时检测是否输入了正确答案
   *
   * 背景：去掉提交按钮后，用户输入正确答案时需要自动触发提交和跳转。
   * 设计意图：实时比对输入值与正确答案，匹配时立即提交并设置延迟跳转，
   * 与点提交按钮的效果一致。保留 Enter 提交错误答案的能力，确保答错
   * 也能被记录并显示正确答案。
   * 约束：仅在未答题状态下检测，已答题后输入框禁用、键盘输入被忽略。
   * 物理键盘 onChange 与移动端内置数字键盘共用此入口。
   */
  const applyValue = (val: string) => {
    setInputValue(val)
    if (answerStatus === 'idle') {
      const userAns = parseInt(val, 10)
      if (!Number.isNaN(userAns) && questions[currentIndex]?.answer === userAns) {
        setCorrectCount((c) => c + 1)
        correctCountRef.current += 1
        setAnswerStatus('correct')
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          advance()
        }, FEEDBACK_DELAY)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyValue(e.target.value)
  }

  // ===== 移动端内置数字键盘 =====
  const handleDigit = (digit: string) => {
    if (answerStatus !== 'idle') return
    const next = inputValue + digit
    if (next.length > 6) return
    applyValue(next)
  }

  const handleBackspace = () => {
    if (answerStatus !== 'idle') return
    applyValue(inputValue.slice(0, -1))
  }

  const handleClear = () => {
    if (answerStatus !== 'idle') return
    applyValue('')
  }

  /** 退出练习，返回列表 */
  const handleExit = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    timer.stop()
    timer.reset()
    setView('list')
    setSelectedWorksheet(null)
    setQuestions([])
    setCurrentIndex(0)
    setCorrectCount(0)
    correctCountRef.current = 0
    setAnswerStatus('idle')
    setInputValue('')
    setResult(null)
  }

  /** 删除题库（阻止冒泡以免触发进入练习） */
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteWorksheet(id)
  }

  // 题库按日期倒序
  const sortedWorksheets = [...worksheets].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.createdAt - a.createdAt
  })

  // ===== list 视图 =====
  if (view === 'list') {
    return (
      <div className={styles.panel}>
        <button className={styles.backBtn} onClick={onBack} type="button">
          ← 返回
        </button>
        <h2 className={styles.title}>高 照 数 算</h2>
        <p className={styles.desc}>GAOZHAO · 每日数算修行</p>

        {/* 打卡统计 */}
        {checkInStats && (
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <div className={`${styles.statValue} ${styles.vermilion}`}>
                {checkInStats.streak}
              </div>
              <div className={styles.statLabel}>连续打卡</div>
            </div>
            <div className={styles.statBox}>
              <div className={`${styles.statValue} ${styles.jade}`}>
                {checkInStats.totalCheckins}
              </div>
              <div className={styles.statLabel}>总打卡次数</div>
            </div>
          </div>
        )}

        {/* 题库列表 */}
        <div className={styles.sectionLabel}>题库列表</div>
        {loading ? (
          <div className={styles.empty}>载入中…</div>
        ) : sortedWorksheets.length === 0 ? (
          <div className={styles.empty}>尚无题库，请先导入题目</div>
        ) : (
          <div className={styles.worksheetList}>
            {sortedWorksheets.map((w) => {
              const checkedIn = checkedInIds.has(w.id)
              return (
                <div
                  key={w.id}
                  className={styles.worksheetItem}
                  onClick={() => startPractice(w)}
                >
                  <span className={`${styles.checkTag} ${checkedIn ? styles.checked : styles.unchecked}`}>
                    {checkedIn ? '已打卡' : '未打卡'}
                  </span>
                  <div className={styles.worksheetBody}>
                    <span className={styles.worksheetDate}>{w.date}</span>
                    <span className={styles.worksheetTitle}>{w.title}</span>
                    <span className={styles.worksheetCount}>{w.questions.length} 题</span>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, w.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ===== practice 视图 =====
  if (view === 'practice' && questions.length > 0) {
    const currentQuestion = questions[currentIndex]
    const progressPercent = ((currentIndex + 1) / questions.length) * 100
    const isAnswered = answerStatus !== 'idle'

    let feedbackText = ''
    let feedbackClass = styles.feedback
    if (answerStatus === 'correct') {
      feedbackText = '✓ 正确'
      feedbackClass = `${styles.feedback} ${styles.show} ${styles.correct}`
    } else if (answerStatus === 'wrong') {
      feedbackText = `✗ 正确答案：${currentQuestion.answer}`
      feedbackClass = `${styles.feedback} ${styles.show} ${styles.wrong}`
    }

    const inputClass = `${styles.answerInput} ${
      answerStatus === 'correct' ? styles.inputCorrect : ''
    } ${answerStatus === 'wrong' ? styles.inputWrong : ''}`

    return (
      <Card className={styles.practicePanel}>
        {/* 进度条 */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* 状态栏 */}
        <div className={styles.statusBar}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>进度</span>
            <span className={styles.statusValue}>
              {currentIndex + 1}/{questions.length}
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
            <span className={styles.statusValue}>{formatTime(timer.elapsed)}</span>
          </div>
        </div>

        {/* 题目区 */}
        <div className={styles.questionArea}>
          <div className={styles.questionNumber}>
            {formatQuestionNumber(currentIndex)}
          </div>
          <div className={styles.questionDisplay}>
            <span className={styles.num} key={`a-${currentIndex}`}>
              {currentQuestion.a}
            </span>
            <span className={styles.op}>{currentQuestion.symbol}</span>
            <span className={styles.num} key={`b-${currentIndex}`}>
              {currentQuestion.b}
            </span>
            <span className={styles.equals}>=</span>
            <span className={styles.num}>?</span>
          </div>
        </div>

        {/* 答案输入 */}
        <div className={styles.answerRow}>
          <input
            ref={inputRef}
            type="number"
            className={inputClass}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isTouch ? '点下方键盘输入' : '输入答案'}
            autoComplete="off"
            disabled={isAnswered}
            inputMode={isTouch ? 'none' : undefined}
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
          />
        )}

        {/* 反馈 */}
        <div className={feedbackClass}>{feedbackText}</div>

        {/* 退出 */}
        <button className={styles.quitBtn} onClick={handleExit} type="button">
          — 退出练习 —
        </button>
      </Card>
    )
  }

  // ===== result 视图 =====
  if (view === 'result' && result) {
    return (
      <Card className={styles.resultPanel}>
        <div className={styles.seal}>{result.grade.symbol}</div>
        <h2 className={styles.resultTitle}>{result.grade.title}</h2>
        <p className={styles.resultSubtitle}>{result.grade.subtitle}</p>

        <div className={styles.resultStats}>
          <div className={styles.resultStatBox}>
            <div className={`${styles.resultStatValue} ${styles.vermilion}`}>
              {result.accuracy}%
            </div>
            <div className={styles.resultStatLabel}>正确率</div>
          </div>
          <div className={styles.resultStatBox}>
            <div className={`${styles.resultStatValue} ${styles.jade}`}>
              {result.correctCount}/{result.totalCount}
            </div>
            <div className={styles.resultStatLabel}>答对题数</div>
          </div>
          <div className={styles.resultStatBox}>
            <div className={`${styles.resultStatValue} ${styles.gold}`}>
              {formatTime(result.timeElapsed)}
            </div>
            <div className={styles.resultStatLabel}>总用时</div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.primary}`}
            onClick={handleExit}
            type="button"
          >
            返回列表
          </button>
        </div>
      </Card>
    )
  }

  // 兜底
  return (
    <div className={styles.panel}>
      <button className={styles.backBtn} onClick={onBack} type="button">
        ← 返回
      </button>
    </div>
  )
}
