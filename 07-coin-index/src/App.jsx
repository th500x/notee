import { useState, useEffect, useMemo } from 'react'
import './App.css'
import WeeklyCalendar from './components/WeeklyCalendar'
import EthMaWorkbench from './components/EthMaWorkbench'
import DataDisplay from './components/DataDisplay'
import WalletAssetsPanel from './components/WalletAssetsPanel'
import SimulationTable from './components/SimulationTable'
import YearSummary from './components/YearSummary'
import { useWeeklyData, useYearlyData, useSelectedWeekData } from './hooks/useWeeklyData'
import { useCurrentWeek } from './hooks/useCurrentWeek'
import { useLifeResumeAuth } from './hooks/useLifeResumeAuth'
import { getConfiguredYearRange, getWeeksInYear } from './utils/weekCalculator'
import { computeT0MustMap } from './utils/t0Must'
import { computeT1RecommendMap } from './utils/t1Recommend'

function App() {
  const yearRange = useMemo(() => getConfiguredYearRange(), [])
  // 使用自定义Hooks管理数据
  const { allWeeklyData, loading } = useWeeklyData()
  const currentWeekId = useCurrentWeek()
  const auth = useLifeResumeAuth()
  
  // 状态管理
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [currentYear, setCurrentYear] = useState(yearRange.default)
  const [showSimulation, setShowSimulation] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  // 从allWeeklyData计算派生数据
  const weeklyData = useYearlyData(allWeeklyData, currentYear)
  const selectedWeekData = useSelectedWeekData(allWeeklyData, selectedWeek)
  const t0MustByWeek = useMemo(() => computeT0MustMap(allWeeklyData), [allWeeklyData])
  const t1RecommendByWeek = useMemo(
    () => computeT1RecommendMap(allWeeklyData),
    [allWeeklyData],
  )

  // 年份范围（随今天自动延伸，无需改常量）
  const minYear = yearRange.min
  const maxYear = yearRange.max

  // 仅首次：对齐到「今天所在周」；勿在 selectedWeek 被清空时再跑，否则会把手动切年拽回本周年份
  useEffect(() => {
    if (selectedWeek || !currentWeekId) return
    setSelectedWeek(currentWeekId)
    const match = /^(\d{4})-W\d{2}$/.exec(currentWeekId)
    if (match) setCurrentYear(Number(match[1]))
  }, [selectedWeek, currentWeekId])

  // 处理周切换
  const handleWeekChange = (weekId) => {
    setSelectedWeek(weekId)
  }

  // 处理年份切换
  const handleYearChange = (year) => {
    if (year < minYear || year > maxYear) {
      return
    }
    setCurrentYear(year)
    // 选中该年第一周；若置 null，上方 effect 会用「本周」把年份改回去（切换闪一下）
    const weeks = getWeeksInYear(year)
    setSelectedWeek(weeks[0]?.id ?? null)
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
                📈 年度总结
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
                t0MustByWeek={t0MustByWeek}
                t1RecommendByWeek={t1RecommendByWeek}
              />
            </div>
          </div>

          {/* 数据显示区域 */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-lg shadow-md p-6">
              <DataDisplay 
                selectedWeek={selectedWeek}
                weeklyData={selectedWeekData}
                t0Must={selectedWeek ? t0MustByWeek[selectedWeek] : null}
                t1Recommend={selectedWeek ? t1RecommendByWeek[selectedWeek] : null}
              />
            </div>
            <WalletAssetsPanel auth={auth} />
          </div>
        </div>
        <EthMaWorkbench auth={auth} />
      </main>

      {/* 模拟演练模态框 */}
      {showSimulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <SimulationTable
              weeklyData={allWeeklyData}
              selectedYear={currentYear}
              onClose={() => setShowSimulation(false)}
            />
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <YearSummary
              weeklyData={allWeeklyData}
              selectedYear={currentYear}
              onClose={() => setShowSummary(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App