/**
 * 统计面板组件
 * 
 * 功能：
 * - 显示总收入、总支出、净利润
 * - 月度视图：显示缴租率（已缴租房间数 / 出租中+新合同房间数）
 * - 年度视图：显示出租率（只计算当前月份之前的月份平均出租率）
 * - 根据选择的时间范围计算统计数据
 * - 统计包含：房源收支 + 项目开支
 * 
 * 出租率说明（年度视图）：
 * - 只计算当前月份之前的月份（避免未来月份影响真实性）
 * - 例如：当前是3月，则只计算1-2月的数据
 * - 计算每个月的出租率（出租中+新合同）/ 总房源数
 * - 取已过月份的平均值
 */
import { useMemo } from 'react'
import { getPropertyStatus } from '../utils/propertyStatus'
import { getAllProperties } from '../utils/propertyUtils'

function StatisticsPanel({ rentalData, selectedYear, selectedMonth, viewMode }) {
  // 计算统计数据（使用 useMemo 缓存）
  const stats = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    let totalProperties = 0
    let rentedProperties = 0
    let paidProperties = 0 // 已缴租的房间数量

    rentalData.projects.forEach(project => {
      // 获取所有房源（包括默认分组和自定义分组）
      const allProperties = getAllProperties(project)
      totalProperties += allProperties.length

      // 统计房源数据
      allProperties.forEach(property => {
        if (viewMode === 'month') {
          // 月度视图：统计当月的出租状态和缴租情况
          const currentMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
          const status = getPropertyStatus(property, currentMonth)
          
          if (status === 'rented' || status === 'new-contract') {
            rentedProperties++
            
            // 检查是否已缴租
            const hasPaid = property.records?.some(r => r.date === currentMonth && r.isPaid === true)
            if (hasPaid) {
              paidProperties++
            }
          }
        }

        // 计算房源收支
        property.records?.forEach(record => {
          const recordDate = record.date.split('-')
          const recordYear = parseInt(recordDate[0])
          const recordMonth = parseInt(recordDate[1])

          if (viewMode === 'month') {
            // 月度视图：只统计选中月份
            if (recordYear === selectedYear && recordMonth === selectedMonth) {
              totalIncome += record.income || 0
              totalExpenses += record.expenses || 0
            }
          } else {
            // 年度视图：统计整年
            if (recordYear === selectedYear) {
              totalIncome += record.income || 0
              totalExpenses += record.expenses || 0
            }
          }
        })
      })

      // 统计项目开支数据
      const expenses = project.expenses || []
      expenses.forEach(expense => {
        expense.records?.forEach(record => {
          const recordDate = record.date.split('-')
          const recordYear = parseInt(recordDate[0])
          const recordMonth = parseInt(recordDate[1])

          if (viewMode === 'month') {
            // 月度视图：只统计选中月份
            if (recordYear === selectedYear && recordMonth === selectedMonth) {
              totalIncome += record.income || 0
              totalExpenses += record.expenses || 0
            }
          } else {
            // 年度视图：统计整年
            if (recordYear === selectedYear) {
              totalIncome += record.income || 0
              totalExpenses += record.expenses || 0
            }
          }
        })
      })
    })

    const netProfit = totalIncome - totalExpenses
    
    let rateValue = 0
    let rateLabel = ''
    let rateDetail = ''
    
    if (viewMode === 'month') {
      // 月度视图：显示缴租率
      rateValue = rentedProperties > 0 ? (paidProperties / rentedProperties * 100).toFixed(1) : 0
      rateLabel = '缴租率'
      rateDetail = `${paidProperties}/${rentedProperties} 套已缴租`
    } else {
      // 年度视图：计算平均出租率（只计算当前月份之前的月份）
      let totalOccupancyRate = 0
      let monthCount = 0
      
      // 获取当前年月
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1  // 1-12
      
      // 确定要计算的最大月份
      // 如果选择的年份是当前年份，只计算到当前月份
      // 如果选择的年份是过去年份，计算全年12个月
      const maxMonth = selectedYear === currentYear ? currentMonth : 12
      
      // 计算每个月的出租率
      for (let month = 1; month <= maxMonth; month++) {
        const monthStr = `${selectedYear}-${String(month).padStart(2, '0')}`
        let rentedCount = 0
        
        rentalData.projects.forEach(project => {
          const allProperties = getAllProperties(project)
          allProperties.forEach(property => {
            const status = getPropertyStatus(property, monthStr)
            if (status === 'rented' || status === 'new-contract') {
              rentedCount++
            }
          })
        })
        
        if (totalProperties > 0) {
          totalOccupancyRate += (rentedCount / totalProperties * 100)
          monthCount++
        }
      }
      
      rateValue = monthCount > 0 ? (totalOccupancyRate / monthCount).toFixed(1) : 0
      rateLabel = '出租率'
      rateDetail = `${monthCount}个月平均出租率`
    }

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      rateValue,
      rateLabel,
      rateDetail,
      totalProperties,
      rentedProperties,
      paidProperties
    }
  }, [rentalData, selectedYear, selectedMonth, viewMode])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* 总收入 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">总收入</p>
            <p className="text-2xl font-bold text-blue-600">฿{stats.totalIncome.toLocaleString()}</p>
          </div>
          <div className="text-3xl">💰</div>
        </div>
      </div>

      {/* 总支出 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">总支出</p>
            <p className="text-2xl font-bold text-orange-600">฿{stats.totalExpenses.toLocaleString()}</p>
          </div>
          <div className="text-3xl">💸</div>
        </div>
      </div>

      {/* 净利润 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">净利润</p>
            <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ฿{stats.netProfit.toLocaleString()}
            </p>
          </div>
          <div className="text-3xl">{stats.netProfit >= 0 ? '📈' : '📉'}</div>
        </div>
      </div>

      {/* 缴租率/出租率 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{stats.rateLabel}</p>
            <p className="text-2xl font-bold text-purple-600">{stats.rateValue}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.rateDetail}
            </p>
          </div>
          <div className="text-3xl">✅</div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsPanel
