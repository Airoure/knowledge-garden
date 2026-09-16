import type { ReactNode } from 'react'
import styles from './MathDisplay.module.css'

interface FractionProps {
  numerator: ReactNode
  denominator: ReactNode
  /** 附加到根元素的类名（如题目区的 .num 动画类） */
  className?: string
}

/**
 * 竖式分数（分子 / 横线 / 分母），用于百分数题型的题目展示
 */
export function Fraction({ numerator, denominator, className }: FractionProps) {
  return (
    <span className={`${styles.frac} ${className ?? ''}`}>
      <span className={styles.fracPart}>{numerator}</span>
      <span className={styles.fracBar} />
      <span className={styles.fracPart}>{denominator}</span>
    </span>
  )
}

interface PercentNumberProps {
  children: ReactNode
  /** 附加到根元素的类名（如题目区的 .num 动画类） */
  className?: string
}

/**
 * 带小号 % 的数值展示（如 14.3%、?%）
 */
export function PercentNumber({ children, className }: PercentNumberProps) {
  return (
    <span className={`${styles.percentNumber} ${className ?? ''}`}>
      {children}
      <span className={styles.percentSign}>%</span>
    </span>
  )
}
