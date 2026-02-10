import { useState, useEffect } from 'react'

// 模拟演练表格组件
function SimulationTable({ weeklyData, selectedYear = 2025, onClose, onDataGenerated }) {
  const [simulationData, setSimulationData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateSimulationData()
  }, [weeklyData, selectedYear])

  // 生成模拟演练数据
  const generateSimulationData = () => {
    try {
      const results = []
      const weeks = Object.keys(weeklyData)
        .filter(key => key.startsWith(`${selectedYear}-W`))
        .sort()

      let pendingPositions = []

      for (let i = 0; i < weeks.length; i++) {
        const weekId = weeks[i]
        const weekData = weeklyData[weekId]
        
        if (!weekData) {
          continue
        }
        
        const rating = weekData.personalRating
        const ethPrice = weekData.ethWeeklyAvgPrice

        if (rating === undefined || rating === null || !ethPrice) {
          continue
        }

        // 检查是否触发交易信号
        const isBuySignal = rating >= 4
        const isSellSignal = rating <= -4

        if (isBuySignal || isSellSignal) {
          const direction = isBuySignal ? 'BUY' : 'SELL'
          
          // 检查是否有反向持仓需要结算
          const oppositePositions = pendingPositions.filter(pos => 
            (pos.direction === 'BUY' && isSellSignal) ||
            (pos.direction === 'SELL' && isBuySignal)
          )

          if (oppositePositions.length > 0) {
            // 结算所有反向持仓
            results.forEach(record => {
              if (record.direction !== direction && record.status === 'pending') {
                const recordIndex = weeks.indexOf(record.week)
                const recordHoldingWeeks = i - recordIndex
                const recordProfit = record.direction === 'BUY' 
                  ? ethPrice - record.ethPrice
                  : record.ethPrice - ethPrice

                record.settlementWeek = weekId
                record.settlementPrice = Math.round(ethPrice)
                record.holdingWeeks = recordHoldingWeeks
                record.profit = Math.round(recordProfit)
                record.status = 'settled'
              }
            })

            // 从待结算列表中移除已结算的持仓
            pendingPositions = pendingPositions.filter(pos => 
              !oppositePositions.some(op => op.direction === pos.direction)
            )
          }

          // 创建新的交易记录
          const record = {
            week: weekId,
            rating: rating,
            direction: direction,
            ethPrice: Math.round(ethPrice),
            settlementWeek: 'TBD',
            settlementPrice: 'TBD',
            holdingWeeks: 'TBD',
            profit: 'TBD',
            status: 'pending'
          }

          results.push(record)
          
          // 添加到待结算列表
          pendingPositions.push({
            week: weekId,
            direction: direction,
            ethPrice: ethPrice,
            rating: rating
          })
        }
      }

      setSimulationData(results)
      
      // 将数据传递给父组件
      if (onDataGenerated) {
        onDataGenerated(results)
      }
      
      setLoading(false)
    } catch (error) {
      console.error('💥 生成模拟演练数据失败:', error)
      setLoading(false)
    }
  }

  // 格式化数字显示
  const formatNumber = (value) => {
    if (value === 'TBD') return 'TBD'
    if (typeof value === 'number') {
      return value.toLocaleString()
    }
    return value
  }

  // 获取利润颜色
  const getProfitColor = (profit) => {
    if (profit === 'TBD') return 'text-gray-500'
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // 获取方向颜色
  const getDirectionColor = (direction) => {
    return direction === 'BUY' ? 'text-green-600' : 'text-red-600'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>正在生成模拟演练数据...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🎮 {selectedYear}年模拟演练</h2>
            <p className="text-sm text-gray-600 mt-1">
              基于个人评级的ETH交易模拟 (触发条件: 评级≥4买入, 评级≤-4卖出)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 表格内容 */}
        <div className="overflow-auto max-h-[calc(90vh-120px)]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  触发周
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  个人评级
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  方向
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ETH价格
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  结算周
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  结算价格
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  持仓周数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  利润
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {simulationData.map((record, index) => (
                <tr key={index} className={record.status === 'pending' ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {record.week}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.rating}★
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${getDirectionColor(record.direction)}`}>
                    {record.direction}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatNumber(record.ethPrice)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.settlementWeek}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.settlementPrice === 'TBD' ? 'TBD' : `$${formatNumber(record.settlementPrice)}`}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(record.holdingWeeks)}
                  </td>
                  <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${getProfitColor(record.profit)}`}>
                    {record.profit === 'TBD' ? 'TBD' : `$${formatNumber(record.profit)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 统计信息 */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>总交易次数: {simulationData.length}</span>
            <span>已结算: {simulationData.filter(r => r.status === 'settled').length}</span>
            <span>待结算: {simulationData.filter(r => r.status === 'pending').length}</span>
            <span className="text-blue-600">
              总利润: ${formatNumber(
                simulationData
                  .filter(r => r.status === 'settled' && typeof r.profit === 'number')
                  .reduce((sum, r) => sum + r.profit, 0)
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimulationTable