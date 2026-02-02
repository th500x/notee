import { useState, useEffect } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './App.css'
import NewsDisplay from './components/NewsDisplay'
import HotNews from './components/HotNews'
import { getNewsForDate, loadNewsData } from './utils/newsData'

function App() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [newsData, setNewsData] = useState({}) // 存储所有新闻数据
  const [newsIndicators, setNewsIndicators] = useState(new Set()) // 存储有新闻的日期
  const [selectedDateNews, setSelectedDateNews] = useState({}) // 存储当前选中日期的新闻
  const [hotNewsRefresh, setHotNewsRefresh] = useState(0) // 热门新闻刷新触发器

  // 设置最早可访问的日期为2026年1月1日
  const minDate = new Date(2026, 0, 1) // 2026年1月1日

  // Refresh hot news function
  const refreshHotNews = () => {
    setHotNewsRefresh(prev => prev + 1)
  }

  // 加载新闻数据
  useEffect(() => {
    const loadNews = async () => {
      try {
        const data = await loadNewsData()
        setNewsData(data)
      } catch (error) {
        console.error('加载新闻数据失败:', error)
        setNewsData({})
      }
    }
    
    loadNews()
  }, [])

  // 当选中日期改变时，加载对应的新闻数据
  useEffect(() => {
    const loadSelectedDateNews = async () => {
      try {
        const news = await getNewsForDate(selectedDate)
        setSelectedDateNews(news)
      } catch (error) {
        console.error('加载选中日期新闻失败:', error)
        setSelectedDateNews({})
      }
    }
    
    loadSelectedDateNews()
  }, [selectedDate])

  // 检查某个日期是否有新闻
  const hasNewsForDate = async (date) => {
    try {
      const { hasNewsForDate: checkNews } = await import('./utils/newsData')
      return await checkNews(date)
    } catch (error) {
      console.error('检查新闻失败:', error)
      return false
    }
  }

  // 检查日历当前月份的所有日期是否有新闻
  useEffect(() => {
    const checkMonthNews = async () => {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const indicators = new Set()
      
      // 检查当月每一天是否有新闻
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day)
        const hasNews = await hasNewsForDate(date)
        if (hasNews) {
          indicators.add(date.toDateString())
        }
      }
      
      setNewsIndicators(indicators)
    }
    
    checkMonthNews()
  }, [currentMonth])

  const handleDateChange = (date) => {
    setSelectedDate(date)
  }

  const handleActiveStartDateChange = ({ activeStartDate }) => {
    // 防止导航到2026年1月之前
    if (activeStartDate < minDate) {
      return
    }
    setCurrentMonth(activeStartDate)
  }

  const tileContent = ({ date, view }) => {
    if (view === 'month' && newsIndicators.has(date.toDateString())) {
      return <div className="news-indicator"></div>
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">新聞筆記</h1>
              <p className="text-gray-600 mt-2">点击日期查看当天的重要新闻</p>
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
          {/* 日历区域 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                onActiveStartDateChange={handleActiveStartDateChange}
                tileContent={tileContent}
                minDate={minDate}
                className="w-full"
                locale="zh-CN"
              />
            </div>
            
            {/* 热门新闻区域 - 在桌面端显示在日历下方，手机端显示在新闻上方 */}
            <div className="hidden lg:block">
              <HotNews refreshTrigger={hotNewsRefresh} />
            </div>
          </div>

          {/* 新闻显示区域 */}
          <div className="lg:col-span-2">
            {/* 手机端热门新闻 */}
            <div className="lg:hidden mb-6">
              <HotNews refreshTrigger={hotNewsRefresh} />
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <NewsDisplay 
                selectedDate={selectedDate}
                newsData={selectedDateNews}
                onEmojiUpdate={refreshHotNews}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App