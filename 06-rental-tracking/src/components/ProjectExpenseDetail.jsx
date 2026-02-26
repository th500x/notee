import { useState } from 'react'
import PhotoViewer from './PhotoViewer'

/**
 * 项目开支详情组件
 * 
 * 功能：
 * - 显示项目级别的开支信息（不针对具体房源）
 * - 记录和显示收支明细
 * - 支持月度和年度视图
 * - 管理员功能：添加/删除记录
 * - 支持上传和查看照片凭证
 */
function ProjectExpenseDetail({ expense, project, selectedYear, selectedMonth, viewMode, onExpenseUpdate, isAdmin }) {
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  const [viewerPhotos, setViewerPhotos] = useState([])
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
  // 如果没有选中项目开支，显示提示
  if (!expense) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-lg">请从左侧选择一个项目开支类别</p>
          <p className="text-sm mt-2">选择后可以查看和管理开支详情</p>
        </div>
      </div>
    )
  }

  // 添加收支记录（管理员功能）
  const addRecord = async () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    const dateStr = viewMode === 'month' 
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${selectedYear}-01` // 年度视图默认添加1月

    const income = prompt('请输入收入金额（元）：', 0)
    if (income === null) return

    const expenses = prompt('请输入支出金额（元）：', 0)
    if (expenses === null) return

    const note = prompt('备注（可选）：', '')

    // 创建文件选择器
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.multiple = true
    
    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files)
      
      // 限制最多3张照片
      if (files.length > 3) {
        alert('最多只能上传3张照片')
        return
      }

      // 检查文件大小（每张不超过2MB）
      const oversizedFiles = files.filter(f => f.size > 2 * 1024 * 1024)
      if (oversizedFiles.length > 0) {
        alert('照片大小不能超过2MB，请压缩后再上传')
        return
      }

      // 转换为Base64
      const photos = await Promise.all(
        files.map(file => new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            resolve({
              id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              data: e.target.result,
              name: file.name,
              size: file.size,
              uploadedAt: new Date().toISOString()
            })
          }
          reader.readAsDataURL(file)
        }))
      )

      const newRecord = {
        date: dateStr,
        income: parseFloat(income) || 0,
        expenses: parseFloat(expenses) || 0,
        note: note || '',
        photos: photos
      }

      const updatedRecords = [...(expense.records || []), newRecord]
      onExpenseUpdate({
        ...expense,
        records: updatedRecords
      })
    }

    // 询问是否上传照片
    if (confirm('是否要上传照片凭证？（最多3张，每张不超过2MB）')) {
      fileInput.click()
    } else {
      // 不上传照片，直接保存
      const newRecord = {
        date: dateStr,
        income: parseFloat(income) || 0,
        expenses: parseFloat(expenses) || 0,
        note: note || '',
        photos: []
      }

      const updatedRecords = [...(expense.records || []), newRecord]
      onExpenseUpdate({
        ...expense,
        records: updatedRecords
      })
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

    const record = expense.records[recordIndex]
    const updatedPhotos = record.photos.filter(p => p.id !== photoId)
    
    const updatedRecords = expense.records.map((r, i) => 
      i === recordIndex ? { ...r, photos: updatedPhotos } : r
    )

    onExpenseUpdate({
      ...expense,
      records: updatedRecords
    })
  }

  // 删除记录（管理员功能）
  const deleteRecord = (index) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这条记录吗？')) return

    const updatedRecords = expense.records.filter((_, i) => i !== index)
    onExpenseUpdate({
      ...expense,
      records: updatedRecords
    })
  }

  // 获取显示的记录（根据视图模式过滤）
  const getDisplayRecords = () => {
    if (!expense.records) return []

    return expense.records.filter(record => {
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
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{expense.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{project.name} - 项目开支</p>
          </div>
        </div>

        {expense.description && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">说明</p>
            <p className="text-base text-gray-900">{expense.description}</p>
          </div>
        )}
      </div>

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
                    <button
                      onClick={() => deleteRecord(index)}
                      className="text-red-500 hover:text-red-700 ml-4"
                      title="删除记录"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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

export default ProjectExpenseDetail
