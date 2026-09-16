import styles from './Header.module.css'

interface HeaderProps {
  /** 已登录用户名（未登录时不传） */
  username?: string | null
  /** 登出回调 */
  onLogout?: () => void
}

/**
 * 顶部标题区
 * 展示品牌名称「数感道场」与副标题，左上角返回知识花园，登录后右上角显示用户名与登出
 */
export function Header({ username, onLogout }: HeaderProps) {
  return (
    <header className={styles.header}>
      <a className={styles.homeLink} href="/" title="返回知识花园首页">
        🏠 知识花园
      </a>
      <div className={styles.ornament}>
        <span className={styles.ornamentLine} />
        <span className={styles.ornamentDot} />
        <span className={styles.sub}>Number Sense Dojo</span>
        <span className={styles.ornamentDot} />
        <span className={styles.ornamentLine} />
      </div>
      <h1 className={styles.title}>
        数感<span className={styles.charVermilion}>道</span>场
        <span className={styles.seal}>速算</span>
      </h1>
      <p className={styles.tagline}>考 公 速 算 · 以 算 修 心</p>

      {username && (
        <div className={styles.userBar}>
          <span className={styles.username}>{username}</span>
          {onLogout && (
            <button className={styles.logoutBtn} onClick={onLogout} type="button">
              登出
            </button>
          )}
        </div>
      )}
    </header>
  )
}
