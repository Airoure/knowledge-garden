import type { ReactNode } from 'react'
import styles from './MathDisplay.module.css'

interface FractionProps {
  numerator: ReactNode
  denominator: ReactNode
}

/**
 * 竖式分数（分子 / 横线 / 分母），用于百分数题型的题目展示
 *
 * 注意：根元素自带 inline-flex 布局，外层不要并入其它 display 类
 * （会按 CSS 打包顺序互相覆盖，导致分数塌成一行），需要动画/间距时
 * 在外面再包一层 span。
 */
export function Fraction({ numerator, denominator }: FractionProps) {
  return (
    <span className={styles.frac}>
      <span className={styles.fracPart}>{numerator}</span>
      <span className={styles.fracBar} />
      <span className={styles.fracPart}>{denominator}</span>
    </span>
  )
}

interface PercentNumberProps {
  children: ReactNode
}

/**
 * 带小号 % 的数值展示（如 14.3%、?%）
 */
export function PercentNumber({ children }: PercentNumberProps) {
  return (
    <span className={styles.percentNumber}>
      {children}
      <span className={styles.percentSign}>%</span>
    </span>
  )
}
