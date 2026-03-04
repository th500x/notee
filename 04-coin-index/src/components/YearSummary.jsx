import { useState, useEffect } from 'react'
import { YEAR_RANGE } from '../constants'

// 年终总结组件
function YearSummary({ weeklyData, selectedYear = YEAR_RANGE.DEFAULT, simulationData, onClose }) {
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateSimulationData()
  }, [weeklyData, selectedYear])

  // 生成模拟演练数据（如果没有外部传入的话）
  const generateSimulationData = () => {
    if (simulationData && simulationData.length > 0) {
      // 如果有外部传入的模拟数据，直接使用
      generateSummaryData(simulationData)
    } else {
      // 生成模拟数据
      const results = []
      const weeks = Object.keys(weeklyData)
        .filter(key => key.startsWith(`${selectedYear}-W`))
        .sort()

      let pendingPositions = []

      for (let i = 0; i < weeks.length; i++) {
        const weekId = weeks[i]
        const weekData = weeklyData[weekId]
        
        if (!weekData) continue
        
        const rating = weekData.personalRating
        const ethPrice = weekData.ethWeeklyAvgPrice

        if (rating === undefined || rating === null || !ethPrice) continue

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

      generateSummaryData(results)
    }
  }

  // 生成年终总结数据
  const generateSummaryData = (simData = []) => {
    try {
      const weeks = Object.keys(weeklyData)
        .filter(key => key.startsWith(`${selectedYear}-W`))
        .sort()

      if (weeks.length === 0) {
        setLoading(false)
        return
      }

      // 初始化统计变量
      let maxWeeklyGain = -Infinity
      let maxWeeklyLoss = Infinity
      let maxATHDrawdown = 0 // 初始化为0，因为我们要找最小的负数
      let maxWeeklyAvgPrice = -Infinity
      let minWeeklyAvgPrice = Infinity
      let maxETHWeeklyAvgPrice = -Infinity
      let minETHWeeklyAvgPrice = Infinity
      let maxFearGreed = -Infinity
      let minFearGreed = Infinity
      let maxPersonalRating = -Infinity
      let minPersonalRating = Infinity
      let maxETHWeeklyGain = -Infinity
      let maxETHWeeklyLoss = Infinity
      let maxETHBTCRatio = -Infinity
      let minETHBTCRatio = Infinity

      // Ahr999定投次数统计
      let ahr999InvestmentCount = 0 // 抄底区间(≤0.4) + 定投区间(>0.4 <0.8)

      // 个人评级统计
      let ratingCounts = {
        extremeBullish: 0,  // 极度看多 (≥10)
        bullish: 0,         // 看多 (4-9)
        neutral: 0,         // 中性 (-3 to 3)
        bearish: 0,         // 看空 (-9 to -4)
        extremeBearish: 0   // 极度看空 (≤-10)
      }

      let currentStreakType = null
      let currentStreakLength = 0
      let streaks = { gains: [], losses: [] }
      let totalGainWeeks = 0
      let totalLossWeeks = 0

      // 遍历所有周数据
      weeks.forEach((weekId, index) => {
        const data = weeklyData[weekId]
        if (!data) return

        const {
          btcWeeklyChange,
          btcFromATH,
          btcWeeklyAvgPrice,
          ethWeeklyAvgPrice,
          fearGreedIndex,
          personalRating,
          ethBtcRatio,
          ahr999
        } = data

        // BTC相关统计
        if (btcWeeklyChange !== undefined && btcWeeklyChange !== null) {
          if (btcWeeklyChange > maxWeeklyGain) maxWeeklyGain = btcWeeklyChange
          if (btcWeeklyChange < maxWeeklyLoss) maxWeeklyLoss = btcWeeklyChange

          // 统计涨跌周数和连续涨跌（跳过第一周的0值）
          if (btcWeeklyChange > 0) {
            totalGainWeeks++
            if (currentStreakType === 'gain') {
              currentStreakLength++
            } else {
              if (currentStreakType === 'loss' && currentStreakLength > 0) {
                streaks.losses.push(currentStreakLength)
              }
              currentStreakType = 'gain'
              currentStreakLength = 1
            }
          } else if (btcWeeklyChange < 0) {
            totalLossWeeks++
            if (currentStreakType === 'loss') {
              currentStreakLength++
            } else {
              if (currentStreakType === 'gain' && currentStreakLength > 0) {
                streaks.gains.push(currentStreakLength)
              }
              currentStreakType = 'loss'
              currentStreakLength = 1
            }
          } else if (btcWeeklyChange === 0 && index > 0) {
            // 周涨跌为0时（平盘），结束当前连续计数
            if (currentStreakType === 'gain' && currentStreakLength > 0) {
              streaks.gains.push(currentStreakLength)
            } else if (currentStreakType === 'loss' && currentStreakLength > 0) {
              streaks.losses.push(currentStreakLength)
            }
            currentStreakType = null
            currentStreakLength = 0
          }
        }

        // ATH回撤 - 找到最大的负值（回撤最深）
        if (btcFromATH !== undefined) {
          if (btcFromATH < maxATHDrawdown) {
            maxATHDrawdown = btcFromATH
          }
        }

        // 年度ATH/ATL - 移除这部分，改为ETH价格统计
        if (btcWeeklyAvgPrice !== undefined) {
          if (btcWeeklyAvgPrice > maxWeeklyAvgPrice) maxWeeklyAvgPrice = btcWeeklyAvgPrice
          if (btcWeeklyAvgPrice < minWeeklyAvgPrice) minWeeklyAvgPrice = btcWeeklyAvgPrice
        }

        // ETH价格统计
        if (ethWeeklyAvgPrice !== undefined) {
          if (ethWeeklyAvgPrice > maxETHWeeklyAvgPrice) maxETHWeeklyAvgPrice = ethWeeklyAvgPrice
          if (ethWeeklyAvgPrice < minETHWeeklyAvgPrice) minETHWeeklyAvgPrice = ethWeeklyAvgPrice
          
          // ETH周涨跌幅计算
          if (index > 0) {
            const prevData = weeklyData[weeks[index - 1]]
            if (prevData && prevData.ethWeeklyAvgPrice) {
              const ethWeeklyChange = ((ethWeeklyAvgPrice - prevData.ethWeeklyAvgPrice) / prevData.ethWeeklyAvgPrice) * 100
              if (ethWeeklyChange > maxETHWeeklyGain) maxETHWeeklyGain = ethWeeklyChange
              if (ethWeeklyChange < maxETHWeeklyLoss) maxETHWeeklyLoss = ethWeeklyChange
            }
          }
        }

        // 其他指标
        if (fearGreedIndex !== undefined) {
          if (fearGreedIndex > maxFearGreed) maxFearGreed = fearGreedIndex
          if (fearGreedIndex < minFearGreed) minFearGreed = fearGreedIndex
        }

        // 个人评级统计
        if (personalRating !== undefined) {
          if (personalRating > maxPersonalRating) maxPersonalRating = personalRating
          if (personalRating < minPersonalRating) minPersonalRating = personalRating
          
          // 按照评级范围分类统计
          if (personalRating >= 10) {
            ratingCounts.extremeBullish++
          } else if (personalRating >= 4) {
            ratingCounts.bullish++
          } else if (personalRating >= -3) {
            ratingCounts.neutral++
          } else if (personalRating >= -9) {
            ratingCounts.bearish++
          } else {
            ratingCounts.extremeBearish++
          }
        }

        if (ethBtcRatio !== undefined) {
          if (ethBtcRatio > maxETHBTCRatio) maxETHBTCRatio = ethBtcRatio
          if (ethBtcRatio < minETHBTCRatio) minETHBTCRatio = ethBtcRatio
        }

        // Ahr999定投次数统计 - 抄底区间(≤0.4) + 定投区间(>0.4 <0.8)
        if (ahr999 !== undefined && ahr999 < 0.8) {
          ahr999InvestmentCount++
        }
      })

      // 处理最后一个连续涨跌
      if (currentStreakLength > 0) {
        if (currentStreakType === 'gain') {
          streaks.gains.push(currentStreakLength)
        } else if (currentStreakType === 'loss') {
          streaks.losses.push(currentStreakLength)
        }
      }

      // 计算连续涨跌统计
      const maxGainStreak = streaks.gains.length > 0 ? Math.max(...streaks.gains) : 0
      const maxLossStreak = streaks.losses.length > 0 ? Math.max(...streaks.losses) : 0
      const avgGainStreak = streaks.gains.length > 0 ? (streaks.gains.reduce((a, b) => a + b, 0) / streaks.gains.length) : 0
      const avgLossStreak = streaks.losses.length > 0 ? (streaks.losses.reduce((a, b) => a + b, 0) / streaks.losses.length) : 0

      // 牛熊指数
      const totalWeeks = totalGainWeeks + totalLossWeeks
      const gainRatio = totalWeeks > 0 ? (totalGainWeeks / totalWeeks) * 100 : 0
      let marketTrend = '中性'
      if (gainRatio >= 60) marketTrend = '牛市'
      else if (gainRatio <= 40) marketTrend = '熊市'

      // 模拟演练统计
      let simulationStats = {
        totalTrades: 0,
        settledTrades: 0,
        profitableTrades: 0,
        winRate: 0,
        avgHoldingWeeks: 0,
        maxProfit: -Infinity,
        maxLoss: Infinity,
        totalProfit: 0
      }

      if (simData && simData.length > 0) {
        const settledTrades = simData.filter(trade => trade.status === 'settled')
        simulationStats.totalTrades = simData.length
        simulationStats.settledTrades = settledTrades.length

        if (settledTrades.length > 0) {
          const profitableTrades = settledTrades.filter(trade => trade.profit > 0)
          simulationStats.profitableTrades = profitableTrades.length
          simulationStats.winRate = (profitableTrades.length / settledTrades.length) * 100

          const holdingWeeks = settledTrades.map(trade => trade.holdingWeeks).filter(weeks => typeof weeks === 'number')
          simulationStats.avgHoldingWeeks = holdingWeeks.length > 0 ? holdingWeeks.reduce((a, b) => a + b, 0) / holdingWeeks.length : 0

          settledTrades.forEach(trade => {
            if (typeof trade.profit === 'number') {
              if (trade.profit > simulationStats.maxProfit) simulationStats.maxProfit = trade.profit
              if (trade.profit < simulationStats.maxLoss) simulationStats.maxLoss = trade.profit
              simulationStats.totalProfit += trade.profit
            }
          })
        }
      }

      const summary = {
        // BTC统计
        btcMaxWeeklyGain: maxWeeklyGain === -Infinity ? 0 : maxWeeklyGain,
        btcMaxWeeklyLoss: maxWeeklyLoss === Infinity ? 0 : maxWeeklyLoss,
        btcMaxATHDrawdown: Math.abs(maxATHDrawdown), // 转为正数显示
        btcMaxWeeklyAvgPrice: maxWeeklyAvgPrice === -Infinity ? 0 : maxWeeklyAvgPrice,
        btcMinWeeklyAvgPrice: minWeeklyAvgPrice === Infinity ? 0 : minWeeklyAvgPrice,
        ahr999InvestmentCount, // Ahr999定投次数

        // ETH统计
        ethMaxWeeklyGain: maxETHWeeklyGain === -Infinity ? 0 : maxETHWeeklyGain,
        ethMaxWeeklyLoss: maxETHWeeklyLoss === Infinity ? 0 : maxETHWeeklyLoss,
        ethMaxWeeklyAvgPrice: maxETHWeeklyAvgPrice === -Infinity ? 0 : maxETHWeeklyAvgPrice,
        ethMinWeeklyAvgPrice: minETHWeeklyAvgPrice === Infinity ? 0 : minETHWeeklyAvgPrice,
        ethBtcMaxRatio: maxETHBTCRatio === -Infinity ? 0 : maxETHBTCRatio,
        ethBtcMinRatio: minETHBTCRatio === Infinity ? 0 : minETHBTCRatio,

        // 连续涨跌统计
        maxGainStreak,
        maxLossStreak,
        avgGainStreak,
        avgLossStreak,

        // 市场统计
        totalGainWeeks,
        totalLossWeeks,
        gainRatio,
        marketTrend,

        // 个人评级统计
        ratingCounts,

        // 模拟演练统计
        simulation: simulationStats,

        // 基础信息
        totalWeeks: weeks.length,
        dataRange: { start: weeks[0], end: weeks[weeks.length - 1] }
      }

      setSummaryData(summary)
      setLoading(false)
    } catch (error) {
      console.error('💥 生成年终总结数据失败:', error)
      setLoading(false)
    }
  }

  // 格式化数字显示
  const formatNumber = (value, decimals = 0) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A'
    return value.toLocaleString('zh-CN', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  // 格式化百分比
  const formatPercent = (value, decimals = 1) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A'
    return `${value.toFixed(decimals)}%`
  }

  // 获取趋势颜色
  const getTrendColor = (trend) => {
    switch (trend) {
      case '牛市': return 'text-green-600'
      case '熊市': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>正在生成年终总结数据...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!summaryData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">
            <p className="text-red-600">生成年终总结数据失败</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">🎊 {selectedYear}年终总结</h2>
            <p className="text-sm text-gray-600 mt-1">
              数据范围: {summaryData.dataRange.start} 至 {summaryData.dataRange.end} (共{summaryData.totalWeeks}周)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div className="overflow-auto max-h-[calc(90vh-120px)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* BTC价格统计 */}
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-orange-800 mb-3">₿ BTC价格统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>最大周涨幅:</span>
                  <span className="text-green-600 font-medium">+{formatPercent(summaryData.btcMaxWeeklyGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span>最大周跌幅:</span>
                  <span className="text-red-600 font-medium">{formatPercent(summaryData.btcMaxWeeklyLoss)}</span>
                </div>
                <div className="flex justify-between">
                  <span>距ATH最高回撤:</span>
                  <span className="text-red-600 font-medium">{formatPercent(summaryData.btcMaxATHDrawdown)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ahr999定投次数:</span>
                  <span className="text-blue-600 font-medium">{summaryData.ahr999InvestmentCount}周</span>
                </div>
                <div className="flex justify-between">
                  <span>周最高均价:</span>
                  <span className="font-medium">${formatNumber(summaryData.btcMaxWeeklyAvgPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>周最低均价:</span>
                  <span className="font-medium">${formatNumber(summaryData.btcMinWeeklyAvgPrice)}</span>
                </div>
              </div>
            </div>

            {/* ETH统计 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800 mb-3">⟠ ETH统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>最大周涨幅:</span>
                  <span className="text-green-600 font-medium">+{formatPercent(summaryData.ethMaxWeeklyGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span>最大周跌幅:</span>
                  <span className="text-red-600 font-medium">{formatPercent(summaryData.ethMaxWeeklyLoss)}</span>
                </div>
                <div className="flex justify-between">
                  <span>周最高均价:</span>
                  <span className="font-medium">${formatNumber(summaryData.ethMaxWeeklyAvgPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>周最低均价:</span>
                  <span className="font-medium">${formatNumber(summaryData.ethMinWeeklyAvgPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ETH/BTC最高比值:</span>
                  <span className="font-medium">{formatNumber(summaryData.ethBtcMaxRatio, 3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ETH/BTC最低比值:</span>
                  <span className="font-medium">{formatNumber(summaryData.ethBtcMinRatio, 3)}</span>
                </div>
              </div>
            </div>

            {/* 连续涨跌统计 */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-3">📈 连续涨跌统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>最大连涨周数:</span>
                  <span className="text-green-600 font-medium">{summaryData.maxGainStreak}周</span>
                </div>
                <div className="flex justify-between">
                  <span>最大连跌周数:</span>
                  <span className="text-red-600 font-medium">{summaryData.maxLossStreak}周</span>
                </div>
                <div className="flex justify-between">
                  <span>平均连涨周数:</span>
                  <span className="font-medium">{formatNumber(summaryData.avgGainStreak, 1)}周</span>
                </div>
                <div className="flex justify-between">
                  <span>平均连跌周数:</span>
                  <span className="font-medium">{formatNumber(summaryData.avgLossStreak, 1)}周</span>
                </div>
              </div>
            </div>

            {/* 市场趋势统计 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">🎯 市场趋势统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>本年度周涨数:</span>
                  <span className="text-green-600 font-medium">{summaryData.totalGainWeeks}周</span>
                </div>
                <div className="flex justify-between">
                  <span>本年度周跌数:</span>
                  <span className="text-red-600 font-medium">{summaryData.totalLossWeeks}周</span>
                </div>
                <div className="flex justify-between">
                  <span>周涨比例:</span>
                  <span className="font-medium">{formatPercent(summaryData.gainRatio)}</span>
                </div>
                <div className="flex justify-between">
                  <span>本年度牛熊指数:</span>
                  <span className={`font-bold ${getTrendColor(summaryData.marketTrend)}`}>
                    {summaryData.marketTrend}
                  </span>
                </div>
              </div>
            </div>

            {/* 个人评级统计 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">⭐ 个人评级统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>极度看多(≥10★):</span>
                  <span className="text-green-700 font-medium">{summaryData.ratingCounts.extremeBullish}周</span>
                </div>
                <div className="flex justify-between">
                  <span>看多(4-9★):</span>
                  <span className="text-green-600 font-medium">{summaryData.ratingCounts.bullish}周</span>
                </div>
                <div className="flex justify-between">
                  <span>中性(-3~3★):</span>
                  <span className="text-gray-600 font-medium">{summaryData.ratingCounts.neutral}周</span>
                </div>
                <div className="flex justify-between">
                  <span>看空(-9~-4★):</span>
                  <span className="text-red-600 font-medium">{summaryData.ratingCounts.bearish}周</span>
                </div>
                <div className="flex justify-between">
                  <span>极度看空(≤-10★):</span>
                  <span className="text-red-700 font-medium">{summaryData.ratingCounts.extremeBearish}周</span>
                </div>
              </div>
            </div>

            {/* 模拟演练统计 */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-indigo-800 mb-3">🎮 模拟演练统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>总交易次数:</span>
                  <span className="font-medium">{summaryData.simulation.totalTrades}次</span>
                </div>
                <div className="flex justify-between">
                  <span>已结算交易:</span>
                  <span className="font-medium">{summaryData.simulation.settledTrades}次</span>
                </div>
                <div className="flex justify-between">
                  <span>盈利交易:</span>
                  <span className="text-green-600 font-medium">{summaryData.simulation.profitableTrades}次</span>
                </div>
                <div className="flex justify-between">
                  <span>总胜率:</span>
                  <span className={`font-bold ${summaryData.simulation.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(summaryData.simulation.winRate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>平均持仓周数:</span>
                  <span className="font-medium">{formatNumber(summaryData.simulation.avgHoldingWeeks, 1)}周</span>
                </div>
                <div className="flex justify-between">
                  <span>最大单笔盈利:</span>
                  <span className="text-green-600 font-medium">
                    {summaryData.simulation.maxProfit === -Infinity ? 'N/A' : `$${formatNumber(summaryData.simulation.maxProfit)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>最大单笔亏损:</span>
                  <span className="text-red-600 font-medium">
                    {summaryData.simulation.maxLoss === Infinity ? 'N/A' : `$${formatNumber(summaryData.simulation.maxLoss)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>总盈亏:</span>
                  <span className={`font-bold ${summaryData.simulation.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${formatNumber(summaryData.simulation.totalProfit)}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* 总结文字 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">📝 年度总结</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {selectedYear}年共分析了{summaryData.totalWeeks}周的数据，BTC表现为{summaryData.marketTrend}趋势。
              最大周涨幅达到{formatPercent(summaryData.btcMaxWeeklyGain)}，最大周跌幅为{formatPercent(summaryData.btcMaxWeeklyLoss)}，
              距ATH最高回撤{formatPercent(summaryData.btcMaxATHDrawdown)}。
              个人评级系统中，看多情绪占{summaryData.ratingCounts.bullish + summaryData.ratingCounts.extremeBullish}周，
              看空情绪占{summaryData.ratingCounts.bearish + summaryData.ratingCounts.extremeBearish}周。
              {summaryData.simulation.settledTrades > 0 && (
                <>模拟演练策略共执行{summaryData.simulation.totalTrades}次交易，胜率{formatPercent(summaryData.simulation.winRate)}，
                总盈亏${formatNumber(summaryData.simulation.totalProfit)}。</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YearSummary