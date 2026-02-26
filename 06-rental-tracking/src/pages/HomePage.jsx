import { useState, useEffect } from 'react'
import { updateProjectInfo } from '../utils/dataManagerAPI'
import * as api from '../utils/apiClient'
import { getCurrentPropertyStatus } from '../utils/propertyStatus'

/**
 * 主页组件
 * 
 * 功能：
 * - 显示所有项目的卡片列表
 * - 每个卡片显示项目基本信息和统计数据
 * - 点击卡片进入项目详情页
 * - 管理员功能：创建、编辑和删除项目
 * - 项目密码保护：需要输入密码才能查看项目详情
 */
function HomePage({ projects, onProjectSelect, onAddProject, onDeleteProject, onUpdateProject, isAdmin }) {
  const [editingProject, setEditingProject] = useState(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [unlockedProjects, setUnlockedProjects] = useState(new Set()) // 使用 Set 存储已解锁的项目ID

  // 检查项目是否已解锁
  const isProjectUnlocked = (projectId) => {
    return unlockedProjects.has(projectId)
  }

  // 解锁项目
  const unlockProject = (projectId) => {
    setUnlockedProjects(prev => new Set([...prev, projectId]))
  }

  // 当 isAdmin 变化时，清空解锁列表
  useEffect(() => {
    if (!isAdmin) {
      setUnlockedProjects(new Set())
    }
  }, [isAdmin])

  // 解锁项目
  const handleUnlockProject = async (project) => {
    const inputPassword = prompt(`请输入项目"${project.name}"的访问密码：`)
    if (!inputPassword) {
      return false
    }

    try {
      const response = await api.getProject(project.id, inputPassword)
      if (response.success) {
        unlockProject(project.id)
        alert('✅ 解锁成功')
        return true
      } else {
        alert('❌ 密码错误')
        return false
      }
    } catch (error) {
      console.error('验证密码失败:', error)
      alert('❌ 密码错误')
      return false
    }
  }

  // 打开编辑对话框
  const handleEditProject = (project) => {
    setEditingProject({
      ...project,
      password: project.password || '',
      visible: project.visible !== false // 默认显示
    })
    setShowEditDialog(true)
  }

  // 关闭编辑对话框
  const handleCloseEditDialog = () => {
    setShowEditDialog(false)
    setEditingProject(null)
  }

  // 保存项目编辑
  const handleSaveProject = async () => {
    if (!editingProject.name) {
      alert('请填写项目名称')
      return
    }
    
    try {
      await updateProjectInfo(editingProject.id, {
        name: editingProject.name,
        description: editingProject.description,
        password: editingProject.password,
        visible: editingProject.visible
      })
      
      // 调用父组件的更新函数重新加载数据
      onUpdateProject(editingProject)
      handleCloseEditDialog()
      alert('✅ 项目更新成功')
    } catch (error) {
      console.error('更新项目失败:', error)
      alert('❌ 更新项目失败：' + error.message)
    }
  }

  // 删除项目
  const handleDeleteProject = (projectId) => {
    if (confirm('确定要删除这个项目吗？所有房源和记录将被永久删除！')) {
      onDeleteProject(projectId)
      handleCloseEditDialog()
    }
  }
  // 选择项目（检查密码保护）
  const handleSelectProject = async (project) => {
    // 管理员直接访问
    if (isAdmin) {
      onProjectSelect(project)
      return
    }
    
    // 没有密码的项目直接访问
    if (!project.hasPassword) {
      onProjectSelect(project)
      return
    }
    
    // 有密码的项目，检查是否已解锁
    if (isProjectUnlocked(project.id)) {
      onProjectSelect(project)
      return
    }
    
    // 未解锁，需要输入密码
    const unlocked = await handleUnlockProject(project)
    if (unlocked) {
      onProjectSelect(project)
    }
  }

  // 计算项目统计数据
  const getProjectStats = (project) => {
    // 确保 properties 和 expenses 存在
    const properties = project.properties || []
    const expenses = project.expenses || []
    
    const totalProperties = properties.length
    
    // 计算缴租率（出租中 + 新合同）- 使用当前状态
    const rentedAndNewContract = properties.filter(
      p => {
        const status = getCurrentPropertyStatus(p)
        return status === 'rented' || status === 'new-contract'
      }
    ).length
    
    // 计算本月收支
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
    
    let monthlyIncome = 0
    let monthlyExpenses = 0
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
        }
      })
    })
    
    // 统计项目开支
    expenses.forEach(expense => {
      expense.records?.forEach(record => {
        if (record.date === currentMonthStr) {
          monthlyIncome += record.income || 0
          monthlyExpenses += record.expenses || 0
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
      monthlyProfit: monthlyIncome - monthlyExpenses
    }
  }

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
          <button
            onClick={onAddProject}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>➕</span>
            <span>创建新项目</span>
          </button>
        )}
      </div>

      {/* 项目卡片网格 */}
      {(() => {
        // 过滤可见的项目（管理员可以看到所有项目）
        const visibleProjects = isAdmin 
          ? projects 
          : projects.filter(p => p.visible !== false)
        
        if (visibleProjects.length === 0) {
          return (
            <div className="text-center py-16 bg-white rounded-lg shadow-md">
              <div className="text-6xl mb-4">🏢</div>
              <p className="text-xl text-gray-600 mb-2">暂无项目</p>
              <p className="text-sm text-gray-500 mb-6">
                {isAdmin ? '点击上方按钮创建第一个项目' : '请联系管理员创建项目'}
              </p>
              {isAdmin && (
                <button
                  onClick={onAddProject}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  立即创建
                </button>
              )}
            </div>
          )
        }
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleProjects.map(project => {
              const stats = getProjectStats(project)
              
              // 判断是否应该显示为已解锁状态
              // 1. 管理员 -> 显示为已解锁
              // 2. 没有密码 -> 显示为已解锁
              // 3. 有密码且已解锁 -> 显示为已解锁
              // 4. 有密码且未解锁 -> 显示为锁定
              const shouldShowUnlocked = isAdmin || !project.hasPassword || isProjectUnlocked(project.id)
              
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  stats={stats}
                  isUnlocked={shouldShowUnlocked}
                  hasPassword={project.hasPassword}
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
        <ProjectEditDialog
          project={editingProject}
          onSave={handleSaveProject}
          onDelete={() => handleDeleteProject(editingProject.id)}
          onClose={handleCloseEditDialog}
          onChange={setEditingProject}
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
    </div>
  )
}

/**
 * 项目卡片组件
 */
function ProjectCard({ project, stats, isUnlocked, hasPassword, onSelect, onUnlock, onEdit, isAdmin }) {
  // 如果项目被锁定，显示锁定状态
  if (!isUnlocked) {
    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        {/* 卡片头部 - 锁定状态 */}
        <div className="bg-gradient-to-r from-gray-400 to-gray-500 p-6 text-white">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-gray-200 line-clamp-2">{project.description}</p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="text-white hover:text-gray-200 ml-2 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title="编辑项目"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>

        {/* 锁定内容区域 */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-600 mb-4 text-center">此项目需要密码访问</p>
          <button
            onClick={onUnlock}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            输入密码解锁
          </button>
        </div>
      </div>
    )
  }

  // 解锁状态 - 显示完整信息
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      {/* 卡片头部 - 渐变背景 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{project.name}</h3>
              {hasPassword && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded" title="此项目有密码保护">
                  🔐
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-blue-100 line-clamp-2">{project.description}</p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="text-white hover:text-blue-200 ml-2 px-2 py-1 rounded hover:bg-white/10 transition-colors"
              title="编辑项目"
            >
              ⚙️
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div>
            <span className="text-blue-100">房源数</span>
            <span className="ml-2 font-bold text-lg">{stats.totalProperties}</span>
          </div>
          <div>
            <span className="text-blue-100">缴租率</span>
            <span className="ml-2 font-bold text-lg">{stats.paymentRate}%</span>
          </div>
        </div>
      </div>

      {/* 卡片内容 - 统计数据 */}
      <div className="p-6">
        <div className="space-y-3">
          {/* 本月收入 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">本月收入</span>
            <span className="text-lg font-bold text-blue-600">
              ฿{stats.monthlyIncome.toLocaleString()}
            </span>
          </div>

          {/* 本月支出 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">本月支出</span>
            <span className="text-lg font-bold text-orange-600">
              ฿{stats.monthlyExpenses.toLocaleString()}
            </span>
          </div>

          {/* 本月净利润 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-600">本月净利润</span>
            <span className={`text-lg font-bold ${stats.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ฿{stats.monthlyProfit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 查看详情按钮 */}
        <button
          onClick={onSelect}
          className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          查看详情 →
        </button>
      </div>
    </div>
  )
}

/**
 * 项目编辑对话框组件
 */
function ProjectEditDialog({ project, onSave, onDelete, onClose, onChange }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">编辑项目</h3>
          
          <div className="space-y-4">
            {/* 项目名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                项目名称 *
              </label>
              <input
                type="text"
                value={project.name}
                onChange={(e) => onChange({ ...project, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入项目名称"
              />
            </div>

            {/* 项目描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                项目描述
              </label>
              <textarea
                value={project.description || ''}
                onChange={(e) => onChange({ ...project, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入项目描述"
                rows="3"
              />
            </div>

            {/* 访问密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                访问密码（可选）
              </label>
              <input
                type="password"
                value={project.password || ''}
                onChange={(e) => onChange({ ...project, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="留空表示无需密码"
              />
              <p className="text-xs text-gray-500 mt-1">
                设置后，访问此项目需要输入密码
              </p>
            </div>

            {/* 显示状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                显示状态
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={project.visible !== false}
                    onChange={() => onChange({ ...project, visible: true })}
                    className="mr-2"
                  />
                  <span className="text-sm">显示（在主页显示此项目）</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={project.visible === false}
                    onChange={() => onChange({ ...project, visible: false })}
                    className="mr-2"
                  />
                  <span className="text-sm">隐藏（在主页隐藏此项目）</span>
                </label>
              </div>
            </div>
          </div>

          {/* 按钮组 */}
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={onSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
            <button
              onClick={onDelete}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              🗑️ 删除项目
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
