/**
 * ErrorBoundary - 全局错误捕获
 * 
 * 捕获子组件渲染时的 JS 错误，显示友好提示而不是白屏。
 * 同时显示错误详情，方便用户截图反馈。
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 500 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 18, color: '#111', marginBottom: 8 }}>页面加载出错</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              请尝试刷新页面，或使用 Chrome / Safari / Edge 最新版浏览器
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 24px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
                marginBottom: 16,
              }}
            >
              刷新页面
            </button>
            <details style={{ textAlign: 'left', fontSize: 12, color: '#999', marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', marginBottom: 4 }}>错误详情（截图发给开发者）</summary>
              <pre style={{
                background: '#f3f4f6',
                padding: 8,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 200,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {this.state.error?.toString()}
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
