/**
 * 加载状态组件
 * 统一的加载指示器
 * 
 * @component
 * @param {Object} props - 组件属性
 * @param {string} [props.message='加载中...'] - 加载提示文本
 * @param {string} [props.size='medium'] - 大小（small/medium/large）
 * 
 * @description
 * 显示旋转的加载动画和可选的提示文本。
 * 支持三种尺寸：small(8x8)、medium(12x12)、large(16x16)。
 * 
 * @example
 * // 默认加载
 * <Loading />
 * 
 * // 自定义提示
 * <Loading message="正在加载书籍..." />
 * 
 * // 大尺寸
 * <Loading size="large" message="请稍候" />
 * 
 * // 小尺寸，无提示
 * <Loading size="small" message="" />
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
