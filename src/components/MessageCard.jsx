import { MODULE_SHORT_NAMES } from '../constants'
import { formatTimestamp, formatLocation, escapeHtml } from '../utils/format'

/**
 * 单条留言卡片组件
 */
export function MessageCard({ message, isAdmin, onDelete }) {
  const moduleName = MODULE_SHORT_NAMES[message.module] || message.module
  const timeStr = formatTimestamp(message.timestamp)
  const locationStr = formatLocation(message.ip, message.location)
  
  const handleDelete = () => {
    if (window.confirm('确定要删除这条留言吗？')) {
      onDelete(message.id)
    }
  }
  
  return (
    <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
      <div className="flex justify-between items-start mb-1">
        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          {moduleName}
        </span>
        {isAdmin && (
          <button 
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-xs transition-colors"
            title="删除"
          >
            🗑️
          </button>
        )}
      </div>
      <p 
        className="text-gray-800 mb-1 text-xs"
        dangerouslySetInnerHTML={{ __html: escapeHtml(message.content) }}
      />
      <div className="text-xs text-gray-400">
        {locationStr} · {timeStr}
      </div>
    </div>
  )
}
