import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import styles from './LoginPanel.module.css'

interface LoginPanelProps {
  onRegister: (username: string, password: string) => Promise<unknown>
  onLogin: (username: string, password: string) => Promise<unknown>
  loading: boolean
  error: string | null
  onClearError: () => void
}

/**
 * 登录 / 注册面板
 *
 * Tab 切换登录与注册，交互与 BattleLobby 保持一致。
 */
export function LoginPanel({ onRegister, onLogin, loading, error, onClearError }: LoginPanelProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = () => {
    if (!username.trim() || !password) return
    const action = tab === 'login' ? onLogin : onRegister
    action(username.trim(), password)
  }

  const canSubmit = username.trim().length >= 2 && password.length >= 4 && !loading

  return (
    <Card className={styles.panel}>
      <h2 className={styles.title}>数感道场</h2>
      <p className={styles.desc}>{tab === 'login' ? '欢迎回来，请登录' : '注册账号，开始修行'}</p>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorBar} onClick={onClearError}>
          {error} ✕
        </div>
      )}

      {/* Tab 切换 */}
      <div className={styles.tabToggle}>
        <button
          className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('login')
            onClearError()
          }}
          type="button"
        >
          登 录
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'register' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('register')
            onClearError()
          }}
          type="button"
        >
          注 册
        </button>
      </div>

      {/* 用户名 */}
      <div className={styles.sectionLabel}>用户名</div>
      <input
        className={styles.input}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="2-12 个字符"
        maxLength={12}
        autoComplete="off"
      />

      {/* 密码 */}
      <div className={styles.sectionLabel}>密码</div>
      <input
        className={styles.input}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="至少 4 位"
        maxLength={32}
        autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) handleSubmit()
        }}
      />

      <button
        className={styles.actionBtn}
        onClick={handleSubmit}
        type="button"
        disabled={!canSubmit}
      >
        {loading ? '处理中…' : tab === 'login' ? '登 录' : '注 册'}
      </button>
    </Card>
  )
}
