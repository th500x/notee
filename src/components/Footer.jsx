/**
 * 页脚组件
 */
export function Footer({ isAdmin, onAdminClick, onLogout }) {
  const handleClick = () => {
    if (isAdmin) {
      // 已登录，执行退出
      onLogout()
    } else {
      // 未登录，打开登录弹窗
      onAdminClick()
    }
  }
  
  return (
    <footer className="bg-white border-t mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div>
          <h3 
            className={`text-lg font-bold mb-4 cursor-pointer transition-colors inline-block ${
              isAdmin 
                ? 'text-green-600 hover:text-red-600' 
                : 'text-gray-900 hover:text-blue-600'
            }`}
            onClick={handleClick}
            title={isAdmin ? '退出登录' : '管理员登录'}
          >
            © 版权申明 {isAdmin && '✓'}
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-line text-left">
{`無限筆記 (Notee.vip)
版本：0.1
作者：CHRIS🇹🇭
Copyright © 2026 Notee.vip
保留所有权利`}
          </div>
        </div>
      </div>
    </footer>
  )
}
