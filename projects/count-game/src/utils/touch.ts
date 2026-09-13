/**
 * 触屏设备检测
 *
 * 按主指针类型判断：手机 / 平板的主指针为粗指针（coarse）且无悬停能力；
 * 触屏笔记本的主指针仍是鼠标（fine），不会误判。
 * 练习面板据此在触屏上切换为内置数字键盘，并抑制系统键盘。
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}
