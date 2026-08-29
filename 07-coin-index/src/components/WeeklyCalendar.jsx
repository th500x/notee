/**
 * 周历组件 - v2.0
 * 显示年度周历，支持周选择和数据指示器
 */

import { useState, useEffect } from 'react'
import { useCurrentWeek } from '../hooks/useCurrentWeek'
import { useWeekIndicators } from '../hooks/useWeekIndicators'
import { getWeeksInYear, formatDateRange } from '../utils/weekCalculator'

function WeeklyCalendar({ 
  currentYear, 
  selectedWeek, 
  onWeekChange, 
  onYearChange, 
  minYear, 
  maxYear,
  t0MustByWeek = {},
}) {
  const [weeks, setWeeks] = useState([])
  const currentWeekId = useCurrentWeek()
  const { weekIndicators, weekStatuses } = useWeekIndicators(currentYear)

  // 当年份改变时重新计算周
  useEffect(() => {
    const yearWeeks = getWeeksInYear(currentYear)
    setWeeks(yearWeeks)
  }, [currentYear])

  // 处理年份导航
  const handlePrevYear = () => {
    if (currentYear > minYear) {
      onYearChange(currentYear - 1)
    }
  }

  const handleNextYear = () => {
    if (currentYear < maxYear) {
      onYearChange(currentYear + 1)
    }
  }

  return (
    <div className="weekly-calendar">
      {/* 年份导航 */}
      <div className="year-navigation">
        <button 
          className="year-nav-button"
          onClick={handlePrevYear}
          disabled={currentYear <= minYear}
        >
          ←
        </button>
        <div className="year-display">{currentYear}年</div>
        <button 
          className="year-nav-button"
          onClick={handleNextYear}
          disabled={currentYear >= maxYear}
        >
          →
        </button>
      </div>

      {/* 周网格 */}
      <div className="grid grid-cols-5 gap-2">
        {weeks.map((week) => {
          const isSelected = selectedWeek === week.id
          const isCurrent = currentWeekId === week.id
          const hasData = weekIndicators.has(week.id)
          const weekStatus = weekStatuses[week.id] || null
          const t0Must = t0MustByWeek[week.id] || null
          
          return (
            <div
              key={week.id}
              className={`week-tile ${isSelected ? 'week-tile--active' : ''} ${
                isCurrent ? 'week-tile--current' : ''
              }`}
              onClick={() => onWeekChange(week.id)}
              title={`第${week.weekNumber}周 (${formatDateRange(week.startDate, week.endDate)})`}
            >
              <div className="text-sm font-medium">W{week.weekNumber.toString().padStart(2, '0')}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDateRange(week.startDate, week.endDate)}
              </div>
              
              {t0Must && weekStatus && (
                <div
                  className={`week-t0-must week-t0-must--${weekStatus}`}
                  title={t0Must === 'buy' ? 'T0 必买' : 'T0 必卖'}
                >
                  必
                </div>
              )}

              {/* 数据指示器 */}
              {hasData && weekStatus && (
                <div className={`week-indicator week-indicator--${weekStatus}`}></div>
              )}
            </div>
          )
        })}
      </div>

      {/* 说明 — 按个人评级分档 */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-800"></div>
          <span>极度看多 (≥10★)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span>看多 (4–9★)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-700"></div>
          <span>中性 (-3–3★)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <span>看空 (-9–-4★)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-800"></div>
          <span>极度看空 (≤-10★)</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="week-t0-must week-t0-must--legend week-t0-must--extreme-bullish">必</div>
          <span>T0 必买 / 必卖（右上角，颜色随评级圆点）</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <span>当前周</span>
        </div>
      </div>
    </div>
  )
}

export default WeeklyCalendar
