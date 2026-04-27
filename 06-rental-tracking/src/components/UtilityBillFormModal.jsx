import { useState, useEffect } from 'react'

const VARIANT_LABELS = {
  utility: { create: '➕ 创建水电单', edit: '✏️ 编辑水电单' },
  accounting: { create: '➕ 创建账目单', edit: '✏️ 编辑账目单' }
}

/**
 * 水电单 / 账目单弹窗：仅项目名称 + 描述（创建或编辑），样式对齐 ProjectFormModal
 * @param {'create'|'edit'} mode
 * @param {object|null} initialProject 编辑时传入当前项目（取 name / description）
 * @param {'utility'|'accounting'} variant 文案与用途（默认水电单）
 */
export function UtilityBillFormModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  mode = 'create',
  initialProject = null,
  variant = 'utility'
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const isEdit = mode === 'edit'
  const labels = VARIANT_LABELS[variant] || VARIANT_LABELS.utility

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && initialProject) {
      setName(typeof initialProject.name === 'string' ? initialProject.name : '')
      setDescription(
        typeof initialProject.description === 'string' ? initialProject.description : ''
      )
    } else {
      setName('')
      setDescription('')
    }
    setError('')
  }, [isOpen, isEdit, initialProject])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!name || name.trim() === '') {
      setError('项目名称不能为空')
      return
    }
    if (name.length > 255) {
      setError('项目名称不能超过255个字符')
      return
    }
    if (description && description.length > 1000) {
      setError('项目描述不能超过1000个字符')
      return
    }
    setError('')
    const result = await onSubmit({ name: name.trim(), description: description.trim() })
    if (!result.success) {
      setError(result.error || (isEdit ? '保存失败' : '创建失败'))
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUp my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEdit ? labels.edit : labels.create}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
            disabled={loading}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="utility-name" className="block text-sm font-medium text-gray-700 mb-2">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="utility-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              placeholder="请输入项目名称"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="utility-desc" className="block text-sm font-medium text-gray-700 mb-2">
              项目描述
            </label>
            <textarea
              id="utility-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
              placeholder="请输入项目描述（可选）"
              rows={3}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (isEdit ? '保存中...' : '创建中...') : isEdit ? '保存' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
