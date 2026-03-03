import { useState, useEffect } from 'react'

/**
 * 解锁项目弹窗组件
 */
export function UnlockProjectModal({ isOpen, onClose, onUnlock, projectName, loading }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError('')
    }
  }, [isOpen])
  
  const handleSubmit = async () => {
    if (!password || password.trim() === '') {
      setError('请输入密码')
      return
    }
    
    setError('')
    const result = await onUnlock(password)
    
    if (!result.success) {
      setError(result.error || '密码错误')
      setPassword('')
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            🔒 项目已加密
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
            disabled={loading}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            项目 <span className="font-semibold text-gray-900">"{projectName}"</span> 需要密码访问
          </p>
          
          <label htmlFor="project-password" className="block text-sm font-medium text-gray-700 mb-2">
            请输入访问密码
          </label>
          <input
            id="project-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
            placeholder="请输入密码"
            autoFocus
            disabled={loading}
          />
          
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '验证中...' : '解锁'}
          </button>
        </div>
      </div>
    </div>
  )
}
