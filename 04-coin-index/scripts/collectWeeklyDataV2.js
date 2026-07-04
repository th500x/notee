// 周数据收集脚本V2 - 带失败重试、增量收集、自动周次
import path from 'path'
import { fileURLToPath } from 'url'
import { getPreviousWeekId, resolveWeeksToCollect } from './lib/weekSchedule.js'
import { REQUEST_DELAY, RETRY_DELAY, delay } from './lib/apiDelay.js'
import {
  loadWeeklyData,
  mergeWeeklyData,
  saveWeeklyData,
} from './lib/weeklyDataStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// BTC ATH价格 - 固定值
const BTC_ATH_PRICE = 126080

// 计算BTC距ATH回撤百分比
const calculateBTCFromATH = (currentPrice) => {
  const drawdown = ((currentPrice - BTC_ATH_PRICE) / BTC_ATH_PRICE) * 100
  return parseFloat(drawdown.toFixed(1))
}


// CoinGecko API配置（限速见 ./lib/apiDelay.js）
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3'
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

// 检查现有数据并识别缺失的日期（仅补缺，不整周重拉）
const checkExistingData = (existingData, weekId, startDate, endDate) => {
  const weekData = existingData[weekId]

  if (!weekData || !weekData.rawData) {
    console.log(`📋 ${weekId}: 无现有数据，需要完整收集`)
    return {
      needsCollection: true,
      missingBTCDates: [],
      missingETHDates: [],
      missingWeeklyChange: true,
      missingRatio: true,
      existingData: weekData,
    }
  }

  const allDates = []
  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    allDates.push(currentDate.toISOString().split('T')[0])
    currentDate.setDate(currentDate.getDate() + 1)
  }

  const existingBTCDates = weekData.rawData.btc?.dates || []
  const missingBTCDates = allDates.filter((date) => !existingBTCDates.includes(date))
  const existingETHDates = weekData.rawData.eth?.dates || []
  const missingETHDates = allDates.filter((date) => !existingETHDates.includes(date))
  const missingWeeklyChange = (() => {
    if (!weekData.rawData?.weeklyChangeData) return true
    const avg = weekData.rawData?.btc?.average ?? weekData.btcWeeklyAvgPrice
    if (avg != null && weekData.rawData.weeklyChangeData?.currentWeekAvg !== avg) return true
    const prevId = getPreviousWeekId(weekId)
    const prevAvg = existingData[prevId]?.btcWeeklyAvgPrice
    if (prevAvg && avg != null) {
      const expected = parseFloat((((avg - prevAvg) / prevAvg) * 100).toFixed(2))
      if (weekData.btcWeeklyChange !== expected) return true
    }
    return false
  })()
  const missingRatio = !weekData.rawData.ratioData || !weekData.ethBtcRatio

  const needsCollection =
    missingBTCDates.length > 0 ||
    missingETHDates.length > 0 ||
    missingWeeklyChange ||
    missingRatio

  if (needsCollection) {
    console.log(`📋 ${weekId}: 发现缺失数据`)
    console.log(`   缺失BTC日期: ${missingBTCDates.length || '无'}`)
    console.log(`   缺失ETH日期: ${missingETHDates.length || '无'}`)
  } else {
    console.log(`✅ ${weekId}: 数据完整，跳过 API`)
  }

  return {
    needsCollection,
    missingBTCDates,
    missingETHDates,
    missingWeeklyChange,
    missingRatio,
    existingData: weekData,
  }
}

const collectMissingPrices = async (coinId, missingDates, existingCoinRaw = null) => {
  if (missingDates.length === 0 && existingCoinRaw) {
    return existingCoinRaw
  }

  const prices = existingCoinRaw ? [...existingCoinRaw.prices] : []
  const dates = existingCoinRaw ? [...existingCoinRaw.dates] : []

  for (const dateStr of missingDates) {
    const date = new Date(dateStr + 'T12:00:00')
    const price = await getCoinPriceOnDate(coinId, date)
    if (price !== null) {
      prices.push(price)
      dates.push(dateStr)
    }
    await delay(REQUEST_DELAY)
  }

  if (prices.length === 0) return null

  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length
  return {
    average: parseFloat(average.toFixed(2)),
    prices,
    dates,
    dataPoints: prices.length,
    isComplete: dates.length >= missingDates.length + (existingCoinRaw?.dates?.length || 0),
  }
}

// 工具函数：获取上一周的weekId — 见 ./lib/weekSchedule.js

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

    const weeklyData = loadWeeklyData()
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

// 收集指定周的完整数据（增量优先）
const collectWeekData = async (weekId, startDate, endDate, allExistingData = {}) => {
  console.log(`\n🔄 开始收集 ${weekId} 数据 (${formatDateForAPI(startDate)} 到 ${formatDateForAPI(endDate)})`)

  const dataCheck = checkExistingData(allExistingData, weekId, startDate, endDate)
  if (!dataCheck.needsCollection) {
    return dataCheck.existingData
  }

  try {
    let btcData
    if (dataCheck.missingBTCDates.length === 0 && dataCheck.existingData?.rawData?.btc) {
      btcData = dataCheck.existingData.rawData.btc
    } else if (dataCheck.existingData?.rawData?.btc && dataCheck.missingBTCDates.length > 0) {
      btcData = await collectMissingPrices(
        COINS.bitcoin,
        dataCheck.missingBTCDates,
        dataCheck.existingData.rawData.btc,
      )
    } else {
      btcData = await collectCoinWeekData(COINS.bitcoin, startDate, endDate)
    }
    if (!btcData) throw new Error('未能获取BTC价格数据')

    if (dataCheck.missingETHDates.length > 0 || !dataCheck.existingData?.rawData?.eth) {
      console.log('\n⏳ 币种间延迟 30 秒...')
      await delay(30000)
    }

    let ethData
    if (dataCheck.missingETHDates.length === 0 && dataCheck.existingData?.rawData?.eth) {
      ethData = dataCheck.existingData.rawData.eth
    } else if (dataCheck.existingData?.rawData?.eth && dataCheck.missingETHDates.length > 0) {
      ethData = await collectMissingPrices(
        COINS.ethereum,
        dataCheck.missingETHDates,
        dataCheck.existingData.rawData.eth,
      )
    } else {
      ethData = await collectCoinWeekData(COINS.ethereum, startDate, endDate)
    }
    if (!ethData) throw new Error('未能获取ETH价格数据')

    const btcComplete = btcData.isComplete !== false
    const ethComplete = ethData.isComplete !== false

    let btcWeeklyChange = dataCheck.existingData?.btcWeeklyChange ?? 0
    let weeklyChangeData = dataCheck.existingData?.rawData?.weeklyChangeData ?? null
    let ethBtcRatio = dataCheck.existingData?.ethBtcRatio ?? 0.035
    let ratioData = dataCheck.existingData?.rawData?.ratioData ?? null

    if (dataCheck.missingWeeklyChange && btcComplete && ethComplete) {
      console.log('\n⏳ 准备计算周涨跌幅，延迟 30 秒...')
      await delay(30000)
      const previousWeekId = getPreviousWeekId(weekId)
      if (weekId === '2025-W01') {
        btcWeeklyChange = 0
      } else {
        btcWeeklyChange = await calculateBTCWeeklyChange(btcData.average, previousWeekId)
      }
      weeklyChangeData = {
        currentWeekAvg: btcData.average,
        previousWeekId,
        weeklyChange: btcWeeklyChange,
      }
    }

    if (dataCheck.missingRatio && btcComplete && ethComplete) {
      console.log('\n⏳ 准备计算ETH/BTC比率，延迟 30 秒...')
      await delay(30000)
      ethBtcRatio = await calculateETHBTCRatio(endDate)
      ratioData = {
        calculationDate: endDate.toISOString().split('T')[0],
        ethBtcRatio,
      }
    }

    const prior = dataCheck.existingData || {}
    const weekData = {
      weekId,
      year: startDate.getFullYear(),
      weekNumber: parseInt(weekId.split('-W')[1]),
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      btcWeeklyChange,
      btcWeeklyAvgPrice: btcData.average,
      ethWeeklyAvgPrice: ethData.average,
      fearGreedIndex: prior.fearGreedIndex ?? 50,
      mayerMultiple: prior.mayerMultiple ?? 1.5,
      ahr999: prior.ahr999 ?? 1.0,
      ethBtcRatio,
      btcFromATH: calculateBTCFromATH(btcData.average),
      btcFourYearIndex: prior.btcFourYearIndex ?? 0.8,
      fedRate: prior.fedRate,
      bojRate: prior.bojRate,
      personalRating: prior.personalRating ?? 3,
      marketTrend: btcWeeklyChange >= 0 ? 'bullish' : 'bearish',
      updatedAt: new Date().toISOString(),
      dataSource: 'coingecko_api_v2_incremental',
      rawData: {
        ...(prior.rawData || {}),
        btc: btcData,
        eth: ethData,
        weeklyChangeData,
        ratioData,
      },
    }

    console.log(`✅ ${weekId} 数据收集完成`)
    return weekData
  } catch (error) {
    console.error(`❌ 收集 ${weekId} 数据失败:`, error.message)
    return null
  }
}

// 主函数
const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')

  console.log('🚀 开始收集周数据 (V2 · 增量 · 自动周次)...')

  const existingData = loadWeeklyData()
  const weeks = resolveWeeksToCollect(existingData)

  if (weeks.length === 0) {
    console.log('\n✅ 无需 API 收集')
    return
  }

  console.log(`📅 计划收集: ${weeks.map((w) => w.id).join(', ')}`)
  if (dryRun) {
    console.log('🏁 --dry-run：未写入文件')
    return
  }

  try {
    const testResponse = await fetch('https://api.coingecko.com/api/v3/ping')
    console.log('✅ API连接成功:', await testResponse.json())
  } catch (error) {
    console.error('❌ API连接失败:', error.message)
    return
  }

  const collectedData = {}
  for (const week of weeks) {
    const weekData = await collectWeekData(week.id, week.startDate, week.endDate, existingData)
    if (weekData) {
      collectedData[week.id] = weekData
    }
    await delay(REQUEST_DELAY * 2)
  }

  if (Object.keys(collectedData).length === 0) {
    console.log('\n❌ 未收集到任何新数据')
    return
  }

  const merged = mergeWeeklyData(existingData, collectedData)
  saveWeeklyData(merged, { force })
  console.log('\n🎉 数据收集完成!')
}

// 执行
console.log('📋 脚本开始执行...')
main().catch(error => {
  console.error('💥 脚本执行失败:', error)
})

export { collectWeekData }
