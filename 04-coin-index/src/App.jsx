import { useState, useEffect } from 'react'
import './App.css'
import WeeklyCalendar from './components/WeeklyCalendar'
import DataDisplay from './components/DataDisplay'
import { getWeeklyData, loadWeeklyData } from './utils/weeklyData'

function App() {
  const [selectedWeek, setSelectedWeek] = useState(null) // 初始为null，等待当前周计算
  const [currentYear, setCurrentYear] = useState(2026)
  const [weeklyData, setWeeklyData] = useState({}) // 存储所有周数据
  const [weekIndicators, setWeekIndicators] = useState(new Set()) // 存储有数据的周
  const [selectedWeekData, setSelectedWeekData] = useState({}) // 存储当前选中周的数据

  // 设置年份范围：只支持2025和2026年
  const minYear = 2025
  const maxYear = 2026

  // 获取当前周ID并设置为默认选中周
  useEffect(() => {
    const getCurrentWeekId = () => {
      // 硬编码当前日期为2026-02-01
      const testDate = new Date(2026, 1, 1) // 2026年2月1日
      
      // 检查2025年W53 (跨年周)
      const week2025W53Start = new Date(2025, 11, 29) // 12月29日
      const week2025W53End = new Date(2026, 0, 4)     // 1月4日
      
      if (testDate >= week2025W53Start && testDate <= week2025W53End) {
        return '2025-W53'
      }
      
      // 检查2026年的周 - 使用与WeeklyCalendar相同的逻辑
      const specialWeeks = [
        { start: new Date(2026, 0, 5), end: new Date(2026, 0, 11), id: '2026-W01' },
        { start: new Date(2026, 0, 12), end: new Date(2026, 0, 18), id: '2026-W02' },
        { start: new Date(2026, 0, 19), end: new Date(2026, 0, 25), id: '2026-W03' },
        { start: new Date(2026, 0, 26), end: new Date(2026, 1, 1), id: '2026-W04' },
      ]
      
      for (const week of specialWeeks) {
        if (testDate >= week.start && testDate <= week.end) {
          console.log('🔍 App.jsx - 找到当前周:', week.id)
          return week.id
        }
      }
      
      // 默认返回W01如果没找到
      return '2026-W01'
    }
    
    if (!selectedWeek) {
      const currentWeekId = getCurrentWeekId()
      setSelectedWeek(currentWeekId)
    }
  }, [selectedWeek])

  // 加载周数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await loadWeeklyData(currentYear)
        setWeeklyData(data)
      } catch (error) {
        console.error('加载周数据失败:', error)
        setWeeklyData({})
      }
    }
    
    loadData()
  }, [currentYear])

  // 当选中周改变时，加载对应的数据
  useEffect(() => {
    const loadSelectedWeekData = async () => {
      if (!selectedWeek) return
      
      console.log('🔍 App.jsx - 加载选中周数据:', selectedWeek)
      
      try {
        const data = await getWeeklyData(selectedWeek)
        console.log('📊 App.jsx - 获取到的数据:', data)
        setSelectedWeekData(data)
      } catch (error) {
        console.error('❌ App.jsx - 加载选中周数据失败:', error)
        setSelectedWeekData({})
      }
    }
    
    loadSelectedWeekData()
  }, [selectedWeek])

  // 检查某个周是否有数据
  const hasDataForWeek = async (weekId) => {
    try {
      const { hasDataForWeek: checkData } = await import('./utils/weeklyData')
      return await checkData(weekId)
    } catch (error) {
      console.error('检查周数据失败:', error)
      return false
    }
  }

  // 检查当前年份的所有周是否有数据
  useEffect(() => {
    const checkYearData = async () => {
      const indicators = new Set()
      
      // 检查当年每一周是否有数据
      for (let week = 1; week <= 53; week++) {
        const weekId = `${currentYear}-W${week.toString().padStart(2, '0')}`
        const hasData = await hasDataForWeek(weekId)
        if (hasData) {
          indicators.add(weekId)
        }
      }
      
      setWeekIndicators(indicators)
    }
    
    checkYearData()
  }, [currentYear])

  const handleWeekChange = (weekId) => {
    setSelectedWeek(weekId)
  }

  const handleYearChange = (year) => {
    // 限制在2025-2026年范围内
    if (year < minYear || year > maxYear) {
      return
    }
    setCurrentYear(year)
    setSelectedWeek(null) // 清除选中的周，让useEffect重新计算当前周
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">區塊指標</h1>
              <p className="text-gray-600 mt-2">点击周数查看当周的区块链市场指标</p>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="/" 
                className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                title="返回主页"
              >
                🍺 LOVE & PEACE!
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 周日历区域 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <WeeklyCalendar
                currentYear={currentYear}
                selectedWeek={selectedWeek}
                onWeekChange={handleWeekChange}
                onYearChange={handleYearChange}
                weekIndicators={weekIndicators}
                minYear={minYear}
                maxYear={maxYear}
              />
            </div>
          </div>

          {/* 数据显示区域 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <DataDisplay 
                selectedWeek={selectedWeek}
                weeklyData={selectedWeekData}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App