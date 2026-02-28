import { useState, useRef } from 'react'
import { getPropertyStatus, getCurrentPropertyStatus, getStatusText, getStatusClassName } from '../utils/propertyStatus'
import PhotoViewer from './PhotoViewer'

/**
 * 房源详情组件
 * 
 * 功能：
 * - 显示房源基本信息
 * - 管理租客信息（姓名、人数、起租日期、到期日期）
 * - 记录和显示收支明细
 * - 支持月度和年度视图
 * - 管理员功能：标记出租/空置/新合同、编辑租客、添加/删除记录
 * 
 * 注意：tenant.phone 字段存储的是租客人数（历史原因保留字段名）
 */
function PropertyDetail({ property, project, selectedYear, selectedMonth, viewMode, onPropertyUpdate, isAdmin }) {
  const [isEditingProperty, setIsEditingProperty] = useState(false)
  const [isEditingTenant, setIsEditingTenant] = useState(false)
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [viewerPhotos, setViewerPhotos] = useState([])
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
  const [uploadingRecordIndex, setUploadingRecordIndex] = useState(null)
  const fileInputRef = useRef(null)
  const [recordForm, setRecordForm] = useState({
    date: '',
    income: 0,
    expenses: 0,
    note: '',
    status: '' // 手动设置的状态（可选）
  })
  
  // 获取当前查看月份的状态
  const currentViewMonth = viewMode === 'month' 
    ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    : `${selectedYear}-01`
  const currentStatus = property ? getPropertyStatus(property, currentViewMonth) : 'vacant'
  
  const [tenantForm, setTenantForm] = useState({
    name: '',
    phone: '',
    startDate: '',
    endDate: ''
  })
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    monthlyRent: 0,
    deposit: 0
  })

  // 如果没有选中房源，显示提示
  if (!property) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">🏠</div>
          <p className="text-lg">请从左侧选择一个房源</p>
          <p className="text-sm mt-2">选择后可以查看和管理房源详情</p>
        </div>
      </div>
    )
  }

  // 切换房源状态（管理员功能）
  const changeStatus = (newStatus) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (newStatus === 'rented') {
      // 标记为出租中：需要填写租客信息
      setIsEditingTenant(true)
      setTenantForm({
        name: '',
        phone: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
      })
    } else if (newStatus === 'vacant') {
      // 标记为空置
      if (confirm('确定要将此房源标记为空置吗？租客信息将被清除。')) {
        onPropertyUpdate({
          ...property,
          status: 'vacant',
          tenant: null
        })
      }
    } else if (newStatus === 'new-contract') {
      // 标记为新合同
      onPropertyUpdate({
        ...property,
        status: 'new-contract'
      })
    }
  }

  // 保存租客信息（管理员功能）
  const saveTenantInfo = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!tenantForm.name || !tenantForm.startDate) {
      alert('请选择租住时长和起租日期')
      return
    }

    // 保持原有状态，不自动改变
    onPropertyUpdate({
      ...property,
      tenant: tenantForm
    })
    setIsEditingTenant(false)
  }

  // 编辑租客信息（管理员功能）
  const editTenantInfo = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    setTenantForm(property.tenant || {
      name: '',
      phone: '',
      startDate: '',
      endDate: ''
    })
    setIsEditingTenant(true)
  }

  // 编辑房源基本信息（管理员功能）
  const editPropertyInfo = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    setPropertyForm({
      name: property.name,
      monthlyRent: property.monthlyRent,
      deposit: property.deposit || 0
    })
    setIsEditingProperty(true)
  }

  // 保存房源基本信息（管理员功能）
  const savePropertyInfo = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!propertyForm.name) {
      alert('请填写房源编号')
      return
    }

    if (!propertyForm.monthlyRent || propertyForm.monthlyRent <= 0) {
      alert('请填写有效的月租金')
      return
    }

    if (!propertyForm.deposit || propertyForm.deposit < 0) {
      alert('请填写有效的押金')
      return
    }

    onPropertyUpdate({
      ...property,
      name: propertyForm.name,
      monthlyRent: parseFloat(propertyForm.monthlyRent),
      deposit: parseFloat(propertyForm.deposit)
    })
    setIsEditingProperty(false)
  }

  // 添加收支记录（管理员功能）
  const addRecord = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    const dateStr = viewMode === 'month' 
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${selectedYear}-01`

    // 获取该月的自动推断状态
    const autoStatus = getPropertyStatus(property, dateStr)

    setRecordForm({
      date: dateStr,
      income: property.monthlyRent || 0,
      expenses: 0,
      note: '',
      status: autoStatus // 默认使用自动推断的状态
    })
    setShowRecordDialog(true)
  }

  // 保存收支记录
  const saveRecord = () => {
    const newRecord = {
      date: recordForm.date,
      income: parseFloat(recordForm.income) || 0,
      expenses: parseFloat(recordForm.expenses) || 0,
      note: recordForm.note || ''
    }

    // 如果手动设置了状态，添加到记录中
    if (recordForm.status) {
      newRecord.status = recordForm.status
    }

    const updatedRecords = [...(property.records || []), newRecord]
    onPropertyUpdate({
      ...property,
      records: updatedRecords
    })
    setShowRecordDialog(false)
  }

  // 删除记录（管理员功能）
  const deleteRecord = (index) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这条记录吗？')) return

    const updatedRecords = property.records.filter((_, i) => i !== index)
    onPropertyUpdate({
      ...property,
      records: updatedRecords
    })
  }

  // 处理文件选择
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    
    if (uploadingRecordIndex === null) return
    
    // 如果用户取消选择，直接返回
    if (files.length === 0) {
      setUploadingRecordIndex(null)
      e.target.value = ''
      return
    }
    
    // 限制最多3张照片
    if (files.length > 3) {
      alert('最多只能上传3张照片')
      e.target.value = ''
      return
    }

    // 检查文件大小（每张不超过2MB）
    const oversizedFiles = files.filter(f => f.size > 2 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      alert('照片大小不能超过2MB，请压缩后再上传')
      e.target.value = ''
      return
    }

    // 转换为Base64
    try {
      const photos = await Promise.all(
        files.map(file => new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              data: e.target.result,
              name: file.name,
              size: file.size,
              uploadedAt: new Date().toISOString()
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        }))
      )

      // 获取当前记录并添加照片
      const record = property.records[uploadingRecordIndex]
      const existingPhotos = record.photos || []
      const updatedPhotos = [...existingPhotos, ...photos]

      // 更新记录
      const updatedRecords = property.records.map((r, i) => 
        i === uploadingRecordIndex ? { ...r, photos: updatedPhotos } : r
      )

      onPropertyUpdate({
        ...property,
        records: updatedRecords
      })
      
      setUploadingRecordIndex(null)
    } catch (error) {
      console.error('照片上传失败:', error)
      alert('照片上传失败，请重试')
    }
    
    // 重置文件输入
    e.target.value = ''
  }

  // 触发照片上传
  const triggerPhotoUpload = (recordIndex) => {
    setUploadingRecordIndex(recordIndex)
    // 直接触发文件选择
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // 查看照片
  const viewPhotos = (photos, initialIndex = 0) => {
    setViewerPhotos(photos)
    setViewerInitialIndex(initialIndex)
    setShowPhotoViewer(true)
  }

  // 删除照片
  const deletePhoto = (recordIndex, photoId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这张照片吗？')) return

    const record = property.records[recordIndex]
    const updatedPhotos = record.photos.filter(p => p.id !== photoId)
    
    const updatedRecords = property.records.map((r, i) => 
      i === recordIndex ? { ...r, photos: updatedPhotos } : r
    )

    onPropertyUpdate({
      ...property,
      records: updatedRecords
    })
  }

  // 获取显示的记录（根据视图模式过滤）
  const getDisplayRecords = () => {
    if (!property.records) return []

    return property.records.filter(record => {
      const [year, month] = record.date.split('-').map(Number)
      if (viewMode === 'month') {
        return year === selectedYear && month === selectedMonth
      } else {
        return year === selectedYear
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }

  const displayRecords = getDisplayRecords()

  // 计算当前视图的总计
  const calculateTotals = () => {
    return displayRecords.reduce((acc, record) => ({
      income: acc.income + (record.income || 0),
      expenses: acc.expenses + (record.expenses || 0)
    }), { income: 0, expenses: 0 })
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      {/* 基本信息卡片 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">房源信息</h3>
          {!isEditingProperty && isAdmin && (
            <button
              onClick={editPropertyInfo}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              编辑
            </button>
          )}
        </div>

        {isEditingProperty ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">房源编号 *</label>
              <input
                type="text"
                value={propertyForm.name}
                onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入房源编号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">月租金 *</label>
              <input
                type="number"
                min="0"
                value={propertyForm.monthlyRent}
                onChange={(e) => setPropertyForm({ ...propertyForm, monthlyRent: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入月租金"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金 *</label>
              <input
                type="number"
                min="0"
                value={propertyForm.deposit}
                onChange={(e) => setPropertyForm({ ...propertyForm, deposit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入押金"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={savePropertyInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => setIsEditingProperty(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">房源编号</p>
              <p className="text-base font-medium">{property.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">租金</p>
              <p className="text-base font-medium text-blue-600">฿{property.monthlyRent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">押金</p>
              <p className="text-base font-medium text-purple-600">฿{(property.deposit || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">房源状态</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusClassName(currentStatus)}`}>
                {getStatusText(currentStatus)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 租客信息卡片 */}
      {((currentStatus === 'rented' || currentStatus === 'new-contract') || isEditingTenant) && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">租客信息</h3>
            {(currentStatus === 'rented' || currentStatus === 'new-contract') && !isEditingTenant && isAdmin && (
              <button
                onClick={editTenantInfo}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
              >
                编辑
              </button>
            )}
          </div>

          {isEditingTenant ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">租住时长 *</label>
                <select
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择租住时长</option>
                  <option value="<1年">&lt;1年</option>
                  <option value="1-2年">1-2年</option>
                  <option value=">2年">&gt;2年</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">租客人数</label>
                <select
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择租客人数</option>
                  <option value="1">1人</option>
                  <option value="2">2人</option>
                  <option value="3">3人</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">起租日期 *</label>
                  <input
                    type="date"
                    value={tenantForm.startDate}
                    onChange={(e) => setTenantForm({ ...tenantForm, startDate: e.target.value })}
                    onKeyDown={(e) => {
                      // 当输入完整日期后，按Enter键自动跳转到下一个字段
                      if (e.key === 'Enter' && tenantForm.startDate) {
                        e.preventDefault()
                        const endDateInput = e.target.parentElement.nextElementSibling?.querySelector('input')
                        if (endDateInput) endDateInput.focus()
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">到期日期</label>
                  <input
                    type="date"
                    value={tenantForm.endDate}
                    onChange={(e) => setTenantForm({ ...tenantForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveTenantInfo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsEditingTenant(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">租住时长</p>
                <p className="text-base font-medium">{property.tenant?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">租客人数</p>
                <p className="text-base font-medium">{property.tenant?.phone || '-'} 人</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">起租日期</p>
                <p className="text-base font-medium">{property.tenant?.startDate || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">到期日期</p>
                <p className="text-base font-medium">{property.tenant?.endDate || '-'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 收支记录卡片 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            收支记录 ({viewMode === 'month' ? `${selectedYear}年${selectedMonth}月` : `${selectedYear}年`})
          </h3>
          {isAdmin && (
            <button
              onClick={addRecord}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
            >
              ➕ 添加记录
            </button>
          )}
        </div>

        {/* 统计汇总 */}
        {displayRecords.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">总收入</p>
              <p className="text-lg font-bold text-blue-600">฿{totals.income.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">总支出</p>
              <p className="text-lg font-bold text-orange-600">฿{totals.expenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">净收益</p>
              <p className={`text-lg font-bold ${totals.income - totals.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ฿{(totals.income - totals.expenses).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* 记录列表 */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无记录</p>
              {isAdmin && <p className="text-sm mt-2">点击上方按钮添加收支记录</p>}
            </div>
          ) : (
            displayRecords.map((record, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {record.date}
                      </span>
                      <span className="text-sm text-blue-600">
                        收入: ฿{record.income.toLocaleString()}
                      </span>
                      <span className="text-sm text-orange-600">
                        支出: ฿{record.expenses.toLocaleString()}
                      </span>
                    </div>
                    {record.note && (
                      <p className="text-sm text-gray-600 mb-2">备注: {record.note}</p>
                    )}
                    
                    {/* 照片缩略图 */}
                    {record.photos && record.photos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {record.photos.map((photo, photoIndex) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.data}
                              alt={photo.name || '照片'}
                              className="w-20 h-20 object-cover rounded-md cursor-pointer border-2 border-gray-200 hover:border-blue-500 transition-colors"
                              onClick={() => viewPhotos(record.photos, photoIndex)}
                              title="点击查看大图"
                            />
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePhoto(index, photo.id)
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                title="删除照片"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center text-xs text-gray-500">
                          📷 {record.photos.length} 张
                        </div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => triggerPhotoUpload(index)}
                        className="text-blue-500 hover:text-blue-700"
                        title="上传照片"
                      >
                        📷
                      </button>
                      <button
                        onClick={() => deleteRecord(index)}
                        className="text-red-500 hover:text-red-700"
                        title="删除记录"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 添加/编辑记录对话框 */}
      {showRecordDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">添加收支记录</h3>
              
              <div className="space-y-4">
                {/* 日期 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日期
                  </label>
                  <input
                    type="text"
                    value={recordForm.date}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>

                {/* 收入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    收入（฿）
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={recordForm.income}
                    onChange={(e) => setRecordForm({ ...recordForm, income: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 支出 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    支出（฿）
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={recordForm.expenses}
                    onChange={(e) => setRecordForm({ ...recordForm, expenses: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 房源状态（手动覆盖） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    房源状态（可选覆盖）
                  </label>
                  <select
                    value={recordForm.status}
                    onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">自动推断（推荐）</option>
                    <option value="vacant">空置中</option>
                    <option value="new-contract">新合同</option>
                    <option value="rented">出租中</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    默认根据租客信息自动推断，如有特殊情况可手动选择
                  </p>
                </div>

                {/* 备注 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    备注
                  </label>
                  <textarea
                    value={recordForm.note}
                    onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="2"
                    placeholder="可选"
                  />
                </div>
              </div>

              {/* 按钮 */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={saveRecord}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => setShowRecordDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* 照片查看器 */}
      {showPhotoViewer && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerInitialIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </div>
  )
}

export default PropertyDetail
