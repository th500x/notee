// DataDisplay 组件 - 更新版本 v3.0
import { getRatingTextClass, getRatingLabel } from '../utils/ratingColors'

function DataDisplay({ selectedWeek, weeklyData, t0Must = null }) {
  
  // 格式化周ID显示
  const formatWeekDisplay = (weekId) => {
    if (!weekId) return ''
    const [year, week] = weekId.split('-W')
    return `${year}年第${week}周` // 保持原始格式，不使用parseInt
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

  // 计算各指标评分
  const calculateScore = (indicator, value) => {
    if (value === null || value === undefined) return null
    
    switch (indicator) {
      case 'btcWeeklyChange':
        if (value <= -20) return 2
        if (value <= -10) return 1
        if (value <= 10) return 0
        if (value <= 20) return -1
        return -2
      
      case 'btcFromATH':
        if (value <= -40) return 2
        if (value <= -20) return 1
        if (value <= 20) return 0
        if (value <= 40) return -1
        return -2
      
      case 'fearGreedIndex':
        if (value <= 20) return 2
        if (value <= 40) return 1
        if (value <= 60) return 0
        if (value <= 80) return -1
        return -2
      
      case 'mayerMultiple':
        if (value <= 0.8) return 2
        if (value <= 0.9) return 1
        if (value <= 1.1) return 0
        if (value <= 1.2) return -1
        return -2
      
      case 'ahr999':
        if (value <= 0.4) return 2
        if (value <= 0.8) return 1
        if (value <= 1.2) return 0
        if (value <= 1.6) return -1
        return -2
      
      case 'btcFourYearIndex':
        if (value <= 1.6) return 2
        if (value <= 1.8) return 1
        if (value <= 2.0) return 0
        if (value <= 2.2) return -1
        return -2
      
      case 'fedRate':
        if (value <= 1.5) return 2
        if (value <= 2.5) return 1
        if (value <= 3.5) return 0
        if (value <= 4.5) return -1
        return -2
      
      case 'bojRate':
        if (value <= 0) return 2
        if (value <= 1) return 1
        if (value <= 2) return 0
        if (value <= 3) return -1
        return -2
      
      default:
        return null
    }
  }

  // 格式化评分显示
  const formatScore = (score) => {
    if (score === null || score === undefined) return ''
    const sign = score > 0 ? '+' : ''
    return `${sign}${score}分`
  }

  // 获取评分颜色类名
  const getScoreColorClass = (score) => {
    if (score === null || score === undefined) return 'text-gray-500'
    if (score > 0) return 'text-green-600'
    if (score < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // 计算个人评级总分（如果数据中没有提供）
  const calculateTotalRating = () => {
    // 优先使用数据中的personalRating
    if (weeklyData.personalRating !== undefined && weeklyData.personalRating !== null) {
      return weeklyData.personalRating
    }
    
    // 如果没有，则计算各指标评分的总和
    const scores = [
      calculateScore('btcWeeklyChange', weeklyData.btcWeeklyChange),
      calculateScore('btcFromATH', weeklyData.btcFromATH),
      calculateScore('fearGreedIndex', weeklyData.fearGreedIndex),
      calculateScore('mayerMultiple', weeklyData.mayerMultiple),
      calculateScore('ahr999', weeklyData.ahr999),
      calculateScore('btcFourYearIndex', weeklyData.btcFourYearIndex),
      calculateScore('fedRate', weeklyData.fedRate),
      calculateScore('bojRate', weeklyData.bojRate)
    ]
    
    // 过滤掉null值并求和
    const validScores = scores.filter(score => score !== null)
    if (validScores.length === 0) return null
    
    return validScores.reduce((sum, score) => sum + score, 0)
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
          {calculateScore('btcWeeklyChange', weeklyData.btcWeeklyChange) !== null && (
            <div className={`text-sm font-medium mt-1 text-right ${getScoreColorClass(calculateScore('btcWeeklyChange', weeklyData.btcWeeklyChange))}`}>
              {formatScore(calculateScore('btcWeeklyChange', weeklyData.btcWeeklyChange))}
            </div>
          )}
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
          {calculateScore('btcFromATH', weeklyData.btcFromATH) !== null && (
            <div className={`text-sm font-medium mt-1 text-right ${getScoreColorClass(calculateScore('btcFromATH', weeklyData.btcFromATH))}`}>
              {formatScore(calculateScore('btcFromATH', weeklyData.btcFromATH))}
            </div>
          )}
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
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.fearGreedIndex <= 20 ? '极度恐惧' : 
               weeklyData.fearGreedIndex <= 40 ? '恐惧' :
               weeklyData.fearGreedIndex <= 60 ? '中性' :
               weeklyData.fearGreedIndex <= 80 ? '贪婪' : '极度贪婪'}
            </div>
            {calculateScore('fearGreedIndex', weeklyData.fearGreedIndex) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('fearGreedIndex', weeklyData.fearGreedIndex))}`}>
                {formatScore(calculateScore('fearGreedIndex', weeklyData.fearGreedIndex))}
              </div>
            )}
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
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.mayerMultiple <= 0.8 ? '极度低估' : 
               weeklyData.mayerMultiple <= 0.9 ? '低估' :
               weeklyData.mayerMultiple <= 1.1 ? '中性' :
               weeklyData.mayerMultiple <= 1.2 ? '高估' : '极度高估'}
            </div>
            {calculateScore('mayerMultiple', weeklyData.mayerMultiple) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('mayerMultiple', weeklyData.mayerMultiple))}`}>
                {formatScore(calculateScore('mayerMultiple', weeklyData.mayerMultiple))}
              </div>
            )}
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
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.ahr999 <= 0.4 ? '抄底区间' : 
               weeklyData.ahr999 <= 0.8 ? '定投区间' :
               weeklyData.ahr999 <= 1.2 ? '观望区间' :
               weeklyData.ahr999 <= 1.6 ? '谨慎区间' : '风险区间'}
            </div>
            {calculateScore('ahr999', weeklyData.ahr999) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('ahr999', weeklyData.ahr999))}`}>
                {formatScore(calculateScore('ahr999', weeklyData.ahr999))}
              </div>
            )}
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
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.btcFourYearIndex <= 1.6 ? '极度低估' : 
               weeklyData.btcFourYearIndex <= 1.8 ? '低估' :
               weeklyData.btcFourYearIndex <= 2.0 ? '中性' :
               weeklyData.btcFourYearIndex <= 2.2 ? '高估' : '极度高估'}
            </div>
            {calculateScore('btcFourYearIndex', weeklyData.btcFourYearIndex) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('btcFourYearIndex', weeklyData.btcFourYearIndex))}`}>
                {formatScore(calculateScore('btcFourYearIndex', weeklyData.btcFourYearIndex))}
              </div>
            )}
          </div>
        </div>

        {/* 美联储利率 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">美联储利率</h3>
            <span className="text-xs text-gray-500">%</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {weeklyData.fedRate !== undefined && weeklyData.fedRate !== null 
              ? formatNumber(weeklyData.fedRate, 2) 
              : '--'}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.fedRate <= 1.5 ? '极度宽松' :
               weeklyData.fedRate <= 2.5 ? '宽松' :
               weeklyData.fedRate <= 3.5 ? '中性' :
               weeklyData.fedRate <= 4.5 ? '紧缩' : '极度紧缩'}
            </div>
            {calculateScore('fedRate', weeklyData.fedRate) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('fedRate', weeklyData.fedRate))}`}>
                {formatScore(calculateScore('fedRate', weeklyData.fedRate))}
              </div>
            )}
          </div>
        </div>

        {/* 日央行利率 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">日央行利率</h3>
            <span className="text-xs text-gray-500">%</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-gray-900">
            {weeklyData.bojRate !== undefined && weeklyData.bojRate !== null 
              ? formatNumber(weeklyData.bojRate, 2) 
              : '--'}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {weeklyData.bojRate <= 0 ? '极度宽松' :
               weeklyData.bojRate <= 1 ? '宽松' :
               weeklyData.bojRate <= 2 ? '中性' :
               weeklyData.bojRate <= 3 ? '紧缩' : '极度紧缩'}
            </div>
            {calculateScore('bojRate', weeklyData.bojRate) !== null && (
              <div className={`text-sm font-medium ${getScoreColorClass(calculateScore('bojRate', weeklyData.bojRate))}`}>
                {formatScore(calculateScore('bojRate', weeklyData.bojRate))}
              </div>
            )}
          </div>
        </div>

        {/* 个人评级 - 移到最后一位 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">个人评级</h3>
            <span className="text-xs text-gray-500">★</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`text-2xl font-bold ${getRatingTextClass(calculateTotalRating())}`}>
              {calculateTotalRating() !== null 
                ? `${calculateTotalRating() > 0 ? '+' : ''}${calculateTotalRating()}★` 
                : '--'}
            </div>
            {t0Must && (
              <div
                className={`week-t0-must week-t0-must--${t0Must === 'buy' ? 'extreme-bullish' : 'extreme-bearish'}`}
                style={{ position: 'static' }}
                title={t0Must === 'buy' ? 'T0 必买' : 'T0 必卖'}
              >
                必
              </div>
            )}
          </div>
          <div className={`text-xs mt-1 font-medium ${getRatingTextClass(calculateTotalRating())}`}>
            {t0Must === 'buy' ? '极度看多 · 必买' : t0Must === 'sell' ? '极度看空 · 必卖' : getRatingLabel(calculateTotalRating())}
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