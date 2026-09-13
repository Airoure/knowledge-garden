import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  className?: string
}

/** 通用卡片容器，顶部带朱砂-金-翠玉渐变条 */
export function Card({ children, className }: CardProps) {
  const cls = className ? `${styles.card} ${className}` : styles.card
  return <section className={cls}>{children}</section>
}
