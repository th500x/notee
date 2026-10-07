import { useState, useEffect } from 'react'
import { YEAR_RANGE, TRADING_SIGNALS } from '../constants'
import { getRatingTextClass, getTradeDirectionTextClass } from '../utils/ratingColors'
import { SIM_PLAN, generateSimulationTrades } from '../utils/simulationTrades'
import SimulationPlanSwitch from './SimulationPlanSwitch'

function SimulationTable({ weeklyData, selectedYear = YEAR_RANGE.DEFAULT, onClose }) {
  const [simulationData, setSimulationData] = useState([])
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState(SIM_PLAN.INDICATOR)

  useEffect(() => {
    try {
      const results = generateSimulationTrades(weeklyData, selectedYear, plan)
      setSimulationData(results)
      setLoading(false)
    } catch (error) {
      console.error('💥 生成模拟演练数据失败:', error)
      setLoading(false)
    }
  }, [weeklyData, selectedYear, plan])

  const formatNumber = (value) => {
    if (value === 'TBD') return 'TBD'
    if (typeof value === 'number') {
      return value.toLocaleString()
    }
    return value
  }

  const getProfitColor = (profit) => {
    if (profit === 'TBD') return 'text-gray-500'
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-900'
  }

  const getDirectionColor = (direction, rating) => getTradeDirectionTextClass(direction, rating)

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>正在生成模拟演练数据...</p>
        </div>
      </div>
    )
  }

  const settledProfit = simulationData
    .filter((r) => r.status === 'settled' && typeof r.profit === 'number')
    .reduce((sum, r) => sum + r.profit, 0)

  return (
    <div className="max-h-[90vh] overflow-hidden flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-6 border-b shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">🎮 {selectedYear}年模拟演练</h2>
            <SimulationPlanSwitch value={plan} onChange={setPlan} />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {plan === SIM_PLAN.BADGE
              ? '开仓：当周「必」或「荐」各 1 ETH；平仓：止盈 $'
              : `开仓：评级 ≥${TRADING_SIGNALS.BUY_THRESHOLD} BUY · ≤${TRADING_SIGNALS.SELL_THRESHOLD} SELL，各 1 ETH；平仓：止盈 $`}
            {TRADING_SIGNALS.TAKE_PROFIT_USD}/ETH
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
        >
          ×
        </button>
      </div>

      {/* 规则说明 */}
      <div className="mx-6 mt-4 mb-2 shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 leading-relaxed">
        <p className="font-medium mb-1">结算规则说明</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-800">
          <li>
            {plan === SIM_PLAN.BADGE
              ? '开仓：当周有「必」或「荐」时按 ETH 周均价开 1 ETH（必买/荐买为多，必卖/荐卖为空；同向可叠仓）。'
              : '开仓：个人评级达到看多/看空阈值当周按 ETH 周均价开 1 ETH（同向信号可叠仓）。'}
          </li>
          <li>
            平仓为止盈 ${TRADING_SIGNALS.TAKE_PROFIT_USD}
            ：价差朝盈利方向达到 ${TRADING_SIGNALS.TAKE_PROFIT_USD}
            （按后续周的 ETH 周均价，<strong>可跨年</strong>）即结算；<strong>不再</strong>因出现反向评级信号而平仓。
          </li>
          <li>
            截至已有数据仍未触及止盈的仓位保持待结算（TBD）。价格口径为 ethWeeklyAvgPrice，利润单位
            USD/ETH。
          </li>
        </ul>
      </div>

      {/* 表格内容 */}
      <div className="overflow-auto flex-1 min-h-0 px-0">
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
                <td
                  className={`px-4 py-4 whitespace-nowrap text-sm text-gray-900 ${getRatingTextClass(record.rating)}`}
                >
                  {record.rating}★
                </td>
                <td
                  className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${getDirectionColor(record.direction, record.rating)}`}
                >
                  {record.direction}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${formatNumber(record.ethPrice)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.settlementWeek}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {record.settlementPrice === 'TBD'
                    ? 'TBD'
                    : `$${formatNumber(record.settlementPrice)}`}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(record.holdingWeeks)}
                </td>
                <td
                  className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${getProfitColor(record.profit)}`}
                >
                  {record.profit === 'TBD' ? 'TBD' : `$${formatNumber(record.profit)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 统计信息 */}
      <div className="border-t p-4 bg-gray-50 shrink-0">
        <div className="flex flex-wrap gap-4 justify-between text-sm text-gray-600">
          <span>总交易次数: {simulationData.length}</span>
          <span>已结算: {simulationData.filter((r) => r.status === 'settled').length}</span>
          <span>待结算: {simulationData.filter((r) => r.status === 'pending').length}</span>
          <span className="text-blue-600">总利润: ${formatNumber(settledProfit)}</span>
        </div>
      </div>
    </div>
  )
}

export default SimulationTable
