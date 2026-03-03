/**
 * 房源基本信息组件
 */
function PropertyInfo({ property, isEditing, form, onFormChange, onSave, onCancel, onEdit, isAdmin }) {
  if (isEditing) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <h3 className="text-lg font-semibold mb-3">编辑房源信息</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">房源名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">月租金</label>
            <input
              type="number"
              value={form.monthlyRent}
              onChange={(e) => onFormChange({ ...form, monthlyRent: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
            <input
              type="number"
              value={form.deposit}
              onChange={(e) => onFormChange({ ...form, deposit: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">{property.name}</h3>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            编辑
          </button>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">月租金：</span>
          <span className="font-medium">¥{property.monthlyRent?.toLocaleString() || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">押金：</span>
          <span className="font-medium">¥{property.deposit?.toLocaleString() || 0}</span>
        </div>
      </div>
    </div>
  );
}

export default PropertyInfo;
