import { useState } from 'react'
import { Header } from './components/Header'
import { ProjectCard } from './components/ProjectCard'
import { Guestbook } from './components/Guestbook'
import { Footer } from './components/Footer'
import { AdminLoginModal } from './components/AdminLoginModal'
import { Notification } from './components/Notification'
import { PerformancePanel } from './components/PerformancePanel'
import { useAdmin } from './hooks/useAdmin'
import { useNotification } from './hooks/useNotification'
import { PROJECTS } from './constants'
import './App.css'

function App() {
  const [showAdminModal, setShowAdminModal] = useState(false)
  const { isLoggedIn, loading: adminLoading, login, logout } = useAdmin()
  const { notifications, showNotification, closeNotification } = useNotification()
  
  /**
   * 分享网站
   */
  const handleShare = () => {
    const url = window.location.origin
    
    // 尝试使用现代的 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => {
          showNotification('网站链接已复制到剪贴板！', 'success')
        })
        .catch(() => {
          fallbackCopyText(url)
        })
    } else {
      fallbackCopyText(url)
    }
  }
  
  /**
   * 降级复制方案
   */
  const fallbackCopyText = (text) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      showNotification('网站链接已复制到剪贴板！', 'success')
    } catch (err) {
      showNotification('复制失败，请手动复制：' + text, 'error')
    }
    
    document.body.removeChild(textArea)
  }
  
  /**
   * 显示即将上线提示
   */
  const handleComingSoon = (featureName) => {
    showNotification(`${featureName}功能即将上线，敬请期待！`, 'info')
  }
  
  /**
   * 管理员登录
   */
  const handleAdminLogin = async (password) => {
    const result = await login(password)
    
    if (result.success) {
      setShowAdminModal(false)
      showNotification('登录成功！', 'success')
    }
    
    return result
  }
  
  /**
   * 管理员退出
   */
  const handleAdminLogout = () => {
    logout()
    showNotification('退出登录！', 'success')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header onShare={handleShare} />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 项目卡片（adminOnly 项仅管理员登录后可见，与 06 全功能同属管理员权限） */}
          {PROJECTS.filter((project) => !project.adminOnly || isLoggedIn).map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={handleComingSoon}
            />
          ))}
          
          {/* 留言板 */}
          <Guestbook
            isAdmin={isLoggedIn}
            onNotification={showNotification}
          />
        </div>
      </main>
      
      {/* Footer */}
      <Footer 
        isAdmin={isLoggedIn}
        onAdminClick={() => setShowAdminModal(true)}
        onLogout={handleAdminLogout}
      />
      
      {/* 管理员登录弹窗 */}
      <AdminLoginModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onLogin={handleAdminLogin}
        loading={adminLoading}
      />
      
      {/* 通知 */}
      <Notification
        notifications={notifications}
        onClose={closeNotification}
      />
      
      {/* 性能监控面板（仅开发环境） */}
      <PerformancePanel />
    </div>
  )
}

export default App
