import { useState } from 'react'
import ProjectList from '../components/ProjectList'
import PropertyDetail from '../components/PropertyDetail'
import ProjectExpenseDetail from '../components/ProjectExpenseDetail'
import StatisticsPanel from '../components/StatisticsPanel'
import TimeSelector from '../components/TimeSelector'
import { getCurrentPropertyStatus, getStatusText, getStatusClassName } from '../utils/propertyStatus'

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

  // 添加新房源（管理员功能）
  const handleAddProperty = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    const propertyName = prompt('请输入房源编号：')
    if (!propertyName) return

    const monthlyRent = prompt('请输入月租金：')
    if (!monthlyRent || isNaN(monthlyRent)) {
      alert('请输入有效的租金金额')
      return
    }

    const deposit = prompt('请输入押金：', monthlyRent) // 默认押金等于租金
    if (!deposit || isNaN(deposit)) {
      alert('请输入有效的押金金额')
      return
    }

    const newProperty = {
      id: `property-${Date.now()}`,
      name: propertyName,
      monthlyRent: parseFloat(monthlyRent),
      deposit: parseFloat(deposit),
      tenant: null,
      records: []
    }

    const updatedProject = {
      ...project,
      properties: [...project.properties, newProperty]
    }
    onProjectUpdate(updatedProject)
  }

  // 删除房源（管理员功能）
  const handleDeleteProperty = (propertyId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这个房源吗？')) return

    const updatedProject = {
      ...project,
      properties: project.properties.filter(prop => prop.id !== propertyId)
    }
    onProjectUpdate(updatedProject)
    
    // 如果删除的是当前选中的房源，清空选中状态
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty(null)
    }
  }

  // 更新房源信息
  const handlePropertyUpdate = (updatedProperty) => {
    const updatedProject = {
      ...project,
      properties: project.properties.map(prop =>
        prop.id === updatedProperty.id ? updatedProperty : prop
      )
    }
    onProjectUpdate(updatedProject)
    setSelectedProperty(updatedProperty)
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

    const expenseName = prompt('请输入项目开支类别名称：')
    if (!expenseName) return

    const description = prompt('请输入说明（可选）：', '')

    const newExpense = {
      id: `expense-${Date.now()}`,
      name: expenseName,
      description: description || '',
      records: []
    }

    const updatedProject = {
      ...project,
      expenses: [...(project.expenses || []), newExpense]
    }
    onProjectUpdate(updatedProject)
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
  const handleExpenseUpdate = (updatedExpense) => {
    const updatedProject = {
      ...project,
      expenses: (project.expenses || []).map(exp =>
        exp.id === updatedExpense.id ? updatedExpense : exp
      )
    }
    onProjectUpdate(updatedProject)
    setSelectedExpense(updatedExpense)
  }

  // 将项目数据转换为 rentalData 格式（用于统计面板）
  const rentalData = {
    projects: [project]
  }

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
 * 房源列表面板组件（简化版，只显示当前项目的房源）
 */
function PropertyListPanel({ project, selectedProperty, onPropertySelect, onAddProperty, onDeleteProperty, isAdmin }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* 标题和添加按钮 */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">房源列表</h3>
        {isAdmin && (
          <button
            onClick={onAddProperty}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
            title="添加房源"
          >
            ➕ 房源
          </button>
        )}
      </div>

      {/* 房源列表 */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {project.properties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">暂无房源</p>
            <p className="text-sm">
              {isAdmin ? '点击上方按钮添加第一个房源' : '请联系管理员添加房源'}
            </p>
          </div>
        ) : (
          project.properties.map(property => (
            <div
              key={property.id}
              onClick={() => onPropertySelect(property)}
              className={`px-3 py-3 rounded-md cursor-pointer transition-colors ${
                selectedProperty?.id === property.id
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
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
                
                {/* 右列：状态 + 删除按钮 */}
                <div className="flex items-center justify-end gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusClassName(getCurrentPropertyStatus(property))}`}>
                    {getStatusText(getCurrentPropertyStatus(property))}
                  </span>
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
          ))
        )}
      </div>

      {/* 统计信息 */}
      {project.properties.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-xs text-gray-600">出租中</div>
              <div className="text-lg font-bold text-green-600">
                {project.properties.filter(p => getCurrentPropertyStatus(p) === 'rented').length}
              </div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-xs text-gray-600">新合同</div>
              <div className="text-lg font-bold text-blue-600">
                {project.properties.filter(p => getCurrentPropertyStatus(p) === 'new-contract').length}
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600">空置中</div>
              <div className="text-lg font-bold text-gray-600">
                {project.properties.filter(p => getCurrentPropertyStatus(p) === 'vacant').length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectDetailPage
