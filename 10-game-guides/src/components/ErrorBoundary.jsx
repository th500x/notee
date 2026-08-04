import { Component } from 'react'
import { LOG_PREFIX } from '../constants'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error(LOG_PREFIX, 'ErrorBoundary', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="text-xl font-semibold text-[var(--text)]">页面出了点问题</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            请刷新重试。若持续失败，可从首页重新进入。
          </p>
          <a
            href="/10-game-guides/"
            className="mt-6 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            返回游戏攻略首页
          </a>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-8 overflow-auto rounded-lg bg-[var(--surface)] p-4 text-left text-xs text-red-300">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
