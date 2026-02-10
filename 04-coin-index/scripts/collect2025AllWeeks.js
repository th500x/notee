// 2025年完整数据收集脚本 - 使用Yahoo Finance API获取2025年全年数据
// Yahoo Finance API可以获取历史数据，不受1年限制

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Yahoo Finance API基础URL
const YAHOO_API_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 将日期转换为Unix时间戳
const dateToTimestamp = (dateStr) => {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000)
}

// 生成2025年所有53周的配置
const generate2025Weeks = () => {
  const weeks = []
  
  // 2025年从W01开始（2025-01-05到2025-01-11，周日到周六）
  // 2025年有53周，最后一周是W53（2025-12-28到2026-01-03）
  
  for (let weekNum = 1; weekNum <= 53; weekNum++) {
    const weekId = `2025-W${weekNum.toString().padStart(2, '0')}`
    
    // 计算每周的开始和结束日期
    // 2025-W01从2025-01-05开始（周日）
    const firstWeekStart = new Date(2025, 0, 5) // 2025-01-05
    const weekStart = new Date(firstWeekStart)
    weekStart.setDate(firstWeekStart.getDate() + (weekNum - 1) * 7)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    weeks.push({
      weekId: weekId,
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0]
    })
  }
  
  return weeks
}

// 从Yahoo Finance获取历史数据
const fetchYahooData = async (symbol, startDate, endDate) => {
  try {
    const startTimestamp = dateToTimestamp(startDate)
    const endTimestamp = dateToTimestamp(endDate) + 86400 // 加一天确保包含结束日期
    
    const url = `${YAHOO_API_BASE}/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&includePrePost=true&events=div%7Csplit`
    
    console.log(`📡 请求Yahoo Finance数据: ${symbol} (${startDate} 到 ${endDate})`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('无效的响应数据结构')
    }
    
    const result = data.chart.result[0]
    const timestamps = result.timestamp
    const prices = result.indicators.quote[0].close
    
    if (!timestamps || !prices) {
      throw new Error('缺少价格或时间戳数据')
    }
    
    // 转换为我们需要的格式
    const dailyPrices = []
    for (let i = 0; i < timestamps.length; i++) {
      if (prices[i] !== null) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
        dailyPrices.push({
          date,
          price: prices[i]
        })
      }
    }
    
    console.log(`✅ 获取到 ${dailyPrices.length} 天的${symbol}数据`)
    return dailyPrices
    
  } catch (error) {
    console.error(`❌ 获取${symbol}数据失败:`, error.message)
    return []
  }
}

// 计算周平均价格
const calculateWeeklyAverage = (dailyPrices) => {
  if (dailyPrices.length === 0) return 0
  
  const sum = dailyPrices.reduce((acc, day) => acc + day.price, 0)
  return parseFloat((sum / dailyPrices.length).toFixed(2))
}

// 计算周涨跌幅 (基于周均价对比)
const calculateWeeklyChange = (weekId, currentWeekAvg, existingData) => {
  // 特殊处理：2025-W01为第一周，无上周数据
  if (weekId === '2025-W01') {
    console.log('📈 2025-W01为第一周，无上周数据，周涨跌幅设为0')
    return 0
  }
  
  // 计算上周的weekId
  const [year, weekStr] = weekId.split('-W')
  const weekNum = parseInt(weekStr)
  const previousWeekId = `${year}-W${(weekNum - 1).toString().padStart(2, '0')}`
  
  // 从现有数据中获取上周均价
  const previousWeekData = existingData[previousWeekId]
  
  if (!previousWeekData || !previousWeekData.btcWeeklyAvgPrice) {
    console.log(`⚠️ 无法获取上周(${previousWeekId})的BTC周均价数据，周涨跌幅设为0`)
    return 0
  }
  
  const previousWeekAvg = previousWeekData.btcWeeklyAvgPrice
  const change = ((currentWeekAvg - previousWeekAvg) / previousWeekAvg) * 100
  
  console.log(`📈 周涨跌幅: ${change.toFixed(2)}% (上周均价 ${previousWeekAvg} → 本周均价 ${currentWeekAvg})`)
  
  return parseFloat(change.toFixed(2))
}

// 计算ETH/BTC比率
const calculateEthBtcRatio = (ethPrice, btcPrice) => {
  if (!ethPrice || !btcPrice) return 0
  return parseFloat((ethPrice / btcPrice).toFixed(6))
}

// 计算BTC距ATH回撤 (使用分阶段ATH基数)
const calculateBTCFromATH = (currentPrice, weekId) => {
  // 根据周数确定使用的ATH基数
  const weekNum = parseInt(weekId.split('-W')[1])
  let athPrice
  
  if (weekNum <= 20) {
    athPrice = 108135 // 2025年W01-W20
  } else if (weekNum <= 27) {
    athPrice = 111814 // 2025年W21-W27
  } else if (weekNum === 28) {
    athPrice = 116462 // 2025年W28
  } else if (weekNum <= 32) {
    athPrice = 122838 // 2025年W29-W32
  } else if (weekNum <= 40) {
    athPrice = 124128 // 2025年W33-W40
  } else {
    athPrice = 126080 // 2025年W41以后
  }
  
  const drawdown = ((currentPrice - athPrice) / athPrice) * 100
  return parseFloat(drawdown.toFixed(1))
}

// 主函数
const main = async () => {
  console.log('🚀 2025年完整数据收集脚本启动...')
  console.log('📅 目标: 2025年全年53周')
  console.log('📊 数据源: Yahoo Finance API')
  console.log('⏱️  预计时间: 约10-15分钟\n')
  
  // 读取现有数据
  const projectRoot = path.resolve(__dirname, '..')
  const srcDataPath = path.join(projectRoot, 'src/data/weeklyData.json')
  const publicDataPath = path.join(projectRoot, 'public/weeklyData.json')
  
  let existingData = {}
  try {
    existingData = JSON.parse(fs.readFileSync(srcDataPath, 'utf8'))
    console.log(`📂 已加载现有数据: ${Object.keys(existingData).length} 周\n`)
  } catch (error) {
    console.log('⚠️ 无法读取现有数据，将创建新文件\n')
  }
  
  const weeks2025 = generate2025Weeks()
  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  
  // 遍历所有周
  for (let i = 0; i < weeks2025.length; i++) {
    const weekConfig = weeks2025[i]
    console.log(`\n📊 [${i + 1}/${weeks2025.length}] 处理 ${weekConfig.weekId} (${weekConfig.start} 到 ${weekConfig.end})`)
    
    try {
      // 检查是否已存在数据
      if (existingData[weekConfig.weekId] && existingData[weekConfig.weekId].btcWeeklyAvgPrice) {
        console.log(`⏭️  ${weekConfig.weekId} 已有数据，跳过`)
        skipCount++
        continue
      }
      
      // 获取BTC数据
      const btcData = await fetchYahooData('BTC-USD', weekConfig.start, weekConfig.end)
      await delay(2000) // 2秒延迟避免频率限制
      
      // 获取ETH数据
      const ethData = await fetchYahooData('ETH-USD', weekConfig.start, weekConfig.end)
      await delay(2000) // 2秒延迟
      
      if (btcData.length === 0 || ethData.length === 0) {
        console.log(`❌ ${weekConfig.weekId} 数据获取失败，跳过`)
        errorCount++
        continue
      }
      
      // 计算周数据
      const btcWeeklyAvg = calculateWeeklyAverage(btcData)
      const ethWeeklyAvg = calculateWeeklyAverage(ethData)
      const btcWeeklyChange = calculateWeeklyChange(weekConfig.weekId, btcWeeklyAvg, existingData)
      const ethBtcRatio = calculateEthBtcRatio(ethWeeklyAvg, btcWeeklyAvg)
      const btcFromATH = calculateBTCFromATH(btcWeeklyAvg, weekConfig.weekId)
      
      // 构建周数据对象
      const weekData = {
        weekId: weekConfig.weekId,
        year: 2025,
        weekNumber: parseInt(weekConfig.weekId.split('-W')[1]),
        weekStart: weekConfig.start,
        weekEnd: weekConfig.end,
        btcWeeklyChange: btcWeeklyChange,
        btcWeeklyAvgPrice: btcWeeklyAvg,
        ethWeeklyAvgPrice: ethWeeklyAvg,
        ethBtcRatio: ethBtcRatio,
        btcFromATH: btcFromATH,
        fearGreedIndex: 50,
        mayerMultiple: 1.5,
        ahr999: 1.0,
        btcFourYearIndex: 0.8,
        personalRating: 3,
        marketTrend: btcWeeklyChange >= 0 ? 'bullish' : 'bearish',
        updatedAt: new Date().toISOString(),
        dataSource: 'yahoo_finance_api',
        rawData: {
          btc: {
            average: btcWeeklyAvg,
            prices: btcData.map(d => d.price),
            dates: btcData.map(d => d.date),
            dataPoints: btcData.length
          },
          eth: {
            average: ethWeeklyAvg,
            prices: ethData.map(d => d.price),
            dates: ethData.map(d => d.date),
            dataPoints: ethData.length
          },
          weeklyChangeData: {
            currentWeekAvg: btcWeeklyAvg,
            previousWeekId: weekConfig.weekId === '2025-W01' ? null : `2025-W${(parseInt(weekConfig.weekId.split('-W')[1]) - 1).toString().padStart(2, '0')}`,
            weeklyChange: btcWeeklyChange
          },
          ratioData: {
            calculationDate: weekConfig.end,
            ethBtcRatio: ethBtcRatio
          }
        }
      }
      
      // 保存到现有数据中
      existingData[weekConfig.weekId] = weekData
      
      console.log(`✅ ${weekConfig.weekId} 数据收集完成:`)
      console.log(`   BTC均价: $${btcWeeklyAvg.toLocaleString()}`)
      console.log(`   ETH均价: $${ethWeeklyAvg.toLocaleString()}`)
      console.log(`   周涨跌: ${btcWeeklyChange}%`)
      console.log(`   距ATH: ${btcFromATH}%`)
      
      successCount++
      
      // 每收集10周保存一次
      if ((i + 1) % 10 === 0) {
        console.log('\n💾 保存中间结果...')
        fs.writeFileSync(srcDataPath, JSON.stringify(existingData, null, 2), 'utf8')
        fs.writeFileSync(publicDataPath, JSON.stringify(existingData, null, 2), 'utf8')
        console.log(`✅ 已保存 ${Object.keys(existingData).length} 周数据`)
      }
      
    } catch (error) {
      console.error(`💥 处理 ${weekConfig.weekId} 时出错:`, error.message)
      errorCount++
    }
  }
  
  // 保存最终数据
  if (successCount > 0) {
    try {
      fs.writeFileSync(srcDataPath, JSON.stringify(existingData, null, 2), 'utf8')
      fs.writeFileSync(publicDataPath, JSON.stringify(existingData, null, 2), 'utf8')
      
      console.log(`\n🎉 2025年数据收集完成!`)
      console.log(`✅ 新收集: ${successCount} 周`)
      console.log(`⏭️  跳过: ${skipCount} 周`)
      console.log(`❌ 失败: ${errorCount} 周`)
      console.log(`📦 总计: ${Object.keys(existingData).length} 周`)
      console.log(`💾 数据已保存到: ${srcDataPath}`)
      console.log(`💾 数据已保存到: ${publicDataPath}`)
    } catch (error) {
      console.error('💥 保存数据失败:', error.message)
    }
  } else {
    console.log('\n⚠️ 没有新数据需要保存')
  }
}

// 执行脚本
console.log('📋 脚本开始执行...')
main().catch(error => {
  console.error('💥 脚本执行失败:', error)
  process.exit(1)
})
