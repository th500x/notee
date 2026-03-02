import { useState } from 'react'
import { useGuestbook } from '../hooks/useGuestbook'
import { GuestbookForm } from './GuestbookForm'
import { GuestbookList } from './GuestbookList'
import { debounce } from '../utils/debounce'

/**
 * 留言板容器组件
 */
export function Guestbook({ isAdmin, onNotification }) {
  const [filterModule, setFilterModule] = useState('all')
  const [submitting, setSubmitting] = useState(false)
  const [lastSubmitTime, setLastSubmitTime] = useState(0)
  
  const {
    messages,
    loading,
    error,
    submitMessage,
    deleteMessage
  } = useGuestbook(filterModule)
  
  /**
   * 提交留言（带防抖和频率限制）
   */
  const handleSubmit = async (module, content) => {
    // 频率限制：3秒内只能提交一次
    const now = Date.now()
    const timeSinceLastSubmit = now - lastSubmitTime
    const minInterval = 3000 // 3秒
    
    if (timeSinceLastSubmit < minInterval) {
      const remainingSeconds = Math.ceil((minInterval - timeSinceLastSubmit) / 1000)
      onNotification(`请等待${remainingSeconds}秒后再提交`, 'warning')
      return false
    }
    
    setSubmitting(true)
    setLastSubmitTime(now)
    
    const result = await submitMessage(module, content)
    setSubmitting(false)
    
    if (result.success) {
      onNotification('留言提交成功！', 'success')
      return true
    } else {
      onNotification(result.error || '提交失败', 'error')
      return false
    }
  }
  
  const handleDelete = async (messageId) => {
    const result = await deleteMessage(messageId)
    
    if (result.success) {
      onNotification('留言已删除', 'success')
    } else {
      onNotification(result.error || '删除失败', 'error')
    }
  }
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col" style={{ height: '600px', gridColumn: '1 / -1' }}>
      {/* Header */}
      <div 
        className="h-32 flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}
      >
        <div className="text-white text-center">
          <div className="text-4xl mb-2">💬</div>
          <h3 className="text-2xl font-bold">留言板</h3>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 flex-1 overflow-y-auto">
        {/* 留言表单 */}
        <GuestbookForm 
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        
        {/* 留言列表 */}
        <GuestbookList
          messages={messages}
          loading={loading}
          error={error}
          filterModule={filterModule}
          onFilterChange={setFilterModule}
          isAdmin={isAdmin}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
