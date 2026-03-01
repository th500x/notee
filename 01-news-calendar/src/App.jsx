import { useState, useEffect } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './App.css'
import NewsDisplay from './components/NewsDisplay'
import HotNews from './components/HotNews'
import { getNewsForDate, loadNewsData } from './utils/newsData'

function App() {
  // 计算上个月的首日作为初始选中日期
  const getLastMonthFirstDay = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    
    // 如果当前是1月，则上个月是去年12月
    if (month === 0) {
      return new Date(year - 1, 11, 1) // 去年12月1日
    } else {
      return new Date(year, month - 1, 1) // 上个月1日
    }
  }
  
  const [selectedDate, setSelectedDate] = useState(getLastMonthFirstDay())
  const [currentMonth, setCurrentMonth] = useState(getLastMonthFirstDay())
  const [newsData, setNewsData] = useState({}) // 存储所有新闻数据
  const [newsIndicators, setNewsIndicators] = useState(new Set()) // 存储有新闻的日期
  const [indicatorsLoaded, setIndicatorsLoaded] = useState(false) // 标记指示器是否已加载
  const [selectedDateNews, setSelectedDateNews] = useState({}) // 存储当前选中日期的新闻
  const [hotNewsRefresh, setHotNewsRefresh] = useState(0) // 热门新闻刷新触发器

  // 设置最早可访问的日期为2026年1月1日
  const minDate = new Date(2026, 0, 1) // 2026年1月1日
  
  // 设置最晚可访问的日期为2026年1月31日（当前有数据的最后一天）
  const maxDate = new Date(2026, 0, 31) // 2026年1月31日

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
      setIndicatorsLoaded(false) // 开始加载时设置为false
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
      setIndicatorsLoaded(true) // 加载完成后设置为true
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

  // 为日历tile添加自定义类名
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      // 检查日期是否在有效范围内
      if (date >= minDate && date <= maxDate) {
        // 只有在指示器加载完成后才应用灰色样式
        if (indicatorsLoaded && !newsIndicators.has(date.toDateString())) {
          return 'no-news-date'
        }
      }
    }
    return null
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
                新聞筆記
                {/* 悬停提示 */}
                <span className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  返回主页
                </span>
              </a>
              <p className="text-gray-600 mt-2">点击日期查看当天的重要新闻</p>
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
                tileClassName={tileClassName}
                minDate={minDate}
                maxDate={maxDate}
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
            {/* 当天新闻内容 - 移动端优先显示 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <NewsDisplay 
                selectedDate={selectedDate}
                newsData={selectedDateNews}
                onEmojiUpdate={refreshHotNews}
              />
            </div>
            
            {/* 手机端热门新闻 - 显示在新闻内容之后 */}
            <div className="lg:hidden">
              <HotNews refreshTrigger={hotNewsRefresh} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App