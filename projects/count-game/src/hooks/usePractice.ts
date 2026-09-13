import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GameMode,
  PracticeConfig,
  Question,
  AnswerStatus,
  PracticeResult,
} from '@/types'
import {
  generateQuestions,
  generateSingleQuestion,
  buildPracticeResult,
} from '@/utils/questionGenerator'
import { useTimer } from './useTimer'
import { useCountdown } from './useCountdown'

/** 提交答案后的反馈延迟（毫秒） */
const FEEDBACK_DELAY = 700

/**
 * 练习流程核心 Hook（支持固定模式与无尽模式）
 *
 * 固定模式：预生成题目序列，正计时，答完所有题后汇总结果
 * 无尽模式：逐题生成，倒计时，答对加时/答错扣时，时间归零后汇总结果
 */
export function usePractice() {
  // ===== 共享状态 =====
  const [mode, setMode] = useState<GameMode>('fixed')
  const [correctCount, setCorrectCount] = useState(0)
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [isActive, setIsActive] = useState(false)

  // ===== 固定模式状态 =====
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  // ===== 无尽模式状态 =====
  const [endlessQuestion, setEndlessQuestion] = useState<Question | null>(null)
  const [totalAnswered, setTotalAnswered] = useState(0)

  // ===== 计时器 =====
  const countUpTimer = useTimer()
  const countdown = useCountdown()

  // ===== Refs（解决闭包陈旧值问题） =====
  const configRef = useRef<PracticeConfig | null>(null)
  const isFinishedRef = useRef(false)
  const startTimeRef = useRef(0)
  const lastQuestionRef = useRef<Question | null>(null)
  const correctCountRef = useRef(0)
  const totalAnsweredRef = useRef(0)
  const answerStatusRef = useRef<AnswerStatus>('idle')

  // 同步 ref
  useEffect(() => { correctCountRef.current = correctCount }, [correctCount])
  useEffect(() => { totalAnsweredRef.current = totalAnswered }, [totalAnswered])
  useEffect(() => { answerStatusRef.current = answerStatus }, [answerStatus])

  // ===== 派生状态 =====
  const currentQuestion =
    mode === 'fixed' ? questions[currentIndex] ?? null : endlessQuestion
  const isAnswered = answerStatus !== 'idle'

  // ===== 开始练习 =====
  const start = useCallback(
    (config: PracticeConfig) => {
      configRef.current = config
      setMode(config.mode)
      isFinishedRef.current = false
      setCorrectCount(0)
      correctCountRef.current = 0
      setAnswerStatus('idle')
      answerStatusRef.current = 'idle'
      setResult(null)
      setIsActive(true)
      startTimeRef.current = Date.now()

      if (config.mode === 'fixed') {
        const qs = generateQuestions(config)
        setQuestions(qs)
        setCurrentIndex(0)
        setTotalAnswered(0)
        totalAnsweredRef.current = 0
        lastQuestionRef.current = null
        countUpTimer.start()
      } else {
        const q = generateSingleQuestion(config, null)
        setEndlessQuestion(q)
        lastQuestionRef.current = q
        setTotalAnswered(0)
        totalAnsweredRef.current = 0
        countdown.start(config.endless.initialTime)
      }
    },
    [countUpTimer, countdown],
  )

  // ===== 提交答案 =====
  const submitAnswer = useCallback(
    (userAnswer: number): boolean => {
      if (!currentQuestion || isAnswered) return false

      const isCorrect = userAnswer === currentQuestion.answer
      if (isCorrect) {
        setCorrectCount((c) => c + 1)
        correctCountRef.current += 1
        setAnswerStatus('correct')
        answerStatusRef.current = 'correct'

        // 无尽模式：答对加时
        if (mode === 'endless' && configRef.current) {
          const bonus = configRef.current.endless.correctBonus
          if (bonus > 0) countdown.adjust(bonus)
        }
      } else {
        setAnswerStatus('wrong')
        answerStatusRef.current = 'wrong'

        // 无尽模式：答错扣时
        if (mode === 'endless' && configRef.current) {
          const penalty = configRef.current.endless.wrongPenalty
          if (penalty > 0) countdown.adjust(-penalty)
        }
      }
      return isCorrect
    },
    [currentQuestion, isAnswered, mode, countdown],
  )

  // ===== 进入下一题 =====
  const next = useCallback(() => {
    if (isFinishedRef.current) return

    if (mode === 'fixed') {
      const nextIndex = currentIndex + 1
      if (nextIndex >= questions.length) {
        // 固定模式结束
        countUpTimer.stop()
        const totalElapsed = countUpTimer.elapsed
        const practiceResult = buildPracticeResult(
          'fixed',
          correctCountRef.current,
          questions.length,
          totalElapsed,
        )
        setResult(practiceResult)
        isFinishedRef.current = true
        setIsActive(false)
      } else {
        setCurrentIndex(nextIndex)
        setAnswerStatus('idle')
        answerStatusRef.current = 'idle'
      }
    } else {
      // 无尽模式：生成新题
      setTotalAnswered((a) => {
        const newVal = a + 1
        totalAnsweredRef.current = newVal
        return newVal
      })
      const config = configRef.current!
      const q = generateSingleQuestion(config, lastQuestionRef.current)
      setEndlessQuestion(q)
      lastQuestionRef.current = q
      setAnswerStatus('idle')
      answerStatusRef.current = 'idle'
    }
  }, [mode, currentIndex, questions.length, countUpTimer])

  // ===== 监听倒计时归零（无尽模式结束） =====
  useEffect(() => {
    if (
      mode === 'endless' &&
      isActive &&
      !countdown.isRunning &&
      countdown.remaining === 0
    ) {
      const timePlayed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      // 当前题若已作答但尚未计入 totalAnswered（在反馈延迟期间时间归零）
      const currentAnswered =
        totalAnsweredRef.current + (answerStatusRef.current !== 'idle' ? 1 : 0)
      const practiceResult = buildPracticeResult(
        'endless',
        correctCountRef.current,
        currentAnswered,
        timePlayed,
      )
      setResult(practiceResult)
      isFinishedRef.current = true
      setIsActive(false)
    }
  }, [mode, isActive, countdown.isRunning, countdown.remaining])

  // ===== 退出练习 =====
  const quit = useCallback(() => {
    countUpTimer.reset()
    countdown.reset()
    isFinishedRef.current = true
    setQuestions([])
    setCurrentIndex(0)
    setEndlessQuestion(null)
    setTotalAnswered(0)
    totalAnsweredRef.current = 0
    setCorrectCount(0)
    correctCountRef.current = 0
    setAnswerStatus('idle')
    answerStatusRef.current = 'idle'
    setResult(null)
    setIsActive(false)
  }, [countUpTimer, countdown])

  return {
    // 模式
    mode,
    // 状态
    questions,
    currentIndex,
    currentQuestion,
    totalCount: questions.length,
    totalAnswered,
    correctCount,
    answerStatus,
    isAnswered,
    isActive,
    result,
    elapsed: countUpTimer.elapsed,
    remainingTime: countdown.remaining,
    // 操作
    start,
    submitAnswer,
    next,
    quit,
    FEEDBACK_DELAY,
  }
}
