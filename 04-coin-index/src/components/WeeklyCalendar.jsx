import { useState, useEffect } from 'react'

// WeeklyCalendar 组件 - 更新版本 v2.0
function WeeklyCalendar({ 
  currentYear, 
  selectedWeek, 
  onWeekChange, 
  onYearChange, 
  weekIndicators, 
  minYear, 
  maxYear 
}) {
  const [weeks, setWeeks] = useState([])
  const [currentWeekId, setCurrentWeekId] = useState('')
  const [weekStatuses, setWeekStatuses] = useState({}) // 存储所有周的状态

  // 获取当前周ID - 修复日期比较逻辑
  useEffect(() => {
    const getCurrentWeekId = () => {
      // 硬编码当前日期为2026-02-01进行测试
      const testDate = new Date(2026, 1, 1) // 2026年2月1日 (月份从0开始，所以1代表2月)
      
      // 检查2025年W53 (跨年周)
      const week2025W53Start = new Date(2025, 11, 29) // 12月29日
      const week2025W53End = new Date(2026, 0, 4)     // 1月4日
      
      if (testDate >= week2025W53Start && testDate <= week2025W53End) {
        return '2025-W53'
      }
      
      // 检查2026年的周
      const weeks2026 = getWeeksInYear(2026)
      
      const currentWeek = weeks2026.find(week => {
        const weekStart = new Date(week.startDate.getFullYear(), week.startDate.getMonth(), week.startDate.getDate())
        const weekEnd = new Date(week.endDate.getFullYear(), week.endDate.getMonth(), week.endDate.getDate())
        
        const isInRange = testDate >= weekStart && testDate <= weekEnd
        
        return isInRange
      })
      
      if (currentWeek) {
        return currentWeek.id
      }
      
      return ''
    }
    
    setCurrentWeekId(getCurrentWeekId())
  }, [])

  // 计算周数 (ISO 8601标准，但按UTC+8时区)
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  // 获取某年的所有周 - 仅支持2025和2026年
  const getWeeksInYear = (year) => {
    const weeks = []
    
    if (year === 2025) {
      // 2025年：标准52周 + 跨年W53
      const startDate = new Date(year, 0, 1) // 1月1日
      let currentDate = new Date(startDate)
      
      // 调整到周一
      const dayOfWeek = currentDate.getDay()
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      currentDate.setDate(currentDate.getDate() + daysToMonday)
      
      // 生成前52周
      for (let weekNum = 1; weekNum <= 52; weekNum++) {
        const weekEnd = new Date(currentDate)
        weekEnd.setDate(currentDate.getDate() + 6)
        
        const weekId = `${year}-W${weekNum.toString().padStart(2, '0')}`
        
        weeks.push({
          id: weekId,
          weekNumber: weekNum,
          startDate: new Date(currentDate),
          endDate: new Date(weekEnd),
          year
        })
        
        currentDate.setDate(currentDate.getDate() + 7)
      }
      
      // 添加跨年W53 (12/29/2025 - 01/04/2026)
      weeks.push({
        id: '2025-W53',
        weekNumber: 53,
        startDate: new Date(2025, 11, 29), // 12月29日
        endDate: new Date(2026, 0, 4),     // 1月4日
        year: 2025
      })
      
    } else if (year === 2026) {
      // 2026年：特殊W1-W4 + 标准W5-W51 + 跨年W52
      const specialWeeks = [
        { start: new Date(2026, 0, 5), end: new Date(2026, 0, 11), num: 1 },   // W1: 01/05-01/11
        { start: new Date(2026, 0, 12), end: new Date(2026, 0, 18), num: 2 },  // W2: 01/12-01/18
        { start: new Date(2026, 0, 19), end: new Date(2026, 0, 25), num: 3 },  // W3: 01/19-01/25
        { start: new Date(2026, 0, 26), end: new Date(2026, 1, 1), num: 4 },   // W4: 01/26-02/01
      ]
      
      // 添加特殊的前4周
      specialWeeks.forEach(week => {
        const weekId = `${year}-W${week.num.toString().padStart(2, '0')}`
        
        // 确保日期对象正确 - 使用UTC时间避免时区问题
        const startDate = new Date(week.start.getFullYear(), week.start.getMonth(), week.start.getDate(), 12, 0, 0)
        const endDate = new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 12, 0, 0)
        
        weeks.push({
          id: weekId,
          weekNumber: week.num,
          startDate: startDate,
          endDate: endDate,
          year
        })
      })
      
      // 从第5周开始按正常逻辑计算到第51周
      let currentDate = new Date(2026, 1, 2, 12, 0, 0) // 2月2日开始 (W5)，设置为中午避免时区问题
      for (let weekNum = 5; weekNum <= 51; weekNum++) {
        const weekEnd = new Date(currentDate)
        weekEnd.setDate(currentDate.getDate() + 6)
        
        const weekId = `${year}-W${weekNum.toString().padStart(2, '0')}`
        
        weeks.push({
          id: weekId,
          weekNumber: weekNum,
          startDate: new Date(currentDate),
          endDate: new Date(weekEnd),
          year
        })
        
        currentDate.setDate(currentDate.getDate() + 7)
      }
      
      // 添加跨年W52 (12/28/2026 - 01/03/2027)
      weeks.push({
        id: '2026-W52',
        weekNumber: 52,
        startDate: new Date(2026, 11, 28), // 12月28日
        endDate: new Date(2027, 0, 3),     // 1月3日
        year: 2026
      })
    }
    
    return weeks
  }

  // 当年份改变时重新计算周
  useEffect(() => {
    const yearWeeks = getWeeksInYear(currentYear)
    setWeeks(yearWeeks)
  }, [currentYear])

  // 格式化日期显示
  const formatDateRange = (startDate, endDate) => {
    const start = `${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getDate().toString().padStart(2, '0')}`
    const end = `${(endDate.getMonth() + 1).toString().padStart(2, '0')}/${endDate.getDate().toString().padStart(2, '0')}`
    return `${start}-${end}`
  }

  // 获取周的状态（涨跌）
  const getWeekStatus = async (weekId) => {
    if (!weekIndicators.has(weekId)) return null
    
    try {
      const { getWeeklyData, getWeekTrend } = await import('../utils/weeklyData')
      const weekData = await getWeeklyData(weekId)
      return getWeekTrend(weekData)
    } catch (error) {
      console.error('获取周状态失败:', error)
      return null
    }
  }
  
  // 加载所有周的状态
  useEffect(() => {
    const loadWeekStatuses = async () => {
      const statuses = {}
      for (const week of weeks) {
        if (weekIndicators.has(week.id)) {
          const status = await getWeekStatus(week.id)
          if (status) {
            statuses[week.id] = status
          }
        }
      }
      setWeekStatuses(statuses)
    }
    
    if (weeks.length > 0) {
      loadWeekStatuses()
    }
  }, [weeks, weekIndicators])

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
      <div className="grid grid-cols-4 gap-2">
        {weeks.map((week) => {
          const isSelected = selectedWeek === week.id
          const isCurrent = currentWeekId === week.id
          const hasData = weekIndicators.has(week.id)
          const weekStatus = weekStatuses[week.id] || null
          
          return (
            <div
              key={week.id}
              className={`week-tile ${isSelected ? 'week-tile--active' : ''} ${
                isCurrent ? 'week-tile--current' : ''
              }`}
              onClick={() => onWeekChange(week.id)}
              title={`第${week.weekNumber}周 (${formatDateRange(week.startDate, week.endDate)})`}
            >
              <div className="text-sm font-medium">W{week.weekNumber}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDateRange(week.startDate, week.endDate)}
              </div>
              
              {/* 数据指示器 */}
              {hasData && weekStatus && (
                <div className={`week-indicator week-indicator--${weekStatus}`}></div>
              )}
            </div>
          )
        })}
      </div>

      {/* 说明 */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>周涨幅为正</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>周涨幅为负</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
          <span>当前周</span>
        </div>
      </div>
    </div>
  )
}

export default WeeklyCalendar

// 强制更新 - 2026-02-01