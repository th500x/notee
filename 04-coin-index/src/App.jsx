import { useState, useEffect } from 'react'
import './App.css'
import WeeklyCalendar from './components/WeeklyCalendar'
import DataDisplay from './components/DataDisplay'
import SimulationTable from './components/SimulationTable'
import YearSummary from './components/YearSummary'
import { getWeeklyData, loadWeeklyData, loadAllWeeklyData } from './utils/weeklyData'

function App() {
  const [selectedWeek, setSelectedWeek] = useState(null) // 初始为null，等待当前周计算
  const [currentYear, setCurrentYear] = useState(2026)
  const [weeklyData, setWeeklyData] = useState({}) // 存储当前年份的周数据
  const [allWeeklyData, setAllWeeklyData] = useState({}) // 存储所有年份的周数据（用于模拟演练和年终总结）
  const [weekIndicators, setWeekIndicators] = useState(new Set()) // 存储有数据的周
  const [selectedWeekData, setSelectedWeekData] = useState({}) // 存储当前选中周的数据
  const [showSimulation, setShowSimulation] = useState(false) // 控制模拟演练显示
  const [showSummary, setShowSummary] = useState(false) // 控制年终总结显示
  const [simulationData, setSimulationData] = useState([]) // 存储模拟演练数据

  // 设置年份范围：只支持2025和2026年
  const minYear = 2025
  const maxYear = 2026

  // 获取当前周ID并设置为默认选中周
  useEffect(() => {
    const getCurrentWeekId = () => {
      // 硬编码当前日期为2026-02-11（今天）
      const testDate = new Date(2026, 1, 11) // 2026年2月11日
      
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
        { start: new Date(2026, 1, 2), end: new Date(2026, 1, 8), id: '2026-W05' },
        { start: new Date(2026, 1, 9), end: new Date(2026, 1, 15), id: '2026-W06' },
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
      console.log('📍 App.jsx - 设置初始选中周:', currentWeekId)
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

  // 加载所有年份的数据（用于模拟演练和年终总结）
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const data = await loadAllWeeklyData()
        setAllWeeklyData(data)
        console.log('📊 已加载所有年份数据:', Object.keys(data).length, '周')
      } catch (error) {
        console.error('加载所有数据失败:', error)
        setAllWeeklyData({})
      }
    }
    
    loadAllData()
  }, []) // 只在组件挂载时加载一次

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
              <a 
                href="/"
                className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer relative group inline-block"
                title="返回主页"
              >
                區塊指標
                {/* 悬停提示 */}
                <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  返回主页
                </span>
              </a>
              <p className="text-gray-600 mt-2">点击周数查看当周的区块链市场指标</p>
            </div>
            {/* 功能按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSimulation(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📊 模拟演练
              </button>
              <button
                onClick={() => setShowSummary(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📈 年终总结
              </button>
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

      {/* 模拟演练模态框 */}
      {showSimulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <SimulationTable
              weeklyData={allWeeklyData}
              selectedYear={currentYear}
              onClose={() => setShowSimulation(false)}
              onDataGenerated={(data) => setSimulationData(data)}
            />
          </div>
        </div>
      )}

      {/* 年终总结模态框 */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <YearSummary
              weeklyData={allWeeklyData}
              selectedYear={currentYear}
              simulationData={simulationData}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App