// 周数据收集脚本 - 通过CoinGecko API获取真实价格数据
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// BTC ATH价格 - 固定值
const BTC_ATH_PRICE = 126080 // 美元

// 计算BTC距ATH回撤百分比
const calculateBTCFromATH = (currentPrice) => {
  const drawdown = ((currentPrice - BTC_ATH_PRICE) / BTC_ATH_PRICE) * 100
  return parseFloat(drawdown.toFixed(1))
}

// CoinGecko API配置 - 增加到25秒延迟
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'
const REQUEST_DELAY = 25000 // 增加到25秒延迟
const RETRY_DELAY = 30000   // 重试延迟30秒
const MAX_RETRIES = 1       // 减少重试次数，依赖更长的延迟

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

// 检查现有数据并识别缺失的日期
const checkExistingData = (existingData, weekId, startDate, endDate) => {
  const weekData = existingData[weekId]
  
  if (!weekData || !weekData.rawData) {
    console.log(`📋 ${weekId}: 无现有数据，需要完整收集`)
    return {
      needsCollection: true,
      missingBTCDates: [],
      missingETHDates: [],
      missingWeeklyChange: true,
      missingRatio: true
    }
  }
  
  // 生成完整的日期列表
  const allDates = []
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    allDates.push(currentDate.toISOString().split('T')[0])
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // 检查BTC数据缺失
  const existingBTCDates = weekData.rawData.btc?.dates || []
  const missingBTCDates = allDates.filter(date => !existingBTCDates.includes(date))
  
  // 检查ETH数据缺失
  const existingETHDates = weekData.rawData.eth?.dates || []
  const missingETHDates = allDates.filter(date => !existingETHDates.includes(date))
  
  // 检查周涨跌幅数据
  const missingWeeklyChange = !weekData.rawData.weeklyChangeData || weekData.btcWeeklyChange === 0
  
  // 检查ETH/BTC比率数据
  const missingRatio = !weekData.rawData.ratioData || !weekData.ethBtcRatio
  
  const needsCollection = missingBTCDates.length > 0 || missingETHDates.length > 0 || missingWeeklyChange || missingRatio
  
  if (needsCollection) {
    console.log(`📋 ${weekId}: 发现缺失数据`)
    console.log(`   缺失BTC日期: ${missingBTCDates.length > 0 ? missingBTCDates.join(', ') : '无'}`)
    console.log(`   缺失ETH日期: ${missingETHDates.length > 0 ? missingETHDates.join(', ') : '无'}`)
    console.log(`   缺失周涨跌幅: ${missingWeeklyChange ? '是' : '否'}`)
    console.log(`   缺失ETH/BTC比率: ${missingRatio ? '是' : '否'}`)
  } else {
    console.log(`✅ ${weekId}: 数据完整，跳过收集`)
  }
  
  return {
    needsCollection,
    missingBTCDates,
    missingETHDates,
    missingWeeklyChange,
    missingRatio,
    existingData: weekData
  }
}

// 获取指定日期UTC+8时间0:00的价格
const getCoinPriceAtMidnight = async (coinId, date) => {
  try {
    // 确保是UTC+8时间的0:00，转换为UTC时间进行API调用
    const utc8Date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
    const dateStr = formatDateForAPI(utc8Date)
    const url = `${COINGECKO_API_BASE}/coins/${coinId}/history?date=${dateStr}`
    
    console.log(`📡 获取 ${coinId} 在 ${dateStr} 00:00 (UTC+8) 的价格...`)
    
    const response = await fetch(url)
    
    if (response.status === 429) {
      console.log(`⏳ API限制，等待 ${RETRY_DELAY/1000} 秒后重试...`)
      await delay(RETRY_DELAY)
      return await getCoinPriceAtMidnight(coinId, date)
    }
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    const data = await response.json()
    const price = data.market_data?.current_price?.usd
    
    if (!price) {
      throw new Error(`未找到价格数据`)
    }
    
    console.log(`💰 ${coinId} 价格 (${dateStr} 00:00): $${price}`)
    return price
    
  } catch (error) {
    console.error(`❌ 获取 ${coinId} 00:00价格失败:`, error.message)
    return null
  }
}

// 计算BTC周涨跌幅
const calculateBTCWeeklyChange = async (currentWeekEndDate, previousWeekEndDate) => {
  try {
    console.log('\n📈 计算BTC周涨跌幅...')
    
    const currentPrice = await getCoinPriceAtMidnight(COINS.bitcoin, currentWeekEndDate)
    await delay(REQUEST_DELAY)
    
    const previousPrice = await getCoinPriceAtMidnight(COINS.bitcoin, previousWeekEndDate)
    
    if (!currentPrice || !previousPrice) {
      console.log('⚠️ 无法获取完整的BTC价格数据，使用默认值')
      return 0
    }
    
    const weeklyChange = ((currentPrice - previousPrice) / previousPrice) * 100
    console.log(`📊 BTC周涨跌幅: ${weeklyChange.toFixed(2)}% (${previousPrice} → ${currentPrice})`)
    
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
    
    const ethPrice = await getCoinPriceAtMidnight(COINS.ethereum, weekEndDate)
    await delay(REQUEST_DELAY)
    
    const btcPrice = await getCoinPriceAtMidnight(COINS.bitcoin, weekEndDate)
    
    if (!ethPrice || !btcPrice) {
      console.log('⚠️ 无法获取完整的价格数据，使用默认值')
      return 0.035
    }
    
    const ratio = ethPrice / btcPrice
    console.log(`📊 ETH/BTC比率: ${ratio.toFixed(6)} (ETH: $${ethPrice}, BTC: $${btcPrice})`)
    
    return parseFloat(ratio.toFixed(6))
    
  } catch (error) {
    console.error('❌ 计算ETH/BTC比率失败:', error.message)
    return 0.035
  }
}

// 获取指定日期的币种价格 - 添加重试机制
const getCoinPriceOnDate = async (coinId, date, retryCount = 0) => {
  try {
    const dateStr = formatDateForAPI(date)
    const url = `${COINGECKO_API_BASE}/coins/${coinId}/history?date=${dateStr}`
    
    console.log(`📡 获取 ${coinId} 在 ${dateStr} 的价格... (尝试 ${retryCount + 1}/${MAX_RETRIES + 1})`)
    
    const response = await fetch(url)
    
    if (response.status === 429) {
      // API限制，等待后重试
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
    
    console.log(`💰 ${coinId} 价格: $${price}`)
    return price
    
  } catch (error) {
    console.error(`❌ 获取 ${coinId} 价格失败:`, error.message)
    return null
  }
}

// 计算指定周期的平均价格 (完整收集)
const getWeeklyAveragePrice = async (coinId, startDate, endDate) => {
  const prices = []
  const dates = []
  
  let currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const price = await getCoinPriceOnDate(coinId, currentDate)
    
    if (price !== null) {
      prices.push(price)
      dates.push(new Date(currentDate))
    }
    
    // 移动到下一天
    currentDate.setDate(currentDate.getDate() + 1)
    
    // 添加延迟避免API限制
    await delay(REQUEST_DELAY)
  }
  
  if (prices.length === 0) {
    console.error(`❌ 未获取到任何价格数据`)
    return null
  }
  
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length
  
  console.log(`📊 ${coinId} 周均价: $${average.toFixed(2)} (基于${prices.length}天数据)`)
  
  return {
    average: parseFloat(average.toFixed(2)),
    prices: prices,
    dates: dates.map(d => d.toISOString().split('T')[0]),
    dataPoints: prices.length
  }
}

// 增量收集指定日期的价格数据
const collectMissingPrices = async (coinId, missingDates, existingData = null) => {
  if (missingDates.length === 0) {
    console.log(`📊 ${coinId}: 无缺失日期，使用现有数据`)
    return existingData
  }
  
  console.log(`📊 开始收集 ${coinId} 缺失的 ${missingDates.length} 天数据...`)
  
  const newPrices = []
  const newDates = []
  
  // 如果有现有数据，先复制过来
  if (existingData) {
    newPrices.push(...existingData.prices)
    newDates.push(...existingData.dates)
  }
  
  // 收集缺失的日期数据
  for (const dateStr of missingDates) {
    const date = new Date(dateStr + 'T00:00:00')
    const price = await getCoinPriceOnDate(coinId, date)
    
    if (price !== null) {
      newPrices.push(price)
      newDates.push(dateStr)
      console.log(`✅ ${coinId} ${dateStr}: $${price}`)
    } else {
      console.log(`❌ ${coinId} ${dateStr}: 获取失败`)
    }
    
    // 添加延迟
    await delay(REQUEST_DELAY)
  }
  
  if (newPrices.length === 0) {
    console.error(`❌ ${coinId}: 未获取到任何价格数据`)
    return null
  }
  
  const average = newPrices.reduce((sum, price) => sum + price, 0) / newPrices.length
  
  console.log(`📊 ${coinId} 更新后周均价: $${average.toFixed(2)} (基于${newPrices.length}天数据)`)
  
  return {
    average: parseFloat(average.toFixed(2)),
    prices: newPrices,
    dates: newDates,
    dataPoints: newPrices.length
  }
}

// 收集指定周的完整数据 - 支持增量收集
const collectWeekData = async (weekId, startDate, endDate, existingData = {}) => {
  console.log(`\n🔄 开始收集 ${weekId} 数据 (${formatDateForAPI(startDate)} 到 ${formatDateForAPI(endDate)})`)
  
  try {
    // 检查现有数据
    const dataCheck = checkExistingData(existingData, weekId, startDate, endDate)
    
    if (!dataCheck.needsCollection) {
      console.log(`✅ ${weekId} 数据完整，直接返回现有数据`)
      return dataCheck.existingData
    }
    
    // 收集BTC数据 (增量或完整)
    console.log('\n📊 处理 BTC 数据...')
    let btcData
    if (dataCheck.missingBTCDates.length === 0 && dataCheck.existingData?.rawData?.btc) {
      btcData = dataCheck.existingData.rawData.btc
      console.log(`📊 BTC: 使用现有完整数据 (${btcData.dataPoints}天)`)
    } else if (dataCheck.existingData?.rawData?.btc && dataCheck.missingBTCDates.length > 0) {
      // 增量收集
      btcData = await collectMissingPrices(
        COINS.bitcoin, 
        dataCheck.missingBTCDates, 
        dataCheck.existingData.rawData.btc
      )
    } else {
      // 完整收集
      console.log(`📊 BTC: 进行完整收集...`)
      btcData = await getWeeklyAveragePrice(COINS.bitcoin, startDate, endDate)
    }
    
    if (!btcData) {
      throw new Error('未能获取BTC价格数据')
    }
    
    // 在币种之间添加延迟
    if (dataCheck.missingETHDates.length > 0) {
      console.log('\n⏳ 币种间延迟 30 秒...')
      await delay(30000)
    }
    
    // 收集ETH数据 (增量或完整)
    console.log('\n📊 处理 ETH 数据...')
    let ethData
    if (dataCheck.missingETHDates.length === 0 && dataCheck.existingData?.rawData?.eth) {
      ethData = dataCheck.existingData.rawData.eth
      console.log(`📊 ETH: 使用现有完整数据 (${ethData.dataPoints}天)`)
    } else if (dataCheck.existingData?.rawData?.eth && dataCheck.missingETHDates.length > 0) {
      // 增量收集
      ethData = await collectMissingPrices(
        COINS.ethereum, 
        dataCheck.missingETHDates, 
        dataCheck.existingData.rawData.eth
      )
    } else {
      // 完整收集
      console.log(`📊 ETH: 进行完整收集...`)
      ethData = await getWeeklyAveragePrice(COINS.ethereum, startDate, endDate)
    }
    
    if (!ethData) {
      throw new Error('未能获取ETH价格数据')
    }
    
    // 计算或使用现有的BTC周涨跌幅
    let btcWeeklyChange = 0
    let weeklyChangeData = null
    
    if (dataCheck.missingWeeklyChange) {
      console.log('\n⏳ 准备计算周涨跌幅，延迟 30 秒...')
      await delay(30000)
      
      const previousWeekEndDate = new Date(startDate)
      previousWeekEndDate.setDate(startDate.getDate() - 1)
      
      btcWeeklyChange = await calculateBTCWeeklyChange(endDate, previousWeekEndDate)
      weeklyChangeData = {
        currentWeekEnd: endDate.toISOString().split('T')[0],
        previousWeekEnd: previousWeekEndDate.toISOString().split('T')[0],
        weeklyChange: btcWeeklyChange
      }
    } else {
      btcWeeklyChange = dataCheck.existingData.btcWeeklyChange
      weeklyChangeData = dataCheck.existingData.rawData.weeklyChangeData
      console.log(`📈 BTC周涨跌幅: 使用现有数据 ${btcWeeklyChange}%`)
    }
    
    // 计算或使用现有的ETH/BTC比率
    let ethBtcRatio = 0.035
    let ratioData = null
    
    if (dataCheck.missingRatio) {
      console.log('\n⏳ 准备计算ETH/BTC比率，延迟 30 秒...')
      await delay(30000)
      
      ethBtcRatio = await calculateETHBTCRatio(endDate)
      ratioData = {
        calculationDate: endDate.toISOString().split('T')[0],
        ethBtcRatio: ethBtcRatio
      }
    } else {
      ethBtcRatio = dataCheck.existingData.ethBtcRatio
      ratioData = dataCheck.existingData.rawData.ratioData
      console.log(`📊 ETH/BTC比率: 使用现有数据 ${ethBtcRatio}`)
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
      // 其他指标暂时使用模拟数据
      fearGreedIndex: 50,
      mayerMultiple: 1.5,
      ahr999: 1.0,
      ethBtcRatio: ethBtcRatio,
      btcFromATH: calculateBTCFromATH(btcData.average),
      btcFourYearIndex: 0.8,
      personalRating: 3,
      marketTrend: btcWeeklyChange >= 0 ? 'bullish' : 'bearish',
      updatedAt: new Date().toISOString(),
      dataSource: 'coingecko_api_incremental',
      // 原始数据用于验证
      rawData: {
        btc: btcData,
        eth: ethData,
        weeklyChangeData: weeklyChangeData,
        ratioData: ratioData
      }
    }
    
    console.log(`✅ ${weekId} 数据收集完成`)
    console.log(`📊 汇总: BTC均价 $${btcData.average}, ETH均价 $${ethData.average}`)
    console.log(`📈 BTC周涨跌幅: ${btcWeeklyChange}%, ETH/BTC比率: ${ethBtcRatio}`)
    
    return weekData
    
  } catch (error) {
    console.error(`❌ 收集 ${weekId} 数据失败:`, error.message)
    return null
  }
}

// 主函数：收集多个周的数据 - 支持增量收集
const collectMultipleWeeks = async (weeks) => {
  const results = {}
  
  // 先读取现有数据
  const projectRoot = path.resolve(__dirname, '..')
  const filePath = path.join(projectRoot, 'src', 'data', 'weeklyData.json')
  
  let existingData = {}
  if (fs.existsSync(filePath)) {
    try {
      const existingContent = fs.readFileSync(filePath, 'utf8')
      existingData = JSON.parse(existingContent)
      console.log(`📖 读取现有数据: ${Object.keys(existingData).length} 周`)
    } catch (error) {
      console.log('⚠️ 现有数据文件格式错误，将进行完整收集')
    }
  }
  
  for (const week of weeks) {
    const weekData = await collectWeekData(week.id, week.start, week.end, existingData)
    if (weekData) {
      results[week.id] = weekData
    }
    
    // 在周之间添加更长的延迟
    await delay(REQUEST_DELAY * 2)
  }
  
  return results
}

// 保存数据到文件 - 支持追加模式
const saveDataToFile = (newData, filename) => {
  try {
    const projectRoot = path.resolve(__dirname, '..')
    const filePath = path.join(projectRoot, 'src', 'data', filename)
    
    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    // 读取现有数据
    let existingData = {}
    if (fs.existsSync(filePath)) {
      try {
        const existingContent = fs.readFileSync(filePath, 'utf8')
        existingData = JSON.parse(existingContent)
        console.log(`📖 读取现有数据: ${Object.keys(existingData).length} 周`)
      } catch (error) {
        console.log('⚠️ 现有数据文件格式错误，将创建新文件')
      }
    }
    
    // 合并数据
    const mergedData = { ...existingData, ...newData }
    
    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8')
    console.log(`💾 数据已保存到: ${filePath}`)
    console.log(`📊 总计数据: ${Object.keys(mergedData).length} 周`)
    
  } catch (error) {
    console.error('❌ 保存数据失败:', error.message)
  }
}

// 定义要收集的周数据 - 测试2026年W1 (清理后)
const WEEKS_TO_COLLECT = [
  {
    id: '2026-W01',
    start: new Date(2026, 0, 5),  // 2026-01-05
    end: new Date(2026, 0, 11)    // 2026-01-11
  }
]

// 执行数据收集
const main = async () => {
  console.log('🚀 开始收集周数据...')
  console.log(`📅 收集周期: ${WEEKS_TO_COLLECT.length} 周`)
  
  // 先测试一个简单的API调用
  try {
    console.log('🧪 测试API连接...')
    const testResponse = await fetch('https://api.coingecko.com/api/v3/ping')
    const testData = await testResponse.json()
    console.log('✅ API连接成功:', testData)
  } catch (error) {
    console.error('❌ API连接失败:', error.message)
    return
  }
  
  const collectedData = await collectMultipleWeeks(WEEKS_TO_COLLECT)
  
  console.log(`\n📊 收集结果: ${Object.keys(collectedData).length}/${WEEKS_TO_COLLECT.length} 周`)
  
  if (Object.keys(collectedData).length > 0) {
    saveDataToFile(collectedData, 'weeklyData.json')
    console.log('\n🎉 数据收集完成!')
  } else {
    console.log('\n❌ 未收集到任何数据')
  }
}

// 立即执行
console.log('📋 脚本开始执行...')
main().catch(error => {
  console.error('💥 脚本执行失败:', error)
})

export { collectWeekData, collectMultipleWeeks, saveDataToFile }