import { useState, useRef } from 'react'
import { getPropertyStatus, getCurrentPropertyStatus, getStatusText, getStatusClassName } from '../utils/propertyStatus'
import PhotoViewer from './PhotoViewer'
import { config } from '../config'
import { uploadService } from '../services'

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
  const [editingRecordIndex, setEditingRecordIndex] = useState(null)  // 正在编辑的记录索引
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [viewerPhotos, setViewerPhotos] = useState([])
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
  const [uploadingRecordIndex, setUploadingRecordIndex] = useState(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)  // 移动对话框
  const fileInputRef = useRef(null)
  const [recordForm, setRecordForm] = useState({
    date: '',
    income: 0,
    expenses: 0,
    note: '',
    isPaid: false // 是否已缴租
  })
  
  // 获取当前查看月份的状态
  const currentViewMonth = viewMode === 'month' 
    ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    : `${selectedYear}-01`
  const currentStatus = property ? getPropertyStatus(property, currentViewMonth) : 'vacant'
  
  // 🔍 调试日志
  console.log('=== PropertyDetail 状态调试 ===')
  console.log('currentViewMonth:', currentViewMonth)
  console.log('currentStatus:', currentStatus)
  console.log('property.status:', property?.status)
  console.log('property.records:', property?.records)
  console.log('=================================')
  
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

    if (propertyForm.deposit !== '' && propertyForm.deposit < 0) {
      alert('押金不能为负数')
      return
    }

    // 直接更新房源信息（不包括状态，状态在收支记录中修改）
    onPropertyUpdate({
      ...property,
      name: propertyForm.name,
      monthlyRent: parseFloat(propertyForm.monthlyRent),
      deposit: propertyForm.deposit && propertyForm.deposit !== '' ? parseFloat(propertyForm.deposit) : 0
    })
    setIsEditingProperty(false)
  }

  // 移动房源到其他分组（管理员功能）
  const handleMoveProperty = (targetGroupId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    // 通过 project 的 onPropertyUpdate 回调来处理移动
    // 这里需要传递特殊的标记，让父组件知道这是移动操作
    if (window.movePropertyToGroup) {
      window.movePropertyToGroup(property.id, targetGroupId)
      setShowMoveDialog(false)
    }
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

    // 检查当月是否已有缴租记录
    const hasMonthPaidRecord = property.records?.some(record => 
      record.date === dateStr && record.isPaid === true
    )

    setEditingRecordIndex(null)  // 清空编辑索引，表示是新增
    setRecordForm({
      date: dateStr,
      income: property.monthlyRent || 0,
      expenses: 0,
      note: '',
      isPaid: false,
      status: property.status || 'vacant',  // 初始化状态字段
      photos: [],  // 初始化照片数组
      _hasMonthPaidRecord: hasMonthPaidRecord // 用于UI判断
    })
    setShowRecordDialog(true)
  }
  
  // 编辑收支记录（管理员功能）
  const editRecord = (index) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }
    
    const record = property.records[index]
    
    // 检查当月是否已有其他缴租记录
    const hasMonthPaidRecord = property.records?.some((r, i) => 
      i !== index && r.date === record.date && r.isPaid === true
    )
    
    setEditingRecordIndex(index)
    setRecordForm({
      date: record.date,
      income: record.income || 0,
      expenses: record.expenses || 0,
      note: record.note || '',
      isPaid: record.isPaid || false,
      status: record.status || property.status || 'vacant',  // 添加status字段
      photos: record.photos || [],  // 保留照片数据
      _hasMonthPaidRecord: hasMonthPaidRecord
    })
    setShowRecordDialog(true)
  }

  // 保存收支记录
  const saveRecord = () => {
    // 🔍 调试日志
    console.log('=== saveRecord 调试信息 ===')
    console.log('recordForm.status:', recordForm.status)
    console.log('property.status:', property.status)
    console.log('editingRecordIndex:', editingRecordIndex)
    
    const newRecord = {
      date: recordForm.date,
      income: parseFloat(recordForm.income) || 0,
      expenses: parseFloat(recordForm.expenses) || 0,
      note: recordForm.note || '',
      isPaid: recordForm.isPaid || false,
      status: recordForm.status || property.status || 'vacant',  // 该月的独立状态
      photos: recordForm.photos || []  // 保留照片数据
    }
    
    console.log('newRecord.status:', newRecord.status)
    console.log('=========================')

    let updatedRecords
    let shouldUpdateGlobalStatus = false
    let newGlobalStatus = property.status
    
    if (editingRecordIndex !== null) {
      // 编辑模式：更新现有记录
      updatedRecords = property.records.map((record, i) => 
        i === editingRecordIndex ? newRecord : record
      )
      
      // 🎯 增强：编辑模式也支持智能逻辑
      // 如果编辑后的记录状态变为"新合同"，且房源当前是"空置中"
      if (newRecord.status === 'new-contract' && property.status === 'vacant') {
        // 检查除了当前编辑的记录外，是否已有其他"新合同"或"出租中"的记录
        const hasOtherActiveStatusRecords = (property.records || []).some((r, i) => 
          i !== editingRecordIndex && r.status && (r.status === 'new-contract' || r.status === 'rented')
        )
        
        if (!hasOtherActiveStatusRecords) {
          shouldUpdateGlobalStatus = true
          newGlobalStatus = 'rented'  // 设置为"出租中"
        }
      }
    } else {
      // 新增模式：添加新记录
      updatedRecords = [...(property.records || []), newRecord]
      
      // 🎯 智能逻辑：如果是新房源的第一条"新合同"记录，自动设置全局状态为"出租中"
      // 条件：
      // 1. 当前是新增记录（不是编辑）
      // 2. 新记录的状态是"新合同"
      // 3. 房源当前全局状态是"空置中"（说明是新房源）
      // 4. 这是第一条"新合同"或"出租中"的记录（忽略前序所有"空置中"的记录）
      if (newRecord.status === 'new-contract' && property.status === 'vacant') {
        // 检查是否已有"新合同"或"出租中"的记录（忽略"空置中"的记录）
        const hasActiveStatusRecords = (property.records || []).some(r => 
          r.status && (r.status === 'new-contract' || r.status === 'rented')
        )
        
        if (!hasActiveStatusRecords) {
          shouldUpdateGlobalStatus = true
          newGlobalStatus = 'rented'  // 设置为"出租中"
        }
      }
    }
    
    // 更新房源数据
    onPropertyUpdate({
      ...property,
      records: updatedRecords,
      status: shouldUpdateGlobalStatus ? newGlobalStatus : property.status
    })
    
    setShowRecordDialog(false)
    setEditingRecordIndex(null)
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

    // 上传到OSS
    try {
      // 使用uploadService批量上传
      const results = await uploadService.uploadPhotos(files)
      
      // 获取当前记录并添加照片
      const record = property.records[uploadingRecordIndex]
      const existingPhotos = record.photos || []
      const newPhotos = results.map(r => r.photo)
      const updatedPhotos = [...existingPhotos, ...newPhotos]

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
      alert(`照片上传失败: ${error.message}`)
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
  const deletePhoto = async (recordIndex, photoId) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这张照片吗？')) return

    try {
      // 使用uploadService删除照片
      await uploadService.deletePhoto(photoId)

      // 从记录中移除照片
      const record = property.records[recordIndex]
      const updatedPhotos = record.photos.filter(p => p.id !== photoId)
      
      const updatedRecords = property.records.map((r, i) => 
        i === recordIndex ? { ...r, photos: updatedPhotos } : r
      )

      onPropertyUpdate({
        ...property,
        records: updatedRecords
      })
    } catch (error) {
      console.error('删除照片失败:', error)
      alert(`删除照片失败: ${error.message}`)
    }
  }

  // 获取显示的记录（根据视图模式过滤）
  const getDisplayRecords = () => {
    if (!property.records) return []

    // 返回记录和原始索引
    return property.records
      .map((record, originalIndex) => ({ record, originalIndex }))
      .filter(({ record }) => {
        const [year, month] = record.date.split('-').map(Number)
        if (viewMode === 'month') {
          return year === selectedYear && month === selectedMonth
        } else {
          return year === selectedYear
        }
      })
      .sort((a, b) => b.record.date.localeCompare(a.record.date))
  }

  const displayRecords = getDisplayRecords()

  // 计算当前视图的总计
  const calculateTotals = () => {
    return displayRecords.reduce((acc, { record }) => ({
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
          <div className="flex gap-2">
            {!isEditingProperty && isAdmin && (
              <>
                <button
                  onClick={() => setShowMoveDialog(true)}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                >
                  移动
                </button>
                <button
                  onClick={editPropertyInfo}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                >
                  编辑
                </button>
              </>
            )}
          </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
              <input
                type="number"
                min="0"
                value={propertyForm.deposit}
                onChange={(e) => setPropertyForm({ ...propertyForm, deposit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入押金（可选）"
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
            displayRecords.map(({ record, originalIndex }) => (
              <div key={originalIndex} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
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
                              src={photo.url}
                              alt={photo.name || '照片'}
                              className="w-20 h-20 object-cover rounded-md cursor-pointer border-2 border-gray-200 hover:border-blue-500 transition-colors"
                              onClick={() => viewPhotos(record.photos, photoIndex)}
                              title="点击查看大图"
                            />
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePhoto(originalIndex, photo.id)
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
                        onClick={() => triggerPhotoUpload(originalIndex)}
                        className="text-blue-500 hover:text-blue-700"
                        title="上传照片"
                      >
                        📷
                      </button>
                      <button
                        onClick={() => editRecord(originalIndex)}
                        className="text-gray-600 hover:text-gray-800"
                        title="编辑记录"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteRecord(originalIndex)}
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
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {editingRecordIndex !== null ? '编辑收支记录' : '添加收支记录'}
              </h3>
              
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

                {/* 已缴租复选框 */}
                <div>
                  <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordForm.isPaid}
                      onChange={(e) => setRecordForm({ ...recordForm, isPaid: e.target.checked })}
                      disabled={recordForm._hasMonthPaidRecord}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${recordForm._hasMonthPaidRecord ? 'text-gray-400' : 'text-gray-700'}`}>
                        已缴租
                      </span>
                      {recordForm._hasMonthPaidRecord && (
                        <p className="text-xs text-gray-500 mt-1">
                          ⚠️ 本月已有缴租记录，无法重复标记
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                {/* 房源状态 - 单选框 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    房源状态
                  </label>
                  <div className="space-y-2">
                    {/* 空置中 */}
                    <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <input
                        type="radio"
                        name="propertyStatus"
                        value="vacant"
                        checked={(recordForm.status || property.status || 'vacant') === 'vacant'}
                        onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}
                        className="w-5 h-5 text-gray-600 border-gray-300 focus:ring-2 focus:ring-gray-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">空置中</span>
                        <p className="text-xs text-gray-500 mt-0.5">灰色背景显示</p>
                      </div>
                    </label>

                    {/* 新合同 */}
                    <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <input
                        type="radio"
                        name="propertyStatus"
                        value="new-contract"
                        checked={(recordForm.status || property.status || 'vacant') === 'new-contract'}
                        onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}
                        className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">新合同</span>
                        <p className="text-xs text-gray-500 mt-0.5">蓝色背景显示</p>
                      </div>
                    </label>

                    {/* 出租中 */}
                    <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <input
                        type="radio"
                        name="propertyStatus"
                        value="rented"
                        checked={(recordForm.status || property.status || 'vacant') === 'rented'}
                        onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value })}
                        className="w-5 h-5 text-green-600 border-gray-300 focus:ring-2 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">出租中</span>
                        <p className="text-xs text-gray-500 mt-0.5">白色背景显示</p>
                      </div>
                    </label>
                  </div>
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
                  onClick={() => {
                    setShowRecordDialog(false)
                    setEditingRecordIndex(null)
                  }}
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
      
      {/* 移动房源对话框 */}
      {showMoveDialog && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMoveDialog(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">
                🔄 移动房源
              </h3>
              <button
                onClick={() => setShowMoveDialog(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                将房源 <span className="font-medium text-gray-900">{property.name}</span> 移动到：
              </p>
              
              <div className="space-y-2">
                {(() => {
                  const groups = [
                    { id: 'default', name: '房源列表（默认）' }
                  ]
                  // 确保 propertyGroups 是数组
                  if (Array.isArray(project.propertyGroups) && project.propertyGroups.length > 0) {
                    groups.push(...project.propertyGroups.map(g => ({ id: g.id, name: g.name })))
                  }
                  
                  return groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => handleMoveProperty(group.id)}
                      className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors"
                    >
                      📁 {group.name}
                    </button>
                  ))
                })()}
              </div>
            </div>
            
            <div className="p-6 border-t">
              <button
                onClick={() => setShowMoveDialog(false)}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PropertyDetail
