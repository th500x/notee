import { useState, useEffect } from 'react'

/**
 * 添加项目开支弹窗组件
 */
export function AddExpenseModal({ isOpen, onClose, onAdd, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [error, setError] = useState('')
  
  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: ''
      })
      setError('')
    }
  }, [isOpen])
  
  const handleSubmit = async () => {
    // 前端验证
    if (!formData.name || formData.name.trim() === '') {
      setError('开支类别名称不能为空')
      return
    }
    
    if (formData.name.length > 100) {
      setError('开支类别名称不能超过100个字符')
      return
    }
    
    if (formData.description && formData.description.length > 500) {
      setError('说明不能超过500个字符')
      return
    }
    
    setError('')
    const result = await onAdd(formData)
    
    if (!result.success) {
      setError(result.error || '添加失败')
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            💰 添加项目开支
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
        <div className="p-6 space-y-4">
          {/* 开支类别名称 */}
          <div>
            <label htmlFor="expense-name" className="block text-sm font-medium text-gray-700 mb-2">
              开支类别名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="expense-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="例如：水电费、维修费、管理费"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {/* 说明 */}
          <div>
            <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-2">
              说明（可选）
            </label>
            <textarea
              id="expense-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
              placeholder="请输入说明"
              rows="3"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
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
            className="flex-1 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '添加中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
