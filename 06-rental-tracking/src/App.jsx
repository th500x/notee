import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import UtilityBillPage from './pages/UtilityBillPage'
import AdminSyncPage from './pages/AdminSyncPage'
import { ProjectFormModal } from './components/ProjectFormModal'
import { UtilityBillFormModal } from './components/UtilityBillFormModal'
import { 
  loadRentalData, 
  saveRentalData,
  createProject as apiCreateProject,
  createUtilityProject,
  deleteProject as apiDeleteProject,
  updateProjectData as apiUpdateProjectData
} from './utils/dataManagerAPI'
import { useAdmin } from './hooks/useAdmin'

/**
 * 租赁追踪主应用组件
 * 
 * 功能架构：
 * - 主页：显示所有项目的卡片列表
 * - 项目详情页：显示选中项目的房源管理和收支追踪
 * - 管理员权限：通过notee主页统一验证
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
  // 检查是否是同步页面路由
  const isAdminSyncPage = window.location.pathname.includes('/admin/sync')
  
  // 如果是同步页面，直接渲染同步页面
  if (isAdminSyncPage) {
    return <AdminSyncPage />
  }
  
  // 使用统一的管理员验证
  const { isLoggedIn: isAdmin } = useAdmin()
  
  // 状态管理
  const [rentalData, setRentalData] = useState({ projects: [] })
  const [currentView, setCurrentView] = useState('home') // 'home' | 'project-detail' | 'utility-bill'
  const [selectedProject, setSelectedProject] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // 加载状态
  const [showCreateModal, setShowCreateModal] = useState(false) // 创建项目对话框
  const [createLoading, setCreateLoading] = useState(false) // 创建项目加载状态
  const [showUtilityCreateModal, setShowUtilityCreateModal] = useState(false)
  const [utilityCreateLoading, setUtilityCreateLoading] = useState(false)

  // 加载数据（管理员登录状态变化时重拉列表，以便显示/隐藏水电单）
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        setIsLoading(true)
        const data = await loadRentalData()
        if (!cancelled) {
          setRentalData(data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('加载数据失败:', error)
          alert('加载数据失败，请检查后端服务是否启动')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [isAdmin])

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

  // 选择项目（进入项目详情页或水电单页）
  const handleProjectSelect = (project) => {
    if (project.projectKind === 'utility') {
      if (!isAdmin) {
        alert('水电单仅管理员可访问')
        return
      }
      setSelectedProject(project)
      setCurrentView('utility-bill')
      return
    }
    setSelectedProject(project)
    setCurrentView('project-detail')
  }

  // 返回主页
  const handleBackToHome = () => {
    setCurrentView('home')
    setSelectedProject(null)
  }

  const handleUtilityBillSaved = async () => {
    const data = await loadRentalData()
    setRentalData(data)
    if (selectedProject?.id) {
      const next = data.projects.find((p) => p.id === selectedProject.id)
      if (next) setSelectedProject(next)
    }
  }

  // 添加新项目（管理员功能）
  const handleAddProject = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    setShowCreateModal(true)
  }

  const handleAddUtilityProject = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    setShowUtilityCreateModal(true)
  }

  const handleCreateUtilityProjectSubmit = async ({ name, description }) => {
    setUtilityCreateLoading(true)
    try {
      await createUtilityProject({ name, description })
      await reloadData()
      setShowUtilityCreateModal(false)
      alert('水电单项目已创建')
      return { success: true }
    } catch (error) {
      console.error('创建水电单失败:', error)
      return {
        success: false,
        error: error.message || '创建水电单失败'
      }
    } finally {
      setUtilityCreateLoading(false)
    }
  }
  
  // 创建项目
  const handleCreateProject = async (formData) => {
    setCreateLoading(true)
    
    try {
      await apiCreateProject({
        name: formData.name,
        description: formData.description,
        password: formData.password,
        visible: formData.visible,
        propertyGroups: formData.propertyGroups || []  // 包含房源分组
      })
      
      // 重新加载数据
      await reloadData()
      setShowCreateModal(false)
      alert('✅ 项目创建成功')
      
      return { success: true }
    } catch (error) {
      console.error('创建项目失败:', error)
      return { 
        success: false, 
        error: error.message || '创建项目失败'
      }
    } finally {
      setCreateLoading(false)
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
              onAddUtilityProject={handleAddUtilityProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProject={handleProjectUpdate}
              onReloadProjects={reloadData}
              isAdmin={isAdmin}
            />
          ) : currentView === 'utility-bill' ? (
            selectedProject ? (
              <UtilityBillPage
                project={selectedProject}
                onBack={handleBackToHome}
                onSaved={handleUtilityBillSaved}
              />
            ) : null
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
      
      {/* 创建项目对话框 */}
      <ProjectFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
        loading={createLoading}
        mode="create"
      />

      <UtilityBillFormModal
        isOpen={showUtilityCreateModal}
        onClose={() => setShowUtilityCreateModal(false)}
        onSubmit={handleCreateUtilityProjectSubmit}
        loading={utilityCreateLoading}
      />
    </div>
  )
}

export default App
