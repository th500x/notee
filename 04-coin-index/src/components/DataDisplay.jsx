// DataDisplay 组件 - 更新版本 v2.0
function DataDisplay({ selectedWeek, weeklyData }) {
  
  // 格式化周ID显示
  const formatWeekDisplay = (weekId) => {
    if (!weekId) return ''
    const [year, week] = weekId.split('-W')
    return `${year}年第${parseInt(week)}周`
  }

  // 格式化百分比
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '--'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  // 格式化数值
  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '--'
    return value.toFixed(decimals)
  }

  // 获取涨跌颜色类名
  const getChangeColorClass = (value) => {
    if (value === null || value === undefined) return 'text-gray-500'
    return value >= 0 ? 'text-green-600' : 'text-red-600'
  }

  if (!selectedWeek) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-medium mb-2">选择一周查看数据</h3>
          <p className="text-sm">点击左侧日历中的任意一周来查看该周的区块链市场指标</p>
        </div>
      </div>
    )
  }

  const hasData = Object.keys(weeklyData).length > 0

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-xl font-medium mb-2">{formatWeekDisplay(selectedWeek)}</h3>
          <p className="text-sm">该周暂无数据</p>
          <p className="text-xs mt-2 text-gray-400">数据收集中，敬请期待...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">{formatWeekDisplay(selectedWeek)}</h2>
        <p className="text-gray-600 mt-1">区块链市场指标数据</p>
      </div>

      {/* 核心指标网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* BTC周涨跌幅 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">BTC周涨跌幅</h3>
            <span className="text-xs text-gray-500">%</span>
          </div>
          <div className={`text-2xl font-bold mt-2 ${getChangeColorClass(weeklyData.btcWeeklyChange)}`}>
            {formatPercentage(weeklyData.btcWeeklyChange)}
          </div>
        </div>

        {/* BTC周均价 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">BTC周均价</h3>
            <span className="text-xs text-gray-500">USD</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            ${formatNumber(weeklyData.btcWeeklyAvgPrice, 0)}
          </div>
        </div>

        {/* ETH周均价 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">ETH周均价</h3>
            <span className="text-xs text-gray-500">USD</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            ${formatNumber(weeklyData.ethWeeklyAvgPrice, 0)}
          </div>
        </div>

        {/* ETH/BTC市值比 - 调整到第四位 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">ETH/BTC市值比</h3>
            <span className="text-xs text-gray-500">比值</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {formatNumber(weeklyData.ethBtcRatio, 3)}
          </div>
        </div>

        {/* BTC距ATH回撤 - 调整到第五位 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">BTC距ATH回撤</h3>
            <span className="text-xs text-gray-500">%</span>
          </div>
          <div className={`text-2xl font-bold mt-2 ${getChangeColorClass(weeklyData.btcFromATH)}`}>
            {formatPercentage(weeklyData.btcFromATH)}
          </div>
        </div>

        {/* 恐惧贪婪指数 - 调整到第六位 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">恐惧&贪婪指数</h3>
            <span className="text-xs text-gray-500">0-100</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {formatNumber(weeklyData.fearGreedIndex, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {weeklyData.fearGreedIndex >= 75 ? '极度贪婪' : 
             weeklyData.fearGreedIndex >= 55 ? '贪婪' :
             weeklyData.fearGreedIndex >= 45 ? '中性' :
             weeklyData.fearGreedIndex >= 25 ? '恐惧' : '极度恐惧'}
          </div>
        </div>

        {/* 梅耶倍数 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">梅耶倍数</h3>
            <span className="text-xs text-gray-500">倍</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {formatNumber(weeklyData.mayerMultiple)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {weeklyData.mayerMultiple >= 2.4 ? '高估' : 
             weeklyData.mayerMultiple >= 1.0 ? '正常' : '低估'}
          </div>
        </div>

        {/* Ahr999指标 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Ahr999指标</h3>
            <span className="text-xs text-gray-500">--</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {formatNumber(weeklyData.ahr999)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {weeklyData.ahr999 <= 0.45 ? '抄底区间' : 
             weeklyData.ahr999 <= 1.2 ? '定投区间' : '观望区间'}
          </div>
        </div>

        {/* BTC四年指数 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">BTC四年指数</h3>
            <span className="text-xs text-gray-500">--</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {formatNumber(weeklyData.btcFourYearIndex)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {weeklyData.btcFourYearIndex <= 0.3 ? '极度低估' : 
             weeklyData.btcFourYearIndex <= 0.6 ? '低估' :
             weeklyData.btcFourYearIndex <= 1.0 ? '合理' :
             weeklyData.btcFourYearIndex <= 1.5 ? '高估' : '极度高估'}
          </div>
        </div>

        {/* 个人评级 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">个人评级</h3>
            <span className="text-xs text-gray-500">★</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {weeklyData.personalRating ? `${weeklyData.personalRating}★` : '--'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {weeklyData.personalRating >= 4 ? '强烈推荐' : 
             weeklyData.personalRating >= 3 ? '推荐' :
             weeklyData.personalRating >= 2 ? '观望' :
             weeklyData.personalRating >= 1 ? '谨慎' : '暂无评级'}
          </div>
        </div>

      </div>

      {/* 数据更新时间 */}
      {weeklyData.updatedAt && (
        <div className="text-xs text-gray-400 text-center pt-4 border-t">
          数据更新时间: {new Date(weeklyData.updatedAt).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  )
}

export default DataDisplay

// 强制更新 - 2026-02-01