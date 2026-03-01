/**
 * 加载状态组件
 * 统一的加载指示器
 */

function Loading({ message = '加载中...', size = 'medium' }) {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-gold`} />
      {message && (
        <p className="mt-4 text-gray-600">{message}</p>
      )}
    </div>
  )
}

export default Loading
