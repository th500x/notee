/**
 * 统计面板组件
 * 
 * 功能：
 * - 显示总收入、总支出、净利润
 * - 显示缴租率（已缴租房间数 / 出租中+新合同房间数）
 * - 根据选择的时间范围计算统计数据
 * - 统计包含：房源收支 + 项目开支
 * 
 * 缴租率说明：
 * - 统计范围：出租中 + 新合同状态的房源
 * - 判定标准：在选定时间范围内有收入记录（income > 0）
 */
function StatisticsPanel({ rentalData, selectedYear, selectedMonth, viewMode }) {
  // 计算统计数据
  const calculateStatistics = () => {
    let totalIncome = 0
    let totalExpenses = 0
    let totalProperties = 0
    let rentedProperties = 0
    let paidProperties = 0 // 已缴租的房间数量

    rentalData.projects.forEach(project => {
      // 统计房源数据
      project.properties.forEach(property => {
        totalProperties++
        // 出租中和新合同状态都计入缴租率统计
        if (property.status === 'rented' || property.status === 'new-contract') {
          rentedProperties++
          
          // 检查当月是否有收入记录（判断是否已缴租）
          const hasPaidThisMonth = property.records?.some(record => {
            const recordDate = record.date.split('-')
            const recordYear = parseInt(recordDate[0])
            const recordMonth = parseInt(recordDate[1])
            
            if (viewMode === 'month') {
              // 月度视图：检查选中月份是否有收入
              return recordYear === selectedYear && 
                     recordMonth === selectedMonth && 
                     (record.income || 0) > 0
            } else {
              // 年度视图：检查整年是否有收入
              return recordYear === selectedYear && 
                     (record.income || 0) > 0
            }
          })
          
          if (hasPaidThisMonth) {
            paidProperties++
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
    // 缴租率 = 已缴租房间数 / 出租中房间数
    const paymentRate = rentedProperties > 0 ? (paidProperties / rentedProperties * 100).toFixed(1) : 0

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      paymentRate,
      totalProperties,
      rentedProperties,
      paidProperties
    }
  }

  const stats = calculateStatistics()

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

      {/* 缴租率 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">缴租率</p>
            <p className="text-2xl font-bold text-purple-600">{stats.paymentRate}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.paidProperties}/{stats.rentedProperties} 套已缴租
            </p>
          </div>
          <div className="text-3xl">✅</div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsPanel
