import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import { 
  loadRentalData, 
  saveRentalData,
  setAdminPassword,
  clearAdminPassword,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  updateProjectData as apiUpdateProjectData
} from './utils/dataManagerAPI'
import { verifyGlobalPassword } from './utils/globalAuth'

/**
 * 租赁追踪主应用组件
 * 
 * 功能架构：
 * - 主页：显示所有项目的卡片列表
 * - 项目详情页：显示选中项目的房源管理和收支追踪
 * - 管理员权限：通过全局密码验证
 * 
 * 数据结构：
 * {
 *   projects: [
 *     {
 *       id: 'project-1',
 *       name: '项目名称',
 *       description: '项目描述',
 *       properties: [
 *         {
 *           id: 'property-1',
 *           name: '房源编号',
 *           status: 'rented' | 'vacant',
 *           monthlyRent: 3000,
 *           tenant: { name: '', phone: '', startDate: '', endDate: '' },
 *           records: [
 *             { date: '2026-01', income: 3000, expenses: 200, note: '' }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function App() {
  // 状态管理
  const [rentalData, setRentalData] = useState({ projects: [] })
  const [currentView, setCurrentView] = useState('home') // 'home' | 'project-detail'
  const [selectedProject, setSelectedProject] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false) // 管理员状态
  const [isLoading, setIsLoading] = useState(true) // 加载状态

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const data = await loadRentalData()
        setRentalData(data)
      } catch (error) {
        console.error('加载数据失败:', error)
        alert('加载数据失败，请检查后端服务是否启动')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
    
    // 检查是否已经登录过管理员（从sessionStorage）
    const adminStatus = sessionStorage.getItem('rental-tracking-admin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
    }
  }, [])

  // 保存数据
  const handleDataUpdate = async (newData) => {
    setRentalData(newData)
    try {
      await saveRentalData(newData)
    } catch (error) {
      console.error('保存数据失败:', error)
      alert('保存数据失败：' + error.message)
    }
  }

  // 重新加载数据
  const reloadData = async () => {
    try {
      const data = await loadRentalData()
      setRentalData(data)
    } catch (error) {
      console.error('重新加载数据失败:', error)
    }
  }

  // 选择项目（进入项目详情页）
  const handleProjectSelect = (project) => {
    setSelectedProject(project)
    setCurrentView('project-detail')
  }

  // 返回主页
  const handleBackToHome = () => {
    setCurrentView('home')
    setSelectedProject(null)
  }

  // 管理员登录
  const handleAdminLogin = () => {
    const password = prompt('请输入管理员密码：')
    if (!password) return

    const result = verifyGlobalPassword(password)
    
    if (result.success) {
      setIsAdmin(true)
      setAdminPassword(password) // 缓存密码用于 API 调用
      sessionStorage.setItem('rental-tracking-admin', 'true')
      alert('✅ 管理员登录成功')
      // 重新加载数据以获取所有项目（包括隐藏的）
      reloadData()
    } else {
      alert('❌ ' + result.message)
    }
  }

  // 管理员登出
  const handleAdminLogout = () => {
    if (confirm('确定要退出管理员模式吗？')) {
      setIsAdmin(false)
      clearAdminPassword() // 清除密码缓存
      sessionStorage.removeItem('rental-tracking-admin')
      // 清除所有已解锁的项目
      sessionStorage.removeItem('rental-tracking-unlocked-projects')
      
      // 如果当前在项目详情页，强制返回主页
      if (currentView === 'project-detail') {
        setCurrentView('home')
        setSelectedProject(null)
      }
      
      alert('已退出管理员模式')
      // 重新加载数据以过滤隐藏的项目
      reloadData()
    }
  }

  // 添加新项目（管理员功能）
  const handleAddProject = async () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    const projectName = prompt('请输入项目名称：')
    if (!projectName) return

    const projectDesc = prompt('请输入项目描述（可选）：') || ''

    try {
      await apiCreateProject({
        name: projectName,
        description: projectDesc
      })
      
      // 重新加载数据
      await reloadData()
      alert('✅ 项目创建成功')
    } catch (error) {
      console.error('创建项目失败:', error)
      alert('❌ 创建项目失败：' + error.message)
    }
  }

  // 删除项目（管理员功能）
  const handleDeleteProject = async (projectId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这个项目吗？这将删除项目下的所有房源数据。')) return

    try {
      await apiDeleteProject(projectId)
      
      // 重新加载数据
      await reloadData()
      
      // 如果删除的是当前选中的项目，返回主页
      if (selectedProject && selectedProject.id === projectId) {
        handleBackToHome()
      }
      
      alert('✅ 项目删除成功')
    } catch (error) {
      console.error('删除项目失败:', error)
      alert('❌ 删除项目失败：' + error.message)
    }
  }

  // 更新项目数据
  const handleProjectUpdate = async (updatedProject) => {
    try {
      await apiUpdateProjectData(updatedProject)
      
      // 重新加载数据
      await reloadData()
      
      // 更新选中的项目
      setSelectedProject(updatedProject)
    } catch (error) {
      console.error('更新项目失败:', error)
      alert('❌ 更新项目失败：' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <a 
                href="/"
                className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
              >
                租賃追蹤
                {/* 悬停提示 */}
                <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  返回主页
                </span>
              </a>
              <p className="text-gray-600 mt-2">房源租赁管理与收支追踪</p>
            </div>
            
            {/* 系统管理按钮 */}
            <div>
              {isAdmin ? (
                <button
                  onClick={handleAdminLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium border border-red-700 flex items-center gap-2"
                  title="退出管理员模式"
                >
                  <span>🔓</span>
                  <span>退出管理</span>
                </button>
              ) : (
                <button
                  onClick={handleAdminLogin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium border border-blue-700 flex items-center gap-2"
                  title="登录管理员账号"
                >
                  <span>🔒</span>
                  <span>系统管理</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 加载状态 */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-6xl mb-4">⏳</div>
              <p className="text-xl text-gray-600">加载中...</p>
            </div>
          </div>
        ) : (
          /* 根据当前视图显示不同页面 */
          currentView === 'home' ? (
            <HomePage
              projects={rentalData.projects}
              onProjectSelect={handleProjectSelect}
              onAddProject={handleAddProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProject={handleProjectUpdate}
              isAdmin={isAdmin}
            />
          ) : (
            <ProjectDetailPage
              project={selectedProject}
              onBack={handleBackToHome}
              onProjectUpdate={handleProjectUpdate}
              isAdmin={isAdmin}
            />
          )
        )}
      </main>
    </div>
  )
}

export default App
