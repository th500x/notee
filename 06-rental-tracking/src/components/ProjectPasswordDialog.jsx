import { useState } from 'react'

/**
 * 项目密码输入对话框
 * 
 * @param {boolean} isOpen - 是否显示对话框
 * @param {function} onSubmit - 提交密码回调
 * @param {function} onClose - 关闭对话框回调
 */
export function ProjectPasswordDialog({ isOpen, onSubmit, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const handleSubmit = () => {
    if (!password || password.trim() === '') {
      setError('请输入项目密码')
      return
    }
    
    setError('')
    onSubmit(password.trim())
    setPassword('')
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            🔐 输入密码访问项目
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            请输入密码以访问对应的项目。密码有效期为7天。
          </p>
          
          <div>
            <label htmlFor="project-password" className="block text-sm font-medium text-gray-700 mb-2">
              密码
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
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 提示：输入密码后，您可以访问所有使用该密码的项目
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <button
            onClick={handleClose}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
