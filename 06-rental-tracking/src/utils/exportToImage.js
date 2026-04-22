/**
 * 导出房源列表为图片
 * 
 * 功能：
 * - 生成当月房源列表的图片表单
 * - 包含：房源编号、租金、押金、已缴租/缴租日
 * - 自动下载图片
 */

import { getAllProperties } from './propertyUtils'

/**
 * 导出房源列表为图片
 * @param {Array} properties - 房源列表
 * @param {string} projectName - 项目名称
 * @param {number} year - 年份
 * @param {number} month - 月份
 */
export async function exportPropertiesToImage(properties, projectName, year, month) {
  // 创建 canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // 设置画布尺寸
  const padding = 40
  const headerHeight = 80
  const rowHeight = 50
  const columnWidths = [150, 150, 150, 200] // 房源编号、租金、押金、缴租状态
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + padding * 2
  const totalHeight = headerHeight + rowHeight * (properties.length + 1) + padding * 2
  
  canvas.width = totalWidth
  canvas.height = totalHeight
  
  // 设置背景色
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 设置字体
  ctx.font = 'bold 24px Arial, sans-serif'
  ctx.fillStyle = '#1f2937'
  ctx.textAlign = 'center'
  
  // 绘制标题
  const title = `${projectName} - ${year}年${month}月房源列表`
  ctx.fillText(title, canvas.width / 2, padding + 30)
  
  // 绘制表格
  const tableStartY = padding + headerHeight
  
  // 表头
  const headers = ['房源编号', '租金（฿）', '押金（฿）', '缴租状态']
  ctx.font = 'bold 18px Arial, sans-serif'
  ctx.fillStyle = '#374151'
  
  let currentX = padding
  headers.forEach((header, index) => {
    const centerX = currentX + columnWidths[index] / 2
    ctx.fillText(header, centerX, tableStartY + 30)
    currentX += columnWidths[index]
  })
  
  // 绘制表头下划线
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, tableStartY + 45)
  ctx.lineTo(canvas.width - padding, tableStartY + 45)
  ctx.stroke()
  
  // 绘制数据行
  ctx.font = '16px Arial, sans-serif'
  const currentMonth = `${year}-${String(month).padStart(2, '0')}`
  
  properties.forEach((property, index) => {
    const rowY = tableStartY + rowHeight * (index + 1) + 30
    
    // 检查是否已缴租
    const hasPaid = property.records?.some(r => r.date === currentMonth && r.isPaid === true)
    
    // 计算缴租日（从起租日期判断）
    let paymentStatus = '未缴租'
    if (hasPaid) {
      paymentStatus = 'Paid'
    } else if (property.tenant && property.tenant.startDate) {
      // 从起租日期提取日期
      const startDate = new Date(property.tenant.startDate)
      const day = startDate.getDate()
      paymentStatus = `${month}/${day}`
    }
    
    // 数据
    const rowData = [
      property.name,
      property.monthlyRent.toLocaleString(),
      (property.deposit || 0).toLocaleString(),
      paymentStatus
    ]
    
    // 绘制数据
    ctx.fillStyle = '#1f2937'
    currentX = padding
    rowData.forEach((data, colIndex) => {
      const centerX = currentX + columnWidths[colIndex] / 2
      ctx.fillText(data, centerX, rowY)
      currentX += columnWidths[colIndex]
    })
    
    // 绘制行分隔线
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, rowY + 15)
    ctx.lineTo(canvas.width - padding, rowY + 15)
    ctx.stroke()
  })
  
  // 绘制外边框
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 2
  ctx.strokeRect(padding, tableStartY, canvas.width - padding * 2, rowHeight * (properties.length + 1))
  
  // 绘制列分隔线
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  currentX = padding
  for (let i = 0; i < columnWidths.length - 1; i++) {
    currentX += columnWidths[i]
    ctx.beginPath()
    ctx.moveTo(currentX, tableStartY)
    ctx.lineTo(currentX, tableStartY + rowHeight * (properties.length + 1))
    ctx.stroke()
  }
  
  // 转换为图片并下载
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${projectName}_${year}年${month}月房源列表.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

/**
 * 获取所有房源（包括默认分组和自定义分组）
 * @param {Object} project - 项目对象
 * @returns {Array} 所有房源列表
 */
export function getAllPropertiesForExport(project) {
  return getAllProperties(project)
}

function utilRowUsage(row, pricePerKwh, pricePerWaterUnit) {
  const le = Number(row.lastMonthElectric) || 0
  const ce = Number(row.currentMonthElectric) || 0
  const lw = Number(row.lastMonthWater) || 0
  const cw = Number(row.currentMonthWater) || 0
  const electricUnits = Math.max(0, ce - le)
  const waterUnits = Math.max(0, cw - lw)
  const pk = Number(pricePerKwh) || 0
  const pw = Number(pricePerWaterUnit) || 0
  const subtotal = electricUnits * pk + waterUnits * pw
  return { electricUnits, waterUnits, subtotal }
}

/**
 * Export utility meter sheet as PNG (English labels; same canvas pattern as property list export).
 * @param {object} sheet - utilitySheet from API
 * @param {string} projectName - project display name
 */
export async function exportUtilityBillToImage(sheet, projectName) {
  const safeName = (projectName || 'utility').replace(/[\\/:*?"<>|]/g, '_')
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const pk = Number(sheet?.pricePerKwh) || 0
  const pw = Number(sheet?.pricePerWaterUnit) || 0
  const monthLabel = sheet?.readingMonthText || '—'
  const dateLabel = sheet?.readingDateText || '—'

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const padding = 40
  const headerBlock = 100
  const rowHeight = 46
  const columnWidths = [100, 100, 100, 88, 100, 100, 88, 100]
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0) + padding * 2
  const tableRows = Math.max(rows.length, 1)
  const totalHeight = padding + headerBlock + rowHeight * (tableRows + 2) + padding + 40

  canvas.width = totalWidth
  canvas.height = totalHeight

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillStyle = '#1f2937'
  ctx.textAlign = 'center'
  ctx.fillText(`${projectName || 'Project'} — Utility meter reading`, canvas.width / 2, padding + 28)

  ctx.font = '15px Arial, sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.textAlign = 'center'
  ctx.fillText(`Billing month: ${monthLabel}     Reading date: ${dateLabel}`, canvas.width / 2, padding + 52)
  ctx.fillText(
    `Price per kWh: ${pk}     Price per water unit: ${pw}`,
    canvas.width / 2,
    padding + 74
  )

  const tableStartY = padding + headerBlock
  const headers = [
    'Unit',
    'Last elec.',
    'Curr. elec.',
    'kWh',
    'Last water',
    'Curr. water',
    'Water u.',
    'Subtotal (THB)'
  ]

  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillStyle = '#374151'
  let currentX = padding
  headers.forEach((header, index) => {
    const centerX = currentX + columnWidths[index] / 2
    ctx.textAlign = 'center'
    ctx.fillText(header, centerX, tableStartY + 28)
    currentX += columnWidths[index]
  })

  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(padding, tableStartY + 40)
  ctx.lineTo(canvas.width - padding, tableStartY + 40)
  ctx.stroke()

  let totalE = 0
  let totalW = 0
  let totalAmt = 0

  ctx.font = '14px Arial, sans-serif'
  if (rows.length === 0) {
    ctx.fillStyle = '#9ca3af'
    ctx.textAlign = 'center'
    ctx.fillText('No rows', canvas.width / 2, tableStartY + rowHeight + 20)
  } else {
    rows.forEach((row, index) => {
      const { electricUnits, waterUnits, subtotal } = utilRowUsage(row, pk, pw)
      totalE += electricUnits
      totalW += waterUnits
      totalAmt += subtotal
      const rowY = tableStartY + rowHeight * (index + 1) + 28
      const rowData = [
        String(row.roomNumber ?? ''),
        String(row.lastMonthElectric ?? ''),
        String(row.currentMonthElectric ?? ''),
        electricUnits.toFixed(2),
        String(row.lastMonthWater ?? ''),
        String(row.currentMonthWater ?? ''),
        waterUnits.toFixed(2),
        subtotal.toFixed(2)
      ]
      ctx.fillStyle = '#1f2937'
      currentX = padding
      rowData.forEach((data, colIndex) => {
        const centerX = currentX + columnWidths[colIndex] / 2
        ctx.textAlign = 'center'
        ctx.fillText(data, centerX, rowY)
        currentX += columnWidths[colIndex]
      })
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padding, rowY + 14)
      ctx.lineTo(canvas.width - padding, rowY + 14)
      ctx.stroke()
    })
  }

  const footY = tableStartY + rowHeight * (rows.length + 1) + 36
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillStyle = '#1d4ed8'
  ctx.textAlign = 'left'
  ctx.fillText(`Total kWh: ${totalE.toFixed(2)}`, padding, footY)
  ctx.fillText(`Total water units: ${totalW.toFixed(2)}`, padding + 220, footY)
  ctx.fillStyle = '#15803d'
  ctx.fillText(`Grand total (THB): ${totalAmt.toFixed(2)}`, padding + 460, footY)

  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 2
  ctx.strokeRect(
    padding,
    tableStartY,
    canvas.width - padding * 2,
    rowHeight * (rows.length > 0 ? rows.length + 1 : 2)
  )

  currentX = padding
  for (let i = 0; i < columnWidths.length - 1; i++) {
    currentX += columnWidths[i]
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(currentX, tableStartY)
    ctx.lineTo(currentX, tableStartY + rowHeight * (rows.length > 0 ? rows.length + 1 : 2))
    ctx.stroke()
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create PNG'))
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeName}_utility_meter_reading.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
