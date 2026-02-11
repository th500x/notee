// 周数据处理工具函数 - 更新版本 v3.0 (支持真实API数据)

// 尝试加载真实数据，如果失败则使用模拟数据
let realWeeklyData = {}

// 异步加载真实数据
const loadRealData = async () => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      '/04-coin-index/weeklyData.json',  // 生产环境路径
      '/weeklyData.json',                // 开发环境路径
      './weeklyData.json'                // 相对路径
    ]
    
    for (const path of possiblePaths) {
      try {
        console.log(`🔍 尝试加载数据: ${path}`)
        const response = await fetch(path)
        if (response.ok) {
          realWeeklyData = await response.json()
          console.log('📊 已加载真实周数据:', Object.keys(realWeeklyData).length, '周', `来源: ${path}`)
          return
        }
      } catch (error) {
        console.log(`❌ 路径 ${path} 加载失败:`, error.message)
      }
    }
    
    console.log('⚠️ 所有路径都失败，使用模拟数据')
  } catch (error) {
    console.log('⚠️ 数据加载异常，使用模拟数据:', error.message)
  }
}

// 初始化时加载数据
loadRealData()

// 模拟数据 - 后续会替换为真实API调用 - UPDATED
const mockWeeklyData = {
  // 2025年数据
  '2025-W53': {
    weekId: '2025-W53',
    year: 2025,
    weekNumber: 53,
    weekStart: '2025-12-29',  // 2025年最后一周，跨年到2026年
    weekEnd: '2026-01-04',
    btcWeeklyChange: 3.8,
    btcWeeklyAvgPrice: 98750,
    ethWeeklyAvgPrice: 3420,
    fearGreedIndex: 55,
    mayerMultiple: 1.95,
    ahr999: 1.05,
    ethBtcRatio: 0.041,
    btcFromATH: -12.3,
    marketTrend: 'bullish',
    updatedAt: '2026-01-04T23:59:59Z'
  },
  
  // 2026年数据
  '2026-W01': {
    weekId: '2026-W01',
    year: 2026,
    weekNumber: 1,
    weekStart: '2026-01-05',  // 修正：2026年第1周从1月5日开始
    weekEnd: '2026-01-11',
    btcWeeklyChange: -5.2,
    btcWeeklyAvgPrice: 95420,
    ethWeeklyAvgPrice: 3280,
    fearGreedIndex: 25,
    mayerMultiple: 1.8,
    ahr999: 0.85,
    ethBtcRatio: 0.042,
    btcFromATH: -15.5,
    marketTrend: 'bearish',
    updatedAt: '2026-01-11T23:59:59Z'
  },
  '2026-W02': {
    weekId: '2026-W02',
    year: 2026,
    weekNumber: 2,
    weekStart: '2026-01-12',  // 第2周从1月12日开始
    weekEnd: '2026-01-18',
    btcWeeklyChange: 8.7,
    btcWeeklyAvgPrice: 103750,
    ethWeeklyAvgPrice: 3565,
    fearGreedIndex: 65,
    mayerMultiple: 2.1,
    ahr999: 1.15,
    ethBtcRatio: 0.045,
    btcFromATH: -8.2,
    marketTrend: 'bullish',
    updatedAt: '2026-01-18T23:59:59Z'
  },
  '2026-W03': {
    weekId: '2026-W03',
    year: 2026,
    weekNumber: 3,
    weekStart: '2026-01-19',  // 第3周从1月19日开始
    weekEnd: '2026-01-25',
    btcWeeklyChange: -2.1,
    btcWeeklyAvgPrice: 101580,
    ethWeeklyAvgPrice: 3490,
    fearGreedIndex: 45,
    mayerMultiple: 1.9,
    ahr999: 0.95,
    ethBtcRatio: 0.043,
    btcFromATH: -10.1,
    marketTrend: 'bearish',
    updatedAt: '2026-01-25T23:59:59Z'
  },
  '2026-W04': {
    weekId: '2026-W04',
    year: 2026,
    weekNumber: 4,
    weekStart: '2026-01-26',  // 第4周从1月26日开始
    weekEnd: '2026-02-01',
    btcWeeklyChange: 2.3,
    btcWeeklyAvgPrice: 104200,
    ethWeeklyAvgPrice: 3620,
    fearGreedIndex: 58,
    mayerMultiple: 2.0,
    ahr999: 1.08,
    ethBtcRatio: 0.044,
    btcFromATH: -7.5,
    marketTrend: 'bullish',
    updatedAt: '2026-02-01T23:59:59Z'
  },
  '2026-W52': {
    weekId: '2026-W52',
    year: 2026,
    weekNumber: 52,
    weekStart: '2026-12-28',  // 2026年最后一周，跨年到2027年
    weekEnd: '2027-01-03',
    btcWeeklyChange: 4.5,
    btcWeeklyAvgPrice: 125680,
    ethWeeklyAvgPrice: 4250,
    fearGreedIndex: 78,
    mayerMultiple: 2.3,
    ahr999: 1.35,
    ethBtcRatio: 0.048,
    btcFromATH: -2.8,
    marketTrend: 'bullish',
    updatedAt: '2027-01-03T23:59:59Z'
  }
}

// 加载指定年份的所有周数据
export const loadWeeklyData = async (year) => {
  try {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 优先使用真实数据
    const dataSource = Object.keys(realWeeklyData).length > 0 ? realWeeklyData : mockWeeklyData
    
    // 过滤出指定年份的数据
    const yearData = {}
    Object.keys(dataSource).forEach(weekId => {
      if (dataSource[weekId].year === year) {
        yearData[weekId] = dataSource[weekId]
      }
    })
    
    console.log(`📊 加载 ${year} 年数据:`, Object.keys(yearData).length, '周')
    return yearData
  } catch (error) {
    console.error('加载周数据失败:', error)
    return {}
  }
}

// 加载所有年份的数据（用于模拟演练和年终总结）
export const loadAllWeeklyData = async () => {
  try {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 优先使用真实数据
    const dataSource = Object.keys(realWeeklyData).length > 0 ? realWeeklyData : mockWeeklyData
    
    console.log(`📊 加载所有数据:`, Object.keys(dataSource).length, '周')
    return dataSource
  } catch (error) {
    console.error('加载所有周数据失败:', error)
    return {}
  }
}

// 获取指定周的数据 - 优先使用真实数据
export const getWeeklyData = async (weekId) => {
  try {
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // 优先返回真实数据
    if (realWeeklyData[weekId]) {
      console.log(`📊 使用真实数据: ${weekId}`)
      return realWeeklyData[weekId]
    }
    
    // 回退到模拟数据
    if (mockWeeklyData[weekId]) {
      console.log(`🎭 使用模拟数据: ${weekId}`)
      return mockWeeklyData[weekId]
    }
    
    return {}
  } catch (error) {
    console.error('获取周数据失败:', error)
    return {}
  }
}

// 检查指定周是否有数据 - 检查真实数据和模拟数据
export const hasDataForWeek = async (weekId) => {
  try {
    return !!(realWeeklyData[weekId] || mockWeeklyData[weekId])
  } catch (error) {
    console.error('检查周数据失败:', error)
    return false
  }
}

// 获取周的涨跌状态
export const getWeekTrend = (weekData) => {
  if (!weekData || weekData.btcWeeklyChange === null || weekData.btcWeeklyChange === undefined) {
    return null
  }
  return weekData.btcWeeklyChange >= 0 ? 'bullish' : 'bearish'
}

// 格式化周ID
export const formatWeekId = (year, weekNumber) => {
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`
}

// 解析周ID
export const parseWeekId = (weekId) => {
  const [year, week] = weekId.split('-W')
  return {
    year: parseInt(year),
    weekNumber: parseInt(week)
  }
}

// 获取当前周ID (UTC+8时区)
export const getCurrentWeekId = () => {
  const now = new Date()
  // 转换为UTC+8时间
  const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  const year = utc8Time.getFullYear()
  
  // 计算周数 (ISO 8601标准)
  const d = new Date(Date.UTC(utc8Time.getFullYear(), utc8Time.getMonth(), utc8Time.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  
  return formatWeekId(year, weekNumber)
}

// 获取周的日期范围
export const getWeekDateRange = (year, weekNumber) => {
  const firstDay = new Date(year, 0, 1)
  let currentMonday = new Date(firstDay)
  
  // 找到第一周的周一
  const dayOfWeek = firstDay.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentMonday.setDate(firstDay.getDate() + daysToMonday)
  
  // 移动到指定周
  currentMonday.setDate(currentMonday.getDate() + (weekNumber - 1) * 7)
  
  const weekEnd = new Date(currentMonday)
  weekEnd.setDate(currentMonday.getDate() + 6)
  
  return {
    start: currentMonday,
    end: weekEnd
  }
}