import type { CSSProperties } from 'react'

const baseStyle: CSSProperties = {
  position: 'fixed',
  width: 120,
  height: 120,
  pointerEvents: 'none',
  opacity: 0.06,
  zIndex: 0,
}

const tlStyle: CSSProperties = { ...baseStyle, top: 20, left: 20 }
const brStyle: CSSProperties = { ...baseStyle, bottom: 20, right: 20, transform: 'rotate(180deg)' }

/**
 * 固定定位的装饰角花（左上 + 右下）
 * 纯展示组件，不接收 props
 */
export function CornerOrnaments() {
  return (
    <>
      <svg
        style={tlStyle}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M10 10 L10 50 M10 10 L50 10 M10 10 L40 40" stroke="#1a1612" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="4" fill="#c8392b" />
        <path d="M20 20 Q35 25 30 40 Q45 35 40 50" stroke="#1a1612" strokeWidth="1" fill="none" />
      </svg>
      <svg
        style={brStyle}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M10 10 L10 50 M10 10 L50 10 M10 10 L40 40" stroke="#1a1612" strokeWidth="1.5" />
        <circle cx="10" cy="10" r="4" fill="#c8392b" />
        <path d="M20 20 Q35 25 30 40 Q45 35 40 50" stroke="#1a1612" strokeWidth="1" fill="none" />
      </svg>
    </>
  )
}
