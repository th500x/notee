import { useState, useEffect } from 'react';

/**
 * 创建税费单：名称 + 描述 + 必选「房源来源」账目单
 * 编辑税费单元信息：仅名称 + 描述（mode=edit）
 */
export function TaxBillFormModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  mode = 'create',
  initialProject = null,
  accountingProjects = []
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceAccountingProjectId, setSourceAccountingProjectId] = useState('');
  const [error, setError] = useState('');

  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && initialProject) {
      setName(typeof initialProject.name === 'string' ? initialProject.name : '');
      setDescription(
        typeof initialProject.description === 'string' ? initialProject.description : ''
      );
      setSourceAccountingProjectId('');
    } else {
      setName('');
      setDescription('');
      setSourceAccountingProjectId(
        accountingProjects.length === 1 ? accountingProjects[0].id : ''
      );
    }
    setError('');
  }, [isOpen, isEdit, initialProject, accountingProjects]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!name || name.trim() === '') {
      setError('项目名称不能为空');
      return;
    }
    if (name.length > 255) {
      setError('项目名称不能超过255个字符');
      return;
    }
    if (description && description.length > 1000) {
      setError('项目描述不能超过1000个字符');
      return;
    }
    if (!isEdit) {
      if (!sourceAccountingProjectId) {
        setError('请选择房源来源账目单');
        return;
      }
      if (accountingProjects.length === 0) {
        setError('暂无账目单，请先创建账目单');
        return;
      }
    }
    setError('');
    const payload = isEdit
      ? { name: name.trim(), description: description.trim() }
      : {
          name: name.trim(),
          description: description.trim(),
          sourceAccountingProjectId
        };
    const result = await onSubmit(payload);
    if (!result.success) {
      setError(result.error || (isEdit ? '保存失败' : '创建失败'));
    }
  };

  if (!isOpen) return null;

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
            {isEdit ? '✏️ 编辑税费单' : '➕ 创建税费单'}
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
            <label htmlFor="tax-name" className="block text-sm font-medium text-gray-700 mb-2">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              id="tax-name"
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
            <label htmlFor="tax-desc" className="block text-sm font-medium text-gray-700 mb-2">
              项目描述
            </label>
            <textarea
              id="tax-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
              placeholder="请输入项目描述（可选）"
              rows={3}
              disabled={loading}
            />
          </div>

          {!isEdit ? (
            <div>
              <label
                htmlFor="tax-source"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                房源来源 <span className="text-red-500">*</span>
              </label>
              <select
                id="tax-source"
                value={sourceAccountingProjectId}
                onChange={(e) => setSourceAccountingProjectId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-white"
                disabled={loading || accountingProjects.length === 0}
              >
                <option value="">请选择账目单</option>
                {accountingProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.accountingSheet?.rentRows?.length != null
                      ? `（${p.accountingSheet.rentRows.length} 个 ROOM）`
                      : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                创建时将复制所选账目单中全部 ROOM 行到本税费单（房号与账目单一致）。
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : null}
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
  );
}
