import styles from './Keypad.module.css'

interface KeypadProps {
  /** 按下数字键 0-9 */
  onDigit: (digit: string) => void
  /** 退格删除一位 */
  onBackspace: () => void
  /** 清空全部输入 */
  onClear: () => void
  /** 确定（提交答案 / 答题等待期跳过） */
  onConfirm: () => void
  /** 确定键是否禁用（如已答题且无跳过语义时） */
  confirmDisabled?: boolean
}

/**
 * 内置数字键盘（触屏设备专用）
 *
 * 背景：手机上依赖系统键盘体验差——题目切换时自动聚焦导致键盘反复弹出，
 * 输入框禁用/失焦后键盘收起，程序化 focus 又无法唤起，用户必须手动点输入框。
 * 设计意图：触屏上改用应用内键盘输入，配合输入框 inputMode="none" + readOnly
 * 彻底不唤起系统键盘，题目区不被遮挡，输入流程不中断。
 * 桌面端不渲染此组件，仍使用物理键盘。
 */
export function Keypad({
  onDigit,
  onBackspace,
  onClear,
  onConfirm,
  confirmDisabled,
}: KeypadProps) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className={styles.keypad}>
      {digits.map((d) => (
        <button
          key={d}
          type="button"
          className={styles.key}
          onClick={() => onDigit(d)}
        >
          {d}
        </button>
      ))}
      <button type="button" className={`${styles.key} ${styles.fnKey}`} onClick={onClear}>
        清空
      </button>
      <button type="button" className={styles.key} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className={`${styles.key} ${styles.fnKey}`} onClick={onBackspace}>
        ⌫
      </button>
      <button
        type="button"
        className={`${styles.key} ${styles.confirmKey}`}
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        确 定
      </button>
    </div>
  )
}
