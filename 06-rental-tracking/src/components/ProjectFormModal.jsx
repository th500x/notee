import { useState, useEffect } from 'react'

/**
 * 项目表单弹窗组件（通用）
 * 
 * @param {boolean} isOpen - 是否显示对话框
 * @param {function} onClose - 关闭对话框回调
 * @param {function} onSubmit - 提交表单回调
 * @param {function} onDelete - 删除项目回调（仅编辑模式）
 * @param {object} initialData - 初始数据（编辑模式）
 * @param {boolean} loading - 加载状态
 * @param {string} mode - 模式：'create' | 'edit'
 */
export function ProjectFormModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete,
  initialData = null,
  loading = false,
  mode = 'create' 
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    password: '',
    visible: true,
    propertyGroups: [],
    properties: []  // 添加 properties 字段
  })
  const [error, setError] = useState('')
  
  // 重置或加载数据
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
          name: initialData.name || '',
          description: initialData.description || '',
          password: initialData.password || '',
          visible: initialData.visible !== false,
          // 确保 propertyGroups 是数组
          propertyGroups: Array.isArray(initialData.propertyGroups) ? initialData.propertyGroups : [],
          // 确保 properties 是数组
          properties: Array.isArray(initialData.properties) ? initialData.properties : []
        })
      } else {
        setFormData({
          name: '',
          description: '',
          password: '',
          visible: true,
          propertyGroups: [],
          properties: []
        })
      }
      setError('')
    }
  }, [isOpen, mode, initialData])
  
  const handleSubmit = async () => {
    // 前端验证
    if (!formData.name || formData.name.trim() === '') {
      setError('项目名称不能为空')
      return
    }
    
    if (formData.name.length > 255) {
      setError('项目名称不能超过255个字符')
      return
    }
    
    if (formData.description && formData.description.length > 1000) {
      setError('项目描述不能超过1000个字符')
      return
    }
    
    // 创建模式：密码必填
    if (mode === 'create' && (!formData.password || formData.password.trim() === '')) {
      setError('项目密码不能为空')
      return
    }
    
    if (formData.password && formData.password.length < 6) {
      setError('项目密码至少6个字符')
      return
    }
    
    if (formData.password && formData.password.length > 50) {
      setError('项目密码不能超过50个字符')
      return
    }
    
    setError('')
    const result = await onSubmit(formData)
    
    if (!result.success) {
      setError(result.error || (mode === 'create' ? '创建失败' : '更新失败'))
    }
  }
  
  const handleDelete = () => {
    if (confirm('确定要删除这个项目吗？所有房源和记录将被永久删除！')) {
      onDelete()
    }
  }
  
  // 预定义的分组选项
  const PREDEFINED_GROUPS = [
    { id: 'group-x', name: '房源列表 - X' },
    { id: 'group-y', name: '房源列表 - Y' },
    { id: 'group-z', name: '房源列表 - Z' }
  ]
  
  // 切换分组（勾选/取消勾选）
  const handleToggleGroup = (groupId, groupName) => {
    const exists = formData.propertyGroups.some(g => g.id === groupId)
    
    if (exists) {
      // 取消勾选：删除分组，并将房源移动到默认分组
      const group = formData.propertyGroups.find(g => g.id === groupId)
      
      if (group && group.properties && group.properties.length > 0) {
        if (!confirm(`分组"${group.name}"中有 ${group.properties.length} 个房源，删除后这些房源将被移动到默认分组。确定要删除吗？`)) {
          return
        }
        
        // 将分组中的房源移动到默认分组
        setFormData({
          ...formData,
          properties: [...(formData.properties || []), ...group.properties],
          propertyGroups: formData.propertyGroups.filter(g => g.id !== groupId)
        })
      } else {
        // 空分组，直接删除
        setFormData({
          ...formData,
          propertyGroups: formData.propertyGroups.filter(g => g.id !== groupId)
        })
      }
    } else {
      // 勾选：添加分组
      const newGroup = {
        id: groupId,
        name: groupName,
        collapsed: false,
        properties: []
      }
      
      setFormData({
        ...formData,
        propertyGroups: [...formData.propertyGroups, newGroup]
      })
    }
  }
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  if (!isOpen) return null
  
  const isEditMode = mode === 'edit'
  const title = isEditMode ? '✏️ 编辑项目' : '➕ 创建新项目'
  const submitText = isEditMode ? '保存' : '确认'
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
            disabled={loading}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 space-y-4">
          {/* 项目名称 */}
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-2">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="请输入项目名称"
              autoFocus
              disabled={loading}
            />
          </div>
          
          {/* 项目描述 */}
          <div>
            <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-2">
              项目描述
            </label>
            <textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
              placeholder="请输入项目描述（可选）"
              rows="3"
              disabled={loading}
            />
          </div>
          
          {/* 访问密码 */}
          <div>
            <label htmlFor="project-password" className="block text-sm font-medium text-gray-700 mb-2">
              访问密码 {mode === 'create' && <span className="text-red-500">*</span>}
            </label>
            <input
              id="project-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
              placeholder={mode === 'create' ? '请设置项目密码（必填）' : '留空保持原密码不变'}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {mode === 'create' 
                ? '密码至少6个字符，用于访问此项目' 
                : '留空保持原密码不变，输入新密码则更新'}
            </p>
          </div>
          
          {/* 显示状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              显示状态
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={formData.visible === true}
                  onChange={() => setFormData({ ...formData, visible: true })}
                  className="mr-2 w-4 h-4 text-blue-600"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">显示（在主页显示此项目）</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={formData.visible === false}
                  onChange={() => setFormData({ ...formData, visible: false })}
                  className="mr-2 w-4 h-4 text-blue-600"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700">隐藏（在主页隐藏此项目）</span>
              </label>
            </div>
          </div>
          
          {/* 房源分组管理 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              房源分组
            </label>
            <div className="space-y-2">
              {/* 默认分组 */}
              <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  className="mr-3 w-4 h-4 text-gray-400 cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 flex-1">📁 房源列表（默认）</span>
                <span className="text-xs text-gray-500">必选</span>
              </div>
              
              {/* 预定义分组复选框 */}
              {PREDEFINED_GROUPS.map(group => {
                const isChecked = formData.propertyGroups.some(g => g.id === group.id)
                return (
                  <label
                    key={group.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleGroup(group.id, group.name)}
                      className="mr-3 w-4 h-4 text-blue-600 cursor-pointer"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700">📁 {group.name}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              勾选需要的分组，可以帮助您更好地组织和管理房源
            </p>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t space-y-2">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (isEditMode ? '保存中...' : '创建中...') : submitText}
            </button>
          </div>
          
          {/* 删除按钮（仅编辑模式） */}
          {isEditMode && onDelete && (
            <button
              onClick={handleDelete}
              className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              🗑️ 删除项目
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
