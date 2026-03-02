import { useState } from 'react'
import { MODULES, MODULE_NAMES, GUESTBOOK_CONFIG } from '../constants'

/**
 * 留言表单组件
 */
export function GuestbookForm({ onSubmit, submitting }) {
  const [module, setModule] = useState('')
  const [content, setContent] = useState('')
  const [charCount, setCharCount] = useState(0)
  
  const handleContentChange = (e) => {
    const value = e.target.value
    if (value.length <= GUESTBOOK_CONFIG.MAX_MESSAGE_LENGTH) {
      setContent(value)
      setCharCount(value.length)
    }
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!module || !content.trim()) {
      return
    }
    
    const success = await onSubmit(module, content.trim())
    
    if (success) {
      // 重置表单
      setModule('')
      setContent('')
      setCharCount(0)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="mb-6">
      {/* 模块选择 */}
      <div className="mb-3">
        <select 
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          required
          disabled={submitting}
        >
          <option value="">选择模块...</option>
          {Object.entries(MODULES).map(([key, value]) => (
            <option key={value} value={value}>
              {MODULE_NAMES[value]}
            </option>
          ))}
        </select>
      </div>

      {/* 留言内容 */}
      <div className="mb-3">
        <textarea 
          value={content}
          onChange={handleContentChange}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
          rows="3"
          placeholder="说点什么吧..."
          required
          disabled={submitting}
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          <span className={charCount >= GUESTBOOK_CONFIG.MAX_MESSAGE_LENGTH ? 'text-red-500' : ''}>
            {charCount}
          </span>
          /{GUESTBOOK_CONFIG.MAX_MESSAGE_LENGTH}
        </div>
      </div>

      {/* 提交按钮 */}
      <button 
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={submitting || !module || !content.trim()}
      >
        {submitting ? '提交中...' : '提交留言'}
      </button>
    </form>
  )
}
