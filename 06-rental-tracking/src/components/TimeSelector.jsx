/**
 * 时间选择器组件
 * 
 * 功能：
 * - 年份选择（从2026年开始）
 * - 月份选择
 * - 视图模式切换（月度/年度）
 */
function TimeSelector({ selectedYear, selectedMonth, viewMode, onYearChange, onMonthChange, onViewModeChange }) {
  const currentYear = new Date().getFullYear()
  const startYear = 2026
  // 从2026年到当前年份+2年
  const endYear = Math.max(currentYear + 2, startYear + 4)
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 视图模式切换 */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            月度视图
          </button>
          <button
            onClick={() => onViewModeChange('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'year'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            年度视图
          </button>
        </div>

        {/* 年份选择 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">年份：</label>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
        </div>

        {/* 月份选择（仅在月度视图显示） */}
        {viewMode === 'month' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">月份：</label>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {months.map(month => (
                <option key={month} value={month}>{month}月</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimeSelector
