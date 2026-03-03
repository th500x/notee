import { getPropertyStatus, getStatusText, getStatusClassName } from '../../utils/propertyStatus';

/**
 * 租客信息组件
 */
function TenantInfo({ 
  property, 
  currentViewMonth,
  isEditing, 
  form, 
  onFormChange, 
  onSave, 
  onCancel, 
  onChangeStatus,
  isAdmin 
}) {
  const currentStatus = getPropertyStatus(property, currentViewMonth);
  const tenant = property.tenant;

  if (isEditing) {
    return (
      <div className="bg-green-50 p-4 rounded-lg mb-4">
        <h3 className="text-lg font-semibold mb-3">编辑租客信息</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">租客姓名</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">租客人数</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              placeholder="例如：2人"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">起租日期</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => onFormChange({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">到期日期</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => onFormChange({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              保存
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">租客信息</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusClassName(currentStatus)}`}>
          {getStatusText(currentStatus)}
        </span>
      </div>
      
      {tenant ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">姓名：</span>
            <span className="font-medium">{tenant.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">人数：</span>
            <span className="font-medium">{tenant.phone || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">起租日期：</span>
            <span className="font-medium">{tenant.startDate || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">到期日期：</span>
            <span className="font-medium">{tenant.endDate || '-'}</span>
          </div>
          {isAdmin && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => onChangeStatus('new-contract')}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                新合同
              </button>
              <button
                onClick={() => onChangeStatus('vacant')}
                className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                标记空置
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-500 mb-3">暂无租客</p>
          {isAdmin && (
            <button
              onClick={() => onChangeStatus('rented')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              标记为出租
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TenantInfo;
