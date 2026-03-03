import { useState, useEffect } from 'react'

/**
 * 添加房源弹窗组件
 */
export function AddPropertyModal({ isOpen, onClose, onAdd, loading, availableGroups = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    monthlyRent: '',
    deposit: '',
    targetGroupId: 'default'  // 默认选择默认分组
  })
  const [error, setError] = useState('')
  
  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        monthlyRent: '',
        deposit: '',
        targetGroupId: 'default'
      })
      setError('')
    }
  }, [isOpen])
  
  const handleSubmit = async () => {
    // 前端验证
    if (!formData.name || formData.name.trim() === '') {
      setError('房源编号不能为空')
      return
    }
    
    if (formData.name.length > 100) {
      setError('房源编号不能超过100个字符')
      return
    }
    
    if (!formData.monthlyRent || formData.monthlyRent === '') {
      setError('月租金不能为空')
      return
    }
    
    const rent = parseFloat(formData.monthlyRent)
    if (isNaN(rent) || rent < 0) {
      setError('请输入有效的月租金')
      return
    }
    
    const depositAmount = formData.deposit && formData.deposit !== '' 
      ? parseFloat(formData.deposit) 
      : 0  // 如果没有填写押金，默认为 0
    
    if (depositAmount < 0) {
      setError('押金不能为负数')
      return
    }
    
    setError('')
    const result = await onAdd({
      name: formData.name,
      monthlyRent: rent,
      deposit: depositAmount,
      targetGroupId: formData.targetGroupId  // 传递目标分组ID
    })
    
    if (!result.success) {
      setError(result.error || '添加失败')
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  // 自动填充押金（等于月租金）
  const handleRentChange = (value) => {
    setFormData({ 
      ...formData, 
      monthlyRent: value
      // 移除自动填充押金的逻辑
    })
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
            🏠 添加房源
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
          {/* 房源编号 */}
          <div>
            <label htmlFor="property-name" className="block text-sm font-medium text-gray-700 mb-2">
              房源编号 <span className="text-red-500">*</span>
            </label>
            <input
              id="property-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="例如：A101、B202"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {/* 月租金 */}
          <div>
            <label htmlFor="monthly-rent" className="block text-sm font-medium text-gray-700 mb-2">
              月租金（฿）<span className="text-red-500">*</span>
            </label>
            <input
              id="monthly-rent"
              type="number"
              min="0"
              step="0.01"
              value={formData.monthlyRent}
              onChange={(e) => handleRentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="请输入月租金"
              disabled={loading}
            />
          </div>
          
          {/* 押金 */}
          <div>
            <label htmlFor="deposit" className="block text-sm font-medium text-gray-700 mb-2">
              押金（฿）
            </label>
            <input
              id="deposit"
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="请输入押金"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              可选，不填写默认为 0
            </p>
          </div>
          
          {/* 目标分组（仅在有多个分组时显示） */}
          {availableGroups.length > 1 && (
            <div>
              <label htmlFor="target-group" className="block text-sm font-medium text-gray-700 mb-2">
                添加到分组
              </label>
              <select
                id="target-group"
                value={formData.targetGroupId}
                onChange={(e) => setFormData({ ...formData, targetGroupId: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                disabled={loading}
              >
                {availableGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
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
            className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? '添加中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
