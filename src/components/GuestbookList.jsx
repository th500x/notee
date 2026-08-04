import { MODULE_SHORT_NAMES } from '../constants'
import { MessageCard } from './MessageCard'

/**
 * 留言列表组件
 */
export function GuestbookList({ 
  messages, 
  loading, 
  error, 
  filterModule, 
  onFilterChange, 
  isAdmin, 
  onDelete 
}) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        加载中...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center py-8 text-red-500 text-sm">
        {error}
      </div>
    )
  }
  
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        暂无留言
      </div>
    )
  }
  
  return (
    <div>
      {/* 筛选器 */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-gray-900">最新留言</h4>
        <select 
          value={filterModule}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="all">{MODULE_SHORT_NAMES.all}</option>
          <option value="general">{MODULE_SHORT_NAMES.general}</option>
          <option value="01-news-calendar">{MODULE_SHORT_NAMES['01-news-calendar']}</option>
          <option value="02-tale-historical">{MODULE_SHORT_NAMES['02-tale-historical']}</option>
          <option value="07-coin-index">{MODULE_SHORT_NAMES['07-coin-index']}</option>
          <option value="05-san-storm">{MODULE_SHORT_NAMES['05-san-storm']}</option>
        </select>
      </div>

      {/* 留言列表 */}
      <div className="space-y-2">
        {messages.map(message => (
          <MessageCard
            key={message.id}
            message={message}
            isAdmin={isAdmin}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
