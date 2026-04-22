import { useState, useEffect, useMemo } from 'react'
import { updateProjectInfo } from '../utils/dataManagerAPI'
import * as api from '../utils/apiClient'
import { getCurrentPropertyStatus } from '../utils/propertyStatus'
import { getAllProperties } from '../utils/propertyUtils'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { UnlockProjectModal } from '../components/UnlockProjectModal'
import { ProjectPasswordDialog } from '../components/ProjectPasswordDialog'
import ProjectCard from '../components/ProjectCard'
import { 
  getValidPassword, 
  saveProjectPassword, 
  cleanExpiredPasswords,
  getAccessibleProjects
} from '../utils/projectPasswordManager'

/**
 * 主页组件
 * 
 * 功能：
 * - 显示所有项目的卡片列表
 * - 管理员：显示所有项目
 * - 非管理员：需要输入项目密码才能看到对应项目（只需输入一次）
 * - 项目密码缓存7天
 */
function HomePage({
  projects,
  onProjectSelect,
  onAddProject,
  onAddUtilityProject,
  onDeleteProject,
  onUpdateProject,
  isAdmin
}) {
  const [editingProject, setEditingProject] = useState(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockingProject, setUnlockingProject] = useState(null)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [userPassword, setUserPassword] = useState(null)
  const [accessibleProjects, setAccessibleProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  
  // 使用 key 来强制重新渲染，当 isAdmin 改变时
  const [renderKey, setRenderKey] = useState(0)
  
  useEffect(() => {
    // 当 isAdmin 改变时，强制重新渲染所有项目卡片
    setRenderKey(prev => prev + 1)
  }, [isAdmin])
  
  // 初始化：清理过期密码并加载有效密码
  useEffect(() => {
    cleanExpiredPasswords()
    const password = getValidPassword()
    setUserPassword(password)
    
    // 如果非管理员且没有有效密码，显示密码输入对话框
    if (!isAdmin && !password) {
      setShowPasswordDialog(true)
      setAccessibleProjects([])
    } else if (!isAdmin && password) {
      // 有密码，加载可访问的项目
      loadAccessibleProjects(password)
    } else {
      // 管理员，显示所有项目
      setAccessibleProjects(projects)
    }
  }, [isAdmin])
  
  // 当管理员状态或项目列表变化时，更新可访问项目
  useEffect(() => {
    if (isAdmin) {
      setAccessibleProjects(projects)
    } else if (userPassword) {
      loadAccessibleProjects(userPassword)
    }
  }, [isAdmin, projects, userPassword])
  
  // 加载可访问的项目
  const loadAccessibleProjects = async (password) => {
    setLoadingProjects(true)
    try {
      const projects = await getAccessibleProjects(password)
      setAccessibleProjects(projects)
    } catch (error) {
      console.error('加载可访问项目失败:', error)
      setAccessibleProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }
  
  // 处理密码输入
  const handlePasswordSubmit = async (password) => {
    saveProjectPassword(password)
    setUserPassword(password)
    setShowPasswordDialog(false)
    
    // 立即加载可访问的项目
    await loadAccessibleProjects(password)
  }

  // 打开解锁对话框
  const handleUnlockProject = (project) => {
    setUnlockingProject(project)
    setShowUnlockModal(true)
  }
  
  // 关闭解锁对话框
  const handleCloseUnlockModal = () => {
    setShowUnlockModal(false)
    setUnlockingProject(null)
    setUnlockLoading(false)
  }
  
  // 验证密码并解锁
  const handleConfirmUnlock = async (password) => {
    setUnlockLoading(true)
    
    try {
      const response = await api.getProject(unlockingProject.id, password)
      if (response.success) {
        // 密码正确，进入项目
        handleCloseUnlockModal()
        onProjectSelect(unlockingProject)
        return { success: true }
      } else {
        return { success: false, error: '密码错误' }
      }
    } catch (error) {
      console.error('验证密码失败:', error)
      return { success: false, error: '密码错误' }
    } finally {
      setUnlockLoading(false)
    }
  }

  // 打开编辑对话框
  const handleEditProject = (project) => {
    setEditingProject(project)
    setShowEditDialog(true)
  }

  // 关闭编辑对话框
  const handleCloseEditDialog = () => {
    setShowEditDialog(false)
    setEditingProject(null)
  }

  // 保存项目编辑
  const handleSaveProject = async (formData) => {
    setEditLoading(true)
    
    try {
      // 构建更新数据
      const updateData = {
        name: formData.name,
        description: formData.description,
        password: formData.password || '',
        visible: formData.visible,
        propertyGroups: formData.propertyGroups || [],  // 包含房源分组
        properties: formData.properties || []  // 包含默认分组的房源
      }
      
      await updateProjectInfo(editingProject.id, updateData)
      
      // 调用父组件的更新函数重新加载数据
      onUpdateProject({ ...editingProject, ...updateData })
      handleCloseEditDialog()
      alert('✅ 项目更新成功')
      
      return { success: true }
    } catch (error) {
      console.error('更新项目失败:', error)
      return { 
        success: false, 
        error: error.message || '更新项目失败'
      }
    } finally {
      setEditLoading(false)
    }
  }

  // 删除项目
  const handleDeleteProject = () => {
    onDeleteProject(editingProject.id)
    handleCloseEditDialog()
  }
  // 选择项目（已通过密码验证的项目可以直接访问）
  const handleSelectProject = async (project) => {
    if (project.projectKind === 'utility') {
      if (!isAdmin) {
        return
      }
      onProjectSelect(project)
      return
    }
    if (isAdmin) {
      onProjectSelect(project)
      return
    }
    onProjectSelect(project)
  }

  // 计算项目统计数据（使用 useMemo 缓存）
  const getProjectStats = useMemo(() => (project) => {
    if (project.projectKind === 'utility') {
      const n = project.utilitySheet?.rows?.length ?? 0
      return {
        totalProperties: n,
        rentedAndNewContract: 0,
        paidProperties: 0,
        paymentRate: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyProfit: 0,
        lastMonthIncome: 0,
        lastMonthExpenses: 0,
        lastMonthProfit: 0
      }
    }
    // 获取所有房源（默认分组 + 自定义分组）
    const properties = getAllProperties(project)
    const expenses = project.expenses || []
    
    const totalProperties = properties.length
    
    // 计算缴租率（出租中 + 新合同）- 使用当前状态
    const rentedAndNewContract = properties.filter(
      p => {
        const status = getCurrentPropertyStatus(p)
        return status === 'rented' || status === 'new-contract'
      }
    ).length
    
    // 计算本月和上月收支
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    
    // 计算上月日期
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear
    const lastMonthStr = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`
    
    let monthlyIncome = 0
    let monthlyExpenses = 0
    let lastMonthIncome = 0
    let lastMonthExpenses = 0
    let paidProperties = 0
    
    // 统计房源收支和缴租情况
    properties.forEach(property => {
      // 只统计出租中和新合同的房源 - 使用当前状态
      const status = getCurrentPropertyStatus(property)
      if (status === 'rented' || status === 'new-contract') {
        const hasPaid = property.records?.some(record => 
          record.date === currentMonthStr && (record.income || 0) > 0
        )
        if (hasPaid) {
          paidProperties++
        }
      }
      
      property.records?.forEach(record => {
        if (record.date === currentMonthStr) {
          monthlyIncome += record.income || 0
          monthlyExpenses += record.expenses || 0
        } else if (record.date === lastMonthStr) {
          lastMonthIncome += record.income || 0
          lastMonthExpenses += record.expenses || 0
        }
      })
    })
    
    // 统计项目开支
    expenses.forEach(expense => {
      expense.records?.forEach(record => {
        if (record.date === currentMonthStr) {
          monthlyIncome += record.income || 0
          monthlyExpenses += record.expenses || 0
        } else if (record.date === lastMonthStr) {
          lastMonthIncome += record.income || 0
          lastMonthExpenses += record.expenses || 0
        }
      })
    })
    
    // 缴租率 = 已缴租房间数 / (出租中 + 新合同房间数)
    const paymentRate = rentedAndNewContract > 0 
      ? (paidProperties / rentedAndNewContract * 100).toFixed(0) 
      : 0
    
    return {
      totalProperties,
      rentedAndNewContract,
      paidProperties,
      paymentRate,
      monthlyIncome,
      monthlyExpenses,
      monthlyProfit: monthlyIncome - monthlyExpenses,
      lastMonthIncome,
      lastMonthExpenses,
      lastMonthProfit: lastMonthIncome - lastMonthExpenses
    }
  }, [])

  return (
    <div className="space-y-8">
      {/* 欢迎区域 */}
      <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          欢迎使用租賃追蹤系统
        </h2>
        <p className="text-xl text-gray-600">
          房源租赁管理与收支追踪
        </p>
      </div>

      {/* 添加项目按钮 */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">项目列表</h3>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={onAddUtilityProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>➕</span>
              <span>创建水电单</span>
            </button>
            <button
              type="button"
              onClick={onAddProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>➕</span>
              <span>创建新项目</span>
            </button>
          </div>
        )}
      </div>

      {/* 项目卡片网格 */}
      {loadingProjects ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-md">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">加载项目中...</p>
        </div>
      ) : (() => {
        // 管理员：显示所有项目
        // 非管理员：只显示可访问的项目（通过后端验证）
        const displayProjects = (isAdmin ? projects : accessibleProjects).filter(
          (p) => p.visible !== false && (isAdmin || p.projectKind !== 'utility')
        )
        
        if (displayProjects.length === 0) {
          return (
            <div className="text-center py-16 bg-white rounded-lg shadow-md">
              <div className="text-6xl mb-4">🏢</div>
              <p className="text-xl text-gray-600 mb-2">
                {isAdmin ? '暂无项目' : '暂无可访问的项目'}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {isAdmin 
                  ? '点击上方按钮创建第一个项目' 
                  : userPassword ? '该密码无法访问任何项目，请重新输入' : '请输入项目密码以访问项目'}
              </p>
              {isAdmin ? (
                <button
                  onClick={onAddProject}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  立即创建
                </button>
              ) : (
                <button
                  onClick={() => setShowPasswordDialog(true)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  🔐 {userPassword ? '重新输入密码' : '输入密码访问项目'}
                </button>
              )}
            </div>
          )
        }
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" key={renderKey}>
            {displayProjects.map(project => {
              const stats = getProjectStats(project)
              
              // 管理员：所有项目都显示为已解锁
              // 非管理员：能看到的项目都是已解锁的（因为已经过滤过了）
              const shouldShowUnlocked = true
              
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  stats={stats}
                  isUnlocked={shouldShowUnlocked}
                  hasPassword={project.hasPassword}
                  isUtilityProject={project.projectKind === 'utility'}
                  onSelect={() => handleSelectProject(project)}
                  onUnlock={() => handleUnlockProject(project)}
                  onEdit={() => handleEditProject(project)}
                  isAdmin={isAdmin}
                />
              )
            })}
          </div>
        )
      })()}

      {/* 编辑项目对话框 */}
      {showEditDialog && editingProject && (
        <ProjectFormModal
          isOpen={showEditDialog}
          onClose={handleCloseEditDialog}
          onSubmit={handleSaveProject}
          onDelete={handleDeleteProject}
          initialData={editingProject}
          loading={editLoading}
          mode="edit"
        />
      )}
      
      {/* 解锁项目对话框 */}
      {showUnlockModal && unlockingProject && (
        <UnlockProjectModal
          isOpen={showUnlockModal}
          onClose={handleCloseUnlockModal}
          onUnlock={handleConfirmUnlock}
          projectName={unlockingProject.name}
          loading={unlockLoading}
        />
      )}

      {/* 版权信息 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">© 版权申明</h3>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-line">
{`租賃追蹤 (Rental Tracking)
版本：1.0
作者：CHRIS🇹🇭
Copyright © 2026 Notee.vip
保留所有权利`}
        </div>
      </div>
      
      {/* 项目密码输入对话框 */}
      <ProjectPasswordDialog
        isOpen={showPasswordDialog}
        onSubmit={handlePasswordSubmit}
        onClose={() => setShowPasswordDialog(false)}
      />
    </div>
  )
}

export default HomePage
