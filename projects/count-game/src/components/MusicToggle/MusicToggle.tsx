import styles from './MusicToggle.module.css'

interface MusicToggleProps {
  isMuted: boolean
  onToggle: () => void
}

/**
 * 背景音乐静音切换按钮
 *
 * 固定在页面右上角，点击切换静音/播放。
 * 沿用中式水墨美学风格。
 */
export function MusicToggle({ isMuted, onToggle }: MusicToggleProps) {
  return (
    <button
      className={styles.toggle}
      onClick={onToggle}
      type="button"
      aria-label={isMuted ? '开启背景音乐' : '关闭背景音乐'}
      title={isMuted ? '开启背景音乐' : '关闭背景音乐'}
    >
      {isMuted ? (
        <span className={styles.mutedIcon}>
          <span className={styles.note}>♪</span>
          <span className={styles.slash} />
        </span>
      ) : (
        <span className={styles.note}>♪</span>
      )}
    </button>
  )
}
