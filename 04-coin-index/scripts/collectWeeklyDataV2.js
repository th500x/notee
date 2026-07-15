// 周数据收集脚本V2 - 带失败重试机制
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// BTC ATH价格 - 固定值
const BTC_ATH_PRICE = 126080

// 计算BTC距ATH回撤百分比
const calculateBTCFromATH = (currentPrice) => {
  const drawdown = ((currentPrice - BTC_ATH_PRICE) / BTC_ATH_PRICE) * 100
  return parseFloat(drawdown.toFixed(1))
}

// CoinGecko API配置
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'
const REQUEST_DELAY = 25000 // 25秒延迟
const RETRY_DELAY = 30000   // 重试延迟30秒
const MAX_RETRIES = 1

// 支持的币种
const COINS = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum'
}

// 工具函数：格式化日期为CoinGecko API格式 (dd-mm-yyyy)
const formatDateForAPI = (date) => {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

// 工具函数：延迟执行
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 工具函数：获取上一周的weekId
const getPreviousWeekId = (weekId) => {
  const [year, weekStr] = weekId.split('-W')
  const weekNum = parseInt(weekStr)
  
  if (weekNum === 1) {
    const prevYear = parseInt(year) - 1
    const lastWeekOfPrevYear = prevYear === 2025 ? 53 : 52
    return `${prevYear}-W${lastWeekOfPrevYear.toString().padStart(2, '0')}`
  } else {
    return `${year}-W${(weekNum - 1).toString().padStart(2, '0')}`
  }
}

// 获取指定日期的币种价格 - 带重试机制
const getCoinPriceOnDate = async (coinId, date, retryCount = 0) => {
  try {
    const dateStr = formatDateForAPI(date)
    const url = `${COINGECKO_API_BASE}/coins/${coinId}/history?date=${dateStr}`
    
    console.log(`📡 获取 ${coinId} 在 ${dateStr} 的价格... (尝试 ${retryCount + 1}/${MAX_RETRIES + 1})`)
    
    const response = await fetch(url)
    
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        console.log(`⏳ API限制，等待 ${RETRY_DELAY/1000} 秒后重试...`)
        await delay(RETRY_DELAY)
        return await getCoinPriceOnDate(coinId, date, retryCount + 1)
      } else {
        throw new Error(`API请求失败: 达到最大重试次数`)
      }
    }
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const data = await response.json()
    const price = data.market_data?.current_price?.usd
    
    if (!price) {
      throw new Error(`未找到价格数据`)
    }
    
    console.log(`💰 ${coinId} 价格: ${price}`)
    return price
    
  } catch (error) {
    console.error(`❌ 获取 ${coinId} 价格失败:`, error.message)
    return null
  }
}

// 收集一周的币种数据 - 带失败重试
const collectCoinWeekData = async (coinId, startDate, endDate) => {
  const allDates = []
  let currentDate = new Date(startDate)
  
  // 生成所有日期
  while (currentDate <= endDate) {
    allDates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  console.log(`\n📊 收集 ${coinId} 数据 (${allDates.length}天)...`)
  
  const prices = []
  const dates = []
  const failedDates = []
  
  // 第一轮：收集所有日期
  for (const date of allDates) {
    const price = await getCoinPriceOnDate(coinId, date)
    
    if (price !== null) {
      prices.push(price)
      dates.push(date.toISOString().split('T')[0])
    } else {
      failedDates.push(date)
    }
    
    await delay(REQUEST_DELAY)
  }
  
  // 第二轮：重试失败的日期
  if (failedDates.length > 0) {
    console.log(`\n🔄 ${coinId}: 重试 ${failedDates.length} 个失败的日期...`)
    await delay(30000)
    
    for (const date of failedDates) {
      const price = await getCoinPriceOnDate(coinId, date)
      
      if (price !== null) {
        prices.push(price)
        dates.push(date.toISOString().split('T')[0])
        console.log(`✅ 重试成功`)
      } else {
        console.log(`❌ 重试仍然失败`)
      }
      
      await delay(REQUEST_DELAY)
    }
  }
  
  if (prices.length === 0) {
    console.error(`❌ ${coinId}: 未获取到任何价格数据`)
    return null
  }
  
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length
  
  console.log(`📊 ${coinId} 周均价: ${average.toFixed(2)} (基于${prices.length}/${allDates.length}天数据)`)
  
  // 检查数据完整性
  if (prices.length < allDates.length) {
    console.log(`⚠️  ${coinId}: 缺失 ${allDates.length - prices.length} 天数据`)
  }
  
  return {
    average: parseFloat(average.toFixed(2)),
    prices: prices,
    dates: dates,
    dataPoints: prices.length,
    isComplete: prices.length === allDates.length
  }
}

// 计算BTC周涨跌幅
const calculateBTCWeeklyChange = async (currentWeekAvgPrice, previousWeekId) => {
  try {
    console.log('\n📈 计算BTC周涨跌幅...')
    
    const weeklyDataPath = path.join(__dirname, '../public/weeklyData.json')
    let weeklyData = {}
    
    if (fs.existsSync(weeklyDataPath)) {
      const fileContent = fs.readFileSync(weeklyDataPath, 'utf-8')
      weeklyData = JSON.parse(fileContent)
    }
    
    const previousWeekData = weeklyData[previousWeekId]
    
    if (!previousWeekData || !previousWeekData.btcWeeklyAvgPrice) {
      console.log(`⚠️ 无法获取上周(${previousWeekId})的BTC周均价数据，使用默认值0`)
      return 0
    }
    
    const previousWeekAvgPrice = previousWeekData.btcWeeklyAvgPrice
    const weeklyChange = ((currentWeekAvgPrice - previousWeekAvgPrice) / previousWeekAvgPrice) * 100
    
    console.log(`📊 BTC周涨跌幅: ${weeklyChange.toFixed(2)}% (上周均价 ${previousWeekAvgPrice} → 本周均价 ${currentWeekAvgPrice})`)
    
    return parseFloat(weeklyChange.toFixed(2))
    
  } catch (error) {
    console.error('❌ 计算BTC周涨跌幅失败:', error.message)
    return 0
  }
}

// 计算ETH/BTC市值比
const calculateETHBTCRatio = async (weekEndDate) => {
  try {
    console.log('\n📊 计算ETH/BTC市值比...')
    
    const ethPrice = await getCoinPriceOnDate(COINS.ethereum, weekEndDate)
    await delay(REQUEST_DELAY)
    
    const btcPrice = await getCoinPriceOnDate(COINS.bitcoin, weekEndDate)
    
    if (!ethPrice || !btcPrice) {
      console.log('⚠️ 无法获取完整的价格数据，使用默认值')
      return 0.035
    }
    
    const ratio = ethPrice / btcPrice
    console.log(`📊 ETH/BTC比率: ${ratio.toFixed(6)} (ETH: ${ethPrice}, BTC: ${btcPrice})`)
    
    return parseFloat(ratio.toFixed(6))
    
  } catch (error) {
    console.error('❌ 计算ETH/BTC比率失败:', error.message)
    return 0.035
  }
}

// 收集指定周的完整数据
const collectWeekData = async (weekId, startDate, endDate) => {
  console.log(`\n🔄 开始收集 ${weekId} 数据 (${formatDateForAPI(startDate)} 到 ${formatDateForAPI(endDate)})`)
  
  try {
    // 收集BTC数据
    const btcData = await collectCoinWeekData(COINS.bitcoin, startDate, endDate)
    if (!btcData) {
      throw new Error('未能获取BTC价格数据')
    }
    
    // 币种间延迟
    console.log('\n⏳ 币种间延迟 30 秒...')
    await delay(30000)
    
    // 收集ETH数据
    const ethData = await collectCoinWeekData(COINS.ethereum, startDate, endDate)
    if (!ethData) {
      throw new Error('未能获取ETH价格数据')
    }
    
    // 检查数据完整性
    if (!btcData.isComplete || !ethData.isComplete) {
      console.log('\n⚠️  警告: 数据不完整，但继续处理...')
    }
    
    // 只有数据完整时才计算周涨跌和比率
    let btcWeeklyChange = 0
    let ethBtcRatio = 0.035
    
    if (btcData.isComplete && ethData.isComplete) {
      console.log('\n✅ 数据完整，开始计算周涨跌和比率...')
      
      // 计算周涨跌幅
      console.log('\n⏳ 准备计算周涨跌幅，延迟 30 秒...')
      await delay(30000)
      
      const previousWeekId = getPreviousWeekId(weekId)
      if (weekId === '2025-W01') {
        console.log('📈 BTC周涨跌幅: 2025-W01为第一周，无上周数据，设为0')
        btcWeeklyChange = 0
      } else {
        btcWeeklyChange = await calculateBTCWeeklyChange(btcData.average, previousWeekId)
      }
      
      // 计算ETH/BTC比率
      console.log('\n⏳ 准备计算ETH/BTC比率，延迟 30 秒...')
      await delay(30000)
      ethBtcRatio = await calculateETHBTCRatio(endDate)
    } else {
      console.log('\n⚠️  数据不完整，跳过周涨跌和比率计算')
    }
    
    // 构建周数据对象
    const weekData = {
      weekId: weekId,
      year: startDate.getFullYear(),
      weekNumber: parseInt(weekId.split('-W')[1]),
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      btcWeeklyChange: btcWeeklyChange,
      btcWeeklyAvgPrice: btcData.average,
      ethWeeklyAvgPrice: ethData.average,
      fearGreedIndex: 50,
      mayerMultiple: 1.5,
      ahr999: 1.0,
      ethBtcRatio: ethBtcRatio,
      btcFromATH: calculateBTCFromATH(btcData.average),
      btcFourYearIndex: 0.8,
      personalRating: 3,
      marketTrend: btcWeeklyChange >= 0 ? 'bullish' : 'bearish',
      updatedAt: new Date().toISOString(),
      dataSource: 'coingecko_api_v2_with_retry',
      rawData: {
        btc: btcData,
        eth: ethData,
        weeklyChangeData: btcWeeklyChange !== 0 ? {
          currentWeekAvg: btcData.average,
          previousWeekId: getPreviousWeekId(weekId),
          weeklyChange: btcWeeklyChange
        } : null,
        ratioData: ethBtcRatio !== 0.035 ? {
          calculationDate: endDate.toISOString().split('T')[0],
          ethBtcRatio: ethBtcRatio
        } : null
      }
    }
    
    console.log(`✅ ${weekId} 数据收集完成`)
    console.log(`📊 汇总: BTC均价 ${btcData.average}, ETH均价 ${ethData.average}`)
    console.log(`📈 BTC周涨跌幅: ${btcWeeklyChange}%, ETH/BTC比率: ${ethBtcRatio}`)
    
    return weekData
    
  } catch (error) {
    console.error(`❌ 收集 ${weekId} 数据失败:`, error.message)
    return null
  }
}

// 保存数据到文件
const saveDataToFile = (newData, filename) => {
  try {
    const projectRoot = path.resolve(__dirname, '..')
    const filePath = path.join(projectRoot, 'src', 'data', filename)
    
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    let existingData = {}
    if (fs.existsSync(filePath)) {
      try {
        const existingContent = fs.readFileSync(filePath, 'utf8')
        existingData = JSON.parse(existingContent)
      } catch (error) {
        console.log('⚠️ 现有数据文件格式错误，将创建新文件')
      }
    }
    
    const mergedData = { ...existingData, ...newData }
    
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8')
    console.log(`💾 数据已保存到: ${filePath}`)
    console.log(`📊 总计数据: ${Object.keys(mergedData).length} 周`)
    
    // 同步到public目录
    const publicPath = path.join(projectRoot, 'public', filename)
    fs.writeFileSync(publicPath, JSON.stringify(mergedData, null, 2), 'utf8')
    console.log(`💾 数据已同步到: ${publicPath}`)
    
  } catch (error) {
    console.error('❌ 保存数据失败:', error.message)
  }
}

// 定义要收集的周数据
const WEEKS_TO_COLLECT = [
  {
    id: '2026-W05',
    start: new Date(2026, 1, 1),  // 2026-02-01
    end: new Date(2026, 1, 7)     // 2026-02-07
  }
]

// 主函数
const main = async () => {
  console.log('🚀 开始收集周数据 (V2 - 带重试机制)...')
  console.log(`📅 收集周期: ${WEEKS_TO_COLLECT.length} 周`)
  
  // 测试API连接
  try {
    console.log('🧪 测试API连接...')
    const testResponse = await fetch('https://api.coingecko.com/api/v3/ping')
    const testData = await testResponse.json()
    console.log('✅ API连接成功:', testData)
  } catch (error) {
    console.error('❌ API连接失败:', error.message)
    return
  }
  
  const collectedData = {}
  
  for (const week of WEEKS_TO_COLLECT) {
    const weekData = await collectWeekData(week.id, week.start, week.end)
    if (weekData) {
      collectedData[week.id] = weekData
    }
    
    // 周之间延迟
    await delay(REQUEST_DELAY * 2)
  }
  
  console.log(`\n📊 收集结果: ${Object.keys(collectedData).length}/${WEEKS_TO_COLLECT.length} 周`)
  
  if (Object.keys(collectedData).length > 0) {
    saveDataToFile(collectedData, 'weeklyData.json')
    console.log('\n🎉 数据收集完成!')
  } else {
    console.log('\n❌ 未收集到任何数据')
  }
}

// 执行
console.log('📋 脚本开始执行...')
main().catch(error => {
  console.error('💥 脚本执行失败:', error)
})

export { collectWeekData, saveDataToFile }
