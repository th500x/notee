import { useState, useEffect, useMemo } from 'react'
import ProjectList from '../components/ProjectList'
import PropertyDetail from '../components/PropertyDetail'
import ProjectExpenseDetail from '../components/ProjectExpenseDetail'
import StatisticsPanel from '../components/StatisticsPanel'
import TimeSelector from '../components/TimeSelector'
import { AddPropertyModal } from '../components/AddPropertyModal'
import { AddExpenseModal } from '../components/AddExpenseModal'
import { getCurrentPropertyStatus, getStatusText, getStatusClassName, getCurrentPropertyBackgroundColor, getPropertyBackgroundColor, getPropertyStatus } from '../utils/propertyStatus'
import { updateProjectRecords } from '../utils/dataManagerAPI'

/**
 * 项目详情页组件
 * 
 * 功能：
 * - 显示项目的统计面板
 * - 左侧：房源列表
 * - 右侧：选中房源的详细信息
 * - 管理员功能：添加和删除房源
 */
function ProjectDetailPage({ project, onBack, onProjectUpdate, isAdmin }) {
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [viewMode, setViewMode] = useState('month') // 'month' | 'year'
  const [viewType, setViewType] = useState('property') // 'property' | 'expense'
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false)
  const [addPropertyLoading, setAddPropertyLoading] = useState(false)
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false)
  const [addExpenseLoading, setAddExpenseLoading] = useState(false)

  // 添加新房源（管理员功能）
  const handleAddProperty = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    setShowAddPropertyModal(true)
  }
  
  // 确认添加房源
  const handleConfirmAddProperty = async (formData) => {
    setAddPropertyLoading(true)
    
    try {
      const newProperty = {
        id: `property-${Date.now()}`,
        name: formData.name,
        monthlyRent: formData.monthlyRent,
        deposit: formData.deposit,
        status: 'vacant',  // 默认状态为空置中
        tenant: null,
        records: []
      }

      const targetGroupId = formData.targetGroupId || 'default'
      let updatedProject = { ...project }
      
      if (targetGroupId === 'default') {
        // 添加到默认分组
        updatedProject.properties = [...(project.properties || []), newProperty]
      } else {
        // 添加到指定的自定义分组
        updatedProject.propertyGroups = (project.propertyGroups || []).map(group => {
          if (group.id === targetGroupId) {
            return {
              ...group,
              properties: [...(group.properties || []), newProperty]
            }
          }
          return group
        })
      }
      
      await onProjectUpdate(updatedProject)
      setShowAddPropertyModal(false)
      
      return { success: true }
    } catch (error) {
      console.error('添加房源失败:', error)
      return {
        success: false,
        error: error.message || '添加房源失败'
      }
    } finally {
      setAddPropertyLoading(false)
    }
  }

  // 删除房源（管理员功能）
  const handleDeleteProperty = (propertyId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这个房源吗？')) return

    // 查找房源在哪个分组
    let foundInDefault = false
    let foundInGroup = null
    
    // 检查默认分组
    if (project.properties) {
      foundInDefault = project.properties.some(p => p.id === propertyId)
    }
    
    // 检查自定义分组
    if (!foundInDefault && project.propertyGroups) {
      for (const group of project.propertyGroups) {
        if (group.properties?.some(p => p.id === propertyId)) {
          foundInGroup = group.id
          break
        }
      }
    }
    
    let updatedProject = { ...project }
    
    if (foundInDefault) {
      // 从默认分组删除
      updatedProject.properties = project.properties.filter(prop => prop.id !== propertyId)
    } else if (foundInGroup) {
      // 从自定义分组删除
      updatedProject.propertyGroups = project.propertyGroups.map(group => {
        if (group.id === foundInGroup) {
          return {
            ...group,
            properties: group.properties.filter(prop => prop.id !== propertyId)
          }
        }
        return group
      })
    }
    
    onProjectUpdate(updatedProject)
    
    // 如果删除的是当前选中的房源，清空选中状态
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(null)
    }
  }
  
  // 移动房源到其他分组（管理员功能）
  const handleMoveProperty = (propertyId, targetGroupId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    // 查找房源在哪个分组
    let sourceProperty = null
    let sourceGroupId = null
    
    // 检查默认分组
    if (project.properties) {
      sourceProperty = project.properties.find(p => p.id === propertyId)
      if (sourceProperty) {
        sourceGroupId = 'default'
      }
    }
    
    // 检查自定义分组
    if (!sourceProperty && project.propertyGroups) {
      for (const group of project.propertyGroups) {
        sourceProperty = group.properties?.find(p => p.id === propertyId)
        if (sourceProperty) {
          sourceGroupId = group.id
          break
        }
      }
    }
    
    if (!sourceProperty) {
      alert('未找到房源')
      return
    }
    
    if (sourceGroupId === targetGroupId) {
      alert('房源已在该分组中')
      return
    }
    
    // 构建更新后的项目数据
    let updatedProject = { ...project }
    
    // 从源分组移除
    if (sourceGroupId === 'default') {
      updatedProject.properties = project.properties.filter(p => p.id !== propertyId)
    } else {
      updatedProject.propertyGroups = project.propertyGroups.map(group => {
        if (group.id === sourceGroupId) {
          return {
            ...group,
            properties: group.properties.filter(p => p.id !== propertyId)
          }
        }
        return group
      })
    }
    
    // 添加到目标分组
    if (targetGroupId === 'default') {
      updatedProject.properties = [...(updatedProject.properties || []), sourceProperty]
    } else {
      updatedProject.propertyGroups = (updatedProject.propertyGroups || []).map(group => {
        if (group.id === targetGroupId) {
          return {
            ...group,
            properties: [...(group.properties || []), sourceProperty]
          }
        }
        return group
      })
    }
    
    onProjectUpdate(updatedProject)
    alert('✅ 房源移动成功')
  }
  
  // 将移动函数挂载到 window，供 PropertyDetail 调用
  useEffect(() => {
    window.movePropertyToGroup = handleMoveProperty
    return () => {
      delete window.movePropertyToGroup
    }
  }, [project, isAdmin])

  // 更新房源信息
  const handlePropertyUpdate = async (updatedProperty) => {
    try {
      // 查找房源在哪个分组
      let foundInDefault = false
      let foundInGroup = null
      
      // 检查默认分组
      if (project.properties) {
        foundInDefault = project.properties.some(p => p.id === updatedProperty.id)
      }
      
      // 检查自定义分组
      if (!foundInDefault && project.propertyGroups) {
        for (const group of project.propertyGroups) {
          if (group.properties?.some(p => p.id === updatedProperty.id)) {
            foundInGroup = group.id
            break
          }
        }
      }
      
      let updatedProject = { ...project }
      
      if (foundInDefault) {
        // 更新默认分组中的房源
        updatedProject.properties = project.properties.map(prop =>
          prop.id === updatedProperty.id ? updatedProperty : prop
        )
      } else if (foundInGroup) {
        // 更新自定义分组中的房源
        updatedProject.propertyGroups = project.propertyGroups.map(group => {
          if (group.id === foundInGroup) {
            return {
              ...group,
              properties: group.properties.map(prop =>
                prop.id === updatedProperty.id ? updatedProperty : prop
              )
            }
          }
          return group
        })
      }
      
      // 发送更新请求（包含 properties 和 propertyGroups）
      await updateProjectRecords(project.id, { 
        properties: updatedProject.properties,
        propertyGroups: updatedProject.propertyGroups
      })
      
      onProjectUpdate(updatedProject)
      setSelectedProperty(updatedProperty)
    } catch (error) {
      console.error('更新房源失败:', error)
      alert('更新房源失败：' + error.message)
    }
  }

  // 选择房源
  const handlePropertySelect = (property) => {
    setSelectedProperty(property)
    setSelectedExpense(null)
    setViewType('property')
  }

  // 选择项目开支
  const handleExpenseSelect = (expense) => {
    setSelectedExpense(expense)
    setSelectedProperty(null)
    setViewType('expense')
  }

  // 添加项目开支类别（管理员功能）
  const handleAddExpense = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    setShowAddExpenseModal(true)
  }
  
  // 确认添加项目开支
  const handleConfirmAddExpense = async (formData) => {
    setAddExpenseLoading(true)
    
    try {
      const newExpense = {
        id: `expense-${Date.now()}`,
        name: formData.name,
        description: formData.description || '',
        records: []
      }

      const updatedProject = {
        ...project,
        expenses: [...(project.expenses || []), newExpense]
      }
      
      await onProjectUpdate(updatedProject)
      setShowAddExpenseModal(false)
      
      return { success: true }
    } catch (error) {
      console.error('添加项目开支失败:', error)
      return {
        success: false,
        error: error.message || '添加项目开支失败'
      }
    } finally {
      setAddExpenseLoading(false)
    }
  }

  // 删除项目开支类别（管理员功能）
  const handleDeleteExpense = (expenseId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这个项目开支类别吗？')) return

    const updatedProject = {
      ...project,
      expenses: (project.expenses || []).filter(exp => exp.id !== expenseId)
    }
    onProjectUpdate(updatedProject)
    
    // 如果删除的是当前选中的开支，清空选中状态
    if (selectedExpense && selectedExpense.id === expenseId) {
      setSelectedExpense(null)
    }
  }

  // 更新项目开支信息
  const handleExpenseUpdate = async (updatedExpense) => {
    try {
      // 使用新的 API：只更新收支记录，不触碰基本信息
      const updatedExpenses = (project.expenses || []).map(exp =>
        exp.id === updatedExpense.id ? updatedExpense : exp
      )
      
      // 只更新 expenses，不触碰 properties 和其他基本信息
      await updateProjectRecords(project.id, { 
        expenses: updatedExpenses 
      })
      
      // 更新本地状态
      const updatedProject = {
        ...project,
        expenses: updatedExpenses
      }
      onProjectUpdate(updatedProject)
      setSelectedExpense(updatedExpense)
    } catch (error) {
      console.error('更新项目开支失败:', error)
      alert('更新项目开支失败：' + error.message)
    }
  }

  // 将项目数据转换为 rentalData 格式（用于统计面板，使用 useMemo 缓存）
  const rentalData = useMemo(() => ({
    projects: [project]
  }), [project])

  return (
    <div className="space-y-6">
      {/* 返回按钮和项目标题 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>←</span>
          <span>返回项目列表</span>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* 时间选择器和统计面板 */}
      <div className="space-y-4">
        <TimeSelector
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          viewMode={viewMode}
          onYearChange={setSelectedYear}
          onMonthChange={setSelectedMonth}
          onViewModeChange={setViewMode}
        />
        <StatisticsPanel
          rentalData={rentalData}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          viewMode={viewMode}
        />
      </div>

      {/* 主体内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：项目开支和房源列表 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 项目开支卡片 */}
          <ProjectExpensePanel
            project={project}
            selectedExpense={selectedExpense}
            onExpenseSelect={handleExpenseSelect}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            isAdmin={isAdmin}
          />
          
          {/* 房源列表卡片 */}
          <PropertyListPanel
            project={project}
            selectedProperty={selectedProperty}
            onPropertySelect={handlePropertySelect}
            onAddProperty={handleAddProperty}
            onDeleteProperty={handleDeleteProperty}
            isAdmin={isAdmin}
            viewMode={viewMode}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
          />
        </div>

        {/* 右侧：详情显示 */}
        <div className="lg:col-span-2">
          {viewType === 'expense' ? (
            <ProjectExpenseDetail
              expense={selectedExpense}
              project={project}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              viewMode={viewMode}
              onExpenseUpdate={handleExpenseUpdate}
              isAdmin={isAdmin}
            />
          ) : (
            <PropertyDetail
              property={selectedProperty}
              project={project}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              viewMode={viewMode}
              onPropertyUpdate={handlePropertyUpdate}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
      
      {/* 添加项目开支对话框 */}
      <AddExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        onAdd={handleConfirmAddExpense}
        loading={addExpenseLoading}
      />
      
      {/* 添加房源对话框 */}
      <AddPropertyModal
        isOpen={showAddPropertyModal}
        onClose={() => setShowAddPropertyModal(false)}
        onAdd={handleConfirmAddProperty}
        loading={addPropertyLoading}
        availableGroups={(() => {
          const groups = [
            { id: 'default', name: '房源列表（默认）' }
          ]
          if (project.propertyGroups && project.propertyGroups.length > 0) {
            groups.push(...project.propertyGroups.map(g => ({ id: g.id, name: g.name })))
          }
          return groups
        })()}
      />
    </div>
  )
}

/**
 * 项目开支面板组件
 */
function ProjectExpensePanel({ project, selectedExpense, onExpenseSelect, onAddExpense, onDeleteExpense, isAdmin }) {
  const expenses = project.expenses || []

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* 标题和添加按钮 */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">项目开支</h3>
        {isAdmin && (
          <button
            onClick={onAddExpense}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
            title="添加项目开支类别"
          >
            ➕ 项目
          </button>
        )}
      </div>

      {/* 开支类别列表 */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {expenses.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <p className="mb-2 text-sm">暂无项目开支类别</p>
            <p className="text-xs">
              {isAdmin ? '点击上方按钮添加' : '请联系管理员添加'}
            </p>
          </div>
        ) : (
          expenses.map(expense => (
            <div
              key={expense.id}
              onClick={() => onExpenseSelect(expense)}
              className={`px-3 py-3 rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                selectedExpense?.id === expense.id
                  ? 'bg-purple-100 border-2 border-purple-500'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg flex-shrink-0">📊</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{expense.name}</div>
                  {expense.description && (
                    <div className="text-xs text-gray-600 truncate mt-0.5">
                      {expense.description}
                    </div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteExpense(expense.id)
                  }}
                  className="text-red-500 hover:text-red-700 text-sm ml-2 flex-shrink-0"
                  title="删除项目开支类别"
                >
                  🗑️
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * 房源列表面板组件（支持分组显示）
 */
function PropertyListPanel({ project, selectedProperty, onPropertySelect, onAddProperty, onDeleteProperty, isAdmin, viewMode, selectedYear, selectedMonth }) {
  const [collapsedGroups, setCollapsedGroups] = useState({})
  
  // 动态导入导出函数
  const handleExport = async () => {
    const { exportPropertiesToImage, getAllPropertiesForExport } = await import('../utils/exportToImage')
    const { getCurrentPropertyStatus } = await import('../utils/propertyStatus')
    
    const allProperties = getAllPropertiesForExport(project)
    
    // 只导出"新合同"和"出租中"的房源，过滤掉"空置中"
    const activeProperties = allProperties.filter(property => {
      const status = getCurrentPropertyStatus(property)
      return status === 'rented' || status === 'new-contract'
    })
    
    if (activeProperties.length === 0) {
      alert('暂无出租中或新合同的房源可导出')
      return
    }
    
    exportPropertiesToImage(activeProperties, project.name, selectedYear, selectedMonth)
  }
  
  // 获取所有分组（默认分组 + 自定义分组）
  const getAllGroups = () => {
    const groups = [
      {
        id: 'default',
        name: '房源列表',
        properties: project.properties || []
      }
    ]
    
    if (project.propertyGroups && project.propertyGroups.length > 0) {
      groups.push(...project.propertyGroups)
    }
    
    return groups
  }
  
  const groups = getAllGroups()
  const hasMultipleGroups = groups.length > 1
  
  // 切换分组折叠状态
  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }
  
  // 渲染单个房源卡片
  const renderPropertyCard = (property) => {
    const viewMonth = viewMode === 'month' 
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${selectedYear}-01`
    const bgColor = getPropertyBackgroundColor(property, viewMonth)
    const hasPaid = property.records?.some(r => r.date === viewMonth && r.isPaid === true)
    
    return (
      <div
        key={property.id}
        onClick={() => onPropertySelect(property)}
        className={`px-3 py-3 rounded-md cursor-pointer transition-colors ${
          selectedProperty?.id === property.id
            ? 'bg-blue-100 border-2 border-blue-500'
            : `${bgColor} border-2 border-transparent`
        }`}
      >
        {/* 4列布局：房源编号 | 租金 | 押金 | 状态 */}
        <div className="grid grid-cols-4 gap-2 items-center">
          {/* 左列：房源编号 */}
          <div className="text-sm font-medium truncate">
            {property.name}
          </div>
          
          {/* 第二列：租金 */}
          <div className="text-xs text-gray-600 text-center">
            <div className="text-[10px] text-gray-500">租金</div>
            <div>฿{property.monthlyRent}</div>
          </div>
          
          {/* 第三列：押金 */}
          <div className="text-xs text-gray-600 text-center">
            <div className="text-[10px] text-gray-500">押金</div>
            <div>฿{property.deposit || 0}</div>
          </div>
          
          {/* 右列：缴租状态 + 删除按钮 */}
          <div className="flex items-center justify-end gap-2">
            {hasPaid && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                已缴租
              </span>
            )}
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteProperty(property.id)
                }}
                className="text-red-500 hover:text-red-700 text-sm flex-shrink-0"
                title="删除房源"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // 计算统计数据
  const calculateStats = () => {
    const viewMonth = viewMode === 'month' 
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${selectedYear}-01`
    
    let allProperties = []
    groups.forEach(group => {
      allProperties = [...allProperties, ...(group.properties || [])]
    })
    
    return {
      rented: allProperties.filter(p => getPropertyStatus(p, viewMonth) === 'rented').length,
      newContract: allProperties.filter(p => getPropertyStatus(p, viewMonth) === 'new-contract').length,
      vacant: allProperties.filter(p => getPropertyStatus(p, viewMonth) === 'vacant').length
    }
  }
  
  const stats = calculateStats()
  const totalProperties = stats.rented + stats.newContract + stats.vacant

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* 标题和按钮 */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">房源列表</h3>
        {isAdmin && (
          <div className="flex gap-2">
            {viewMode === 'month' && (
              <button
                onClick={handleExport}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                title="导出当月房源列表"
              >
                📊 导出
              </button>
            )}
            <button
              onClick={onAddProperty}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              title="添加房源"
            >
              ➕ 房源
            </button>
          </div>
        )}
      </div>

      {/* 分组列表 */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {totalProperties === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">暂无房源</p>
            <p className="text-sm">
              {isAdmin ? '点击上方按钮添加第一个房源' : '请联系管理员添加房源'}
            </p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="space-y-2">
              {/* 分组标题（仅在有多个分组时显示） */}
              {hasMultipleGroups && (
                <div
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {collapsedGroups[group.id] ? '▶' : '▼'}
                  </span>
                  <span className="text-sm font-medium text-gray-700 flex-1">
                    {group.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {group.properties?.length || 0} 个房源
                  </span>
                </div>
              )}
              
              {/* 房源列表（未折叠时显示） */}
              {!collapsedGroups[group.id] && (
                <div className="space-y-2">
                  {group.properties && group.properties.length > 0 ? (
                    group.properties.map(property => renderPropertyCard(property))
                  ) : (
                    hasMultipleGroups && (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        此分组暂无房源
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 统计信息 */}
      {totalProperties > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-xs text-gray-600">出租中</div>
              <div className="text-lg font-bold text-green-600">
                {stats.rented}
              </div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-xs text-gray-600">新合同</div>
              <div className="text-lg font-bold text-blue-600">
                {stats.newContract}
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600">空置中</div>
              <div className="text-lg font-bold text-gray-600">
                {stats.vacant}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDetailPage
