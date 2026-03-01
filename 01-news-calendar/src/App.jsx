import { useState, useEffect } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './App.css'
import NewsDisplay from './components/NewsDisplay'
import HotNews from './components/HotNews'
import { getNewsForDate, loadNewsData } from './utils/newsData'

function App() {
  const [selectedDate, setSelectedDate] = useState(null) // 初始为null，等待动态计算
  const [currentMonth, setCurrentMonth] = useState(null) // 初始为null，等待动态计算
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

  // 加载新闻数据并提取有新闻的日期
  useEffect(() => {
    const loadNews = async () => {
      try {
        const data = await loadNewsData()
        setNewsData(data)
        
        // 从新闻数据中提取所有有新闻的日期
        const indicators = new Set()
        const datesWithNews = []
        
        Object.keys(data).forEach(dateKey => {
          const newsForDate = data[dateKey]
          // 检查该日期是否有任何分类的新闻
          const hasNews = Object.values(newsForDate).some(categoryNews => 
            Array.isArray(categoryNews) && categoryNews.length > 0
          )
          if (hasNews) {
            // 将日期字符串转换为Date对象的toDateString格式
            const [year, month, day] = dateKey.split('-')
            const date = new Date(year, month - 1, day)
            indicators.add(date.toDateString())
            datesWithNews.push(date)
          }
        })
        
        setNewsIndicators(indicators)
        setIndicatorsLoaded(true)
        console.log(`[App] 加载完成，共有 ${indicators.size} 天有新闻`)
        
        // 动态计算默认日期：优先当前月份，其次上个月，最后是最新有新闻的日期
        if (datesWithNews.length > 0) {
          const today = new Date()
          const currentYear = today.getFullYear()
          const currentMonthNum = today.getMonth()
          
          // 检查当前月份是否有新闻
          const currentMonthNews = datesWithNews.find(date => 
            date.getFullYear() === currentYear && date.getMonth() === currentMonthNum
          )
          
          if (currentMonthNews) {
            // 当前月份有新闻，选择当前月份的第一天
            const defaultDate = new Date(currentYear, currentMonthNum, 1)
            setSelectedDate(defaultDate)
            setCurrentMonth(defaultDate)
            console.log(`[App] 默认日期：当前月份 ${defaultDate.toLocaleDateString()}`)
          } else {
            // 当前月份没有新闻，检查上个月
            const lastMonthNum = currentMonthNum === 0 ? 11 : currentMonthNum - 1
            const lastMonthYear = currentMonthNum === 0 ? currentYear - 1 : currentYear
            
            const lastMonthNews = datesWithNews.find(date => 
              date.getFullYear() === lastMonthYear && date.getMonth() === lastMonthNum
            )
            
            if (lastMonthNews) {
              // 上个月有新闻，选择上个月的第一天
              const defaultDate = new Date(lastMonthYear, lastMonthNum, 1)
              setSelectedDate(defaultDate)
              setCurrentMonth(defaultDate)
              console.log(`[App] 默认日期：上个月 ${defaultDate.toLocaleDateString()}`)
            } else {
              // 当前月和上个月都没有新闻，选择最新有新闻的日期
              const latestDate = datesWithNews.sort((a, b) => b - a)[0]
              const firstDayOfMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
              setSelectedDate(firstDayOfMonth)
              setCurrentMonth(firstDayOfMonth)
              console.log(`[App] 默认日期：最新有新闻的月份 ${firstDayOfMonth.toLocaleDateString()}`)
            }
          }
        } else {
          // 没有任何新闻数据，使用2026年1月1日作为后备
          const fallbackDate = new Date(2026, 0, 1)
          setSelectedDate(fallbackDate)
          setCurrentMonth(fallbackDate)
          console.log(`[App] 默认日期：后备日期 ${fallbackDate.toLocaleDateString()}`)
        }
      } catch (error) {
        console.error('加载新闻数据失败:', error)
        setNewsData({})
        setIndicatorsLoaded(true)
        // 出错时使用后备日期
        const fallbackDate = new Date(2026, 0, 1)
        setSelectedDate(fallbackDate)
        setCurrentMonth(fallbackDate)
      }
    }
    
    loadNews()
  }, [])

  // 当选中日期改变时，加载对应的新闻数据
  useEffect(() => {
    // 等待 selectedDate 被设置后再加载
    if (!selectedDate) return
    
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
        {/* 数据加载中显示 */}
        {!selectedDate ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  )
}

export default App