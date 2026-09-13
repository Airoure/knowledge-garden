/**
 * 将秒数格式化为 m:ss 形式
 */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 将题号转为中文序号（1~10 用汉字，其余用数字）
 */
const CN_NUMS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export function formatQuestionNumber(index: number): string {
  const idx = index + 1
  return idx <= 10 ? `第${CN_NUMS[idx]}题` : `第${idx}题`
}
