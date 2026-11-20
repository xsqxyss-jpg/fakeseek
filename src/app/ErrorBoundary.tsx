import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      const record = {
        time: new Date().toISOString(),
        message: String(error?.message || error || '').slice(0, 2000),
        stack: String(error?.stack || errorInfo?.componentStack || '').slice(0, 2000),
      }
      localStorage.setItem('fakeseek:lastError', JSON.stringify(record))
    } catch {
      // 避免 storage 满时报错
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleClearData = () => {
    if (window.confirm('确定要清空所有本机数据并重新加载吗？此操作不可恢复。')) {
      try {
        localStorage.clear()
      } catch {
        // ignore
      }
      window.location.reload()
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      const rawMessage = this.state.error?.message || String(this.state.error || '')
      const displayMessage = rawMessage.slice(0, 300)
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 120)

      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <h1 className={styles.title}>应用出错了</h1>
            <pre className={styles.message}>{displayMessage}</pre>
            <div className={styles.ua}>UA: {ua}</div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonReload}
                onClick={this.handleReload}
              >
                重新加载
              </button>
              <button
                type="button"
                className={styles.buttonClear}
                onClick={this.handleClearData}
              >
                清空本机数据
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
