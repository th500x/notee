import { useState, useEffect } from 'react'

/**
 * 添加收支记录弹窗组件
 */
export function AddRecordModal({ isOpen, onClose, onAdd, loading, defaultDate, propertyRecords = [], showPaidOption = true }) {
  const [formData, setFormData] = useState({
    date: defaultDate || '',
    income: '',
    expenses: '',
    note: '',
    isPaid: false
  })
  const [error, setError] = useState('')
  
  // 检查当月是否已有缴租记录
  const hasMonthPaidRecord = () => {
    if (!formData.date) return false
    return propertyRecords.some(record => 
      record.date === formData.date && record.isPaid === true
    )
  }
  
  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: defaultDate || '',
        income: '',
        expenses: '',
        note: '',
        isPaid: false
      })
      setError('')
    }
  }, [isOpen, defaultDate])
  
  const handleSubmit = async () => {
    // 前端验证
    if (!formData.date || formData.date.trim() === '') {
      setError('日期不能为空')
      return
    }
    
    const income = parseFloat(formData.income) || 0
    const expenses = parseFloat(formData.expenses) || 0
    
    if (income < 0 || expenses < 0) {
      setError('金额不能为负数')
      return
    }
    
    if (income === 0 && expenses === 0) {
      setError('收入和支出不能同时为0')
      return
    }
    
    if (formData.note && formData.note.length > 500) {
      setError('备注不能超过500个字符')
      return
    }
    
    setError('')
    const result = await onAdd({
      date: formData.date,
      income,
      expenses,
      note: formData.note || '',
      isPaid: formData.isPaid
    })
    
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
            📝 添加收支记录
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
          {/* 日期 */}
          <div>
            <label htmlFor="record-date" className="block text-sm font-medium text-gray-700 mb-2">
              日期 <span className="text-red-500">*</span>
            </label>
            <input
              id="record-date"
              type="text"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
              placeholder="YYYY-MM"
              autoFocus
              disabled={loading}
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">格式：YYYY-MM（例如：2026-03）</p>
          </div>
          
          {/* 收入 */}
          <div>
            <label htmlFor="record-income" className="block text-sm font-medium text-gray-700 mb-2">
              收入金额（฿）
            </label>
            <input
              id="record-income"
              type="number"
              value={formData.income}
              onChange={(e) => setFormData({ ...formData, income: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          
          {/* 支出 */}
          <div>
            <label htmlFor="record-expenses" className="block text-sm font-medium text-gray-700 mb-2">
              支出金额（฿）
            </label>
            <input
              id="record-expenses"
              type="number"
              value={formData.expenses}
              onChange={(e) => setFormData({ ...formData, expenses: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          
          {/* 备注 */}
          <div>
            <label htmlFor="record-note" className="block text-sm font-medium text-gray-700 mb-2">
              备注（可选）
            </label>
            <textarea
              id="record-note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
              placeholder="请输入备注"
              rows="3"
              disabled={loading}
            />
          </div>
          
          {/* 已缴租复选框 - 仅在房源记录中显示 */}
          {showPaidOption && (
            <div>
              <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPaid}
                  onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                  disabled={loading || hasMonthPaidRecord()}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex-1">
                  <span className={`text-sm font-medium ${hasMonthPaidRecord() ? 'text-gray-400' : 'text-gray-700'}`}>
                    已缴租
                  </span>
                  {hasMonthPaidRecord() && (
                    <p className="text-xs text-gray-500 mt-1">
                      ⚠️ 本月已有缴租记录，无法重复标记
                    </p>
                  )}
                </div>
              </label>
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
