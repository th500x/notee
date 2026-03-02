import { NOTIFICATION_TYPES } from '../constants'

/**
 * 通知组件
 */
export function Notification({ notifications, onClose }) {
  const getTypeStyles = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return 'bg-green-500 text-white'
      case NOTIFICATION_TYPES.ERROR:
        return 'bg-red-500 text-white'
      case NOTIFICATION_TYPES.WARNING:
        return 'bg-yellow-500 text-white'
      case NOTIFICATION_TYPES.INFO:
      default:
        return 'bg-blue-500 text-white'
    }
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`
            px-6 py-3 rounded-lg shadow-lg
            transition-all duration-300 transform
            ${notification.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            ${getTypeStyles(notification.type)}
          `}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{notification.message}</span>
            <button
              onClick={() => onClose(notification.id)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
