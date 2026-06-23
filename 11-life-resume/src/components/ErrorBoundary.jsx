import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[life-resume] render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-center mb-2">页面出错了</h2>
            <p className="text-slate-600 text-center mb-4">请刷新后重试</p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-red-600 overflow-auto bg-slate-50 p-3 rounded">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
