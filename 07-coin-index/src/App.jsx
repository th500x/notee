import { useState, useEffect } from 'react'
import './App.css'
import WeeklyCalendar from './components/WeeklyCalendar'
import DataDisplay from './components/DataDisplay'
import SimulationTable from './components/SimulationTable'
import YearSummary from './components/YearSummary'
import { useWeeklyData, useYearlyData, useSelectedWeekData } from './hooks/useWeeklyData'
import { useCurrentWeek } from './hooks/useCurrentWeek'
import { YEAR_RANGE } from './constants'

function App() {
  // 使用自定义Hooks管理数据
  const { allWeeklyData, loading } = useWeeklyData()
  const currentWeekId = useCurrentWeek()
  
  // 状态管理
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [currentYear, setCurrentYear] = useState(YEAR_RANGE.DEFAULT)
  const [showSimulation, setShowSimulation] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [simulationDataByYear, setSimulationDataByYear] = useState({}) // 按年份存储模拟数据

  // 从allWeeklyData计算派生数据
  const weeklyData = useYearlyData(allWeeklyData, currentYear)
  const selectedWeekData = useSelectedWeekData(allWeeklyData, selectedWeek)

  // 年份范围
  const minYear = YEAR_RANGE.MIN
  const maxYear = YEAR_RANGE.MAX

  // 设置初始选中周
  useEffect(() => {
    if (!selectedWeek && currentWeekId) {
      setSelectedWeek(currentWeekId)
    }
  }, [selectedWeek, currentWeekId])

  // 处理周切换
  const handleWeekChange = (weekId) => {
    setSelectedWeek(weekId)
  }

  // 处理年份切换
  const handleYearChange = (year) => {
    // 限制在年份范围内
    if (year < minYear || year > maxYear) {
      return
    }
    setCurrentYear(year)
    setSelectedWeek(null) // 清除选中的周，让useEffect重新设置
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">加载数据中...</h3>
          <p className="text-sm text-gray-600">请稍候</p>
        </div>
      </div>
    )
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 周日历区域 */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-lg shadow-md p-6">
              <WeeklyCalendar
                currentYear={currentYear}
                selectedWeek={selectedWeek}
                onWeekChange={handleWeekChange}
                onYearChange={handleYearChange}
                minYear={minYear}
                maxYear={maxYear}
              />
            </div>
          </div>

          {/* 数据显示区域 */}
          <div className="lg:col-span-7">
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
              onDataGenerated={(data) => {
                // 按年份存储模拟数据
                setSimulationDataByYear(prev => ({
                  ...prev,
                  [currentYear]: data
                }))
              }}
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
              simulationData={simulationDataByYear[currentYear] || []}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App