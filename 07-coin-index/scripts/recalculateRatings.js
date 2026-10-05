// 重新计算所有周的个人评级 + T0「必」
import { loadWeeklyData, saveWeeklyData } from './lib/weeklyDataStore.js'
import { applyT0MustToData } from '../src/utils/t0Must.js'
import { applyT1RecommendToData } from '../src/utils/t1Recommend.js'

// 按照COMPLETE_GUIDE.md定义计算个人评级
const calculatePersonalRating = (weekData) => {
  try {
    const scores = {}
    
    const hasNum = (v) => v !== undefined && v !== null && !Number.isNaN(Number(v))

    // 1. BTC周涨跌幅评分
    const btcChange = weekData.btcWeeklyChange
    if (hasNum(btcChange)) {
      if (btcChange <= -20) scores.btcWeeklyChange = 2
      else if (btcChange <= -10) scores.btcWeeklyChange = 1
      else if (btcChange <= 10) scores.btcWeeklyChange = 0
      else if (btcChange <= 20) scores.btcWeeklyChange = -1
      else scores.btcWeeklyChange = -2
    }
    
    // 2. BTC距ATH回撤评分
    const btcFromATH = weekData.btcFromATH
    if (hasNum(btcFromATH)) {
      if (btcFromATH <= -40) scores.btcFromATH = 2
      else if (btcFromATH <= -20) scores.btcFromATH = 1
      else if (btcFromATH <= 20) scores.btcFromATH = 0
      else if (btcFromATH <= 40) scores.btcFromATH = -1
      else scores.btcFromATH = -2
    }
    
    // 3. 恐惧&贪婪指数评分（缺值不计分，不按占位默认）
    const fearGreed = weekData.fearGreedIndex
    if (hasNum(fearGreed)) {
      if (fearGreed <= 20) scores.fearGreedIndex = 2
      else if (fearGreed <= 40) scores.fearGreedIndex = 1
      else if (fearGreed <= 60) scores.fearGreedIndex = 0
      else if (fearGreed <= 80) scores.fearGreedIndex = -1
      else scores.fearGreedIndex = -2
    }
    
    // 4. 梅耶倍数评分
    const mayer = weekData.mayerMultiple
    if (hasNum(mayer)) {
      if (mayer <= 0.8) scores.mayerMultiple = 2
      else if (mayer <= 0.9) scores.mayerMultiple = 1
      else if (mayer <= 1.1) scores.mayerMultiple = 0
      else if (mayer <= 1.2) scores.mayerMultiple = -1
      else scores.mayerMultiple = -2
    }
    
    // 5. Ahr999指标评分
    const ahr = weekData.ahr999
    if (hasNum(ahr)) {
      if (ahr <= 0.4) scores.ahr999 = 2
      else if (ahr <= 0.8) scores.ahr999 = 1
      else if (ahr <= 1.2) scores.ahr999 = 0
      else if (ahr <= 1.6) scores.ahr999 = -1
      else scores.ahr999 = -2
    }
    
    // 6. BTC四年指数评分
    const fourYear = weekData.btcFourYearIndex
    if (hasNum(fourYear)) {
      if (fourYear <= 1.6) scores.btcFourYearIndex = 2
      else if (fourYear <= 1.8) scores.btcFourYearIndex = 1
      else if (fourYear <= 2.0) scores.btcFourYearIndex = 0
      else if (fourYear <= 2.2) scores.btcFourYearIndex = -1
      else scores.btcFourYearIndex = -2
    }
    
    // 7. 美联储利率评分
    const fedRate = weekData.fedRate
    if (hasNum(fedRate)) {
      if (fedRate <= 1.5) scores.fedRate = 2
      else if (fedRate <= 2.5) scores.fedRate = 1
      else if (fedRate <= 3.5) scores.fedRate = 0
      else if (fedRate <= 4.5) scores.fedRate = -1
      else scores.fedRate = -2
    }
    
    // 8. 日央行利率评分
    const bojRate = weekData.bojRate
    if (hasNum(bojRate)) {
      if (bojRate <= 0) scores.bojRate = 2
      else if (bojRate <= 1) scores.bojRate = 1
      else if (bojRate <= 2) scores.bojRate = 0
      else if (bojRate <= 3) scores.bojRate = -1
      else scores.bojRate = -2
    }
    
    // 计算总分
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
    
    return { scores, totalScore }
    
  } catch (error) {
    console.error('❌ 评级计算失败:', error.message)
    return { scores: {}, totalScore: 0 }
  }
}

// 主函数
const main = () => {
  console.log('🔄 开始重新计算所有周的个人评级...\n')

  const data = loadWeeklyData()
  const weekIds = Object.keys(data).sort()
  
  let updatedCount = 0
  let errorCount = 0
  
  // 遍历所有周
  weekIds.forEach(weekId => {
    try {
      const weekData = data[weekId]
      
      // 计算新的评分
      const { scores, totalScore } = calculatePersonalRating(weekData)
      
      // 保存旧评分用于对比
      const oldRating = weekData.personalRating
      
      // 更新数据
      weekData.indicatorScores = scores
      weekData.totalScore = totalScore
      weekData.personalRating = totalScore
      weekData.updatedAt = new Date().toISOString()
      
      // 显示变化
      if (oldRating !== totalScore) {
        console.log(`📊 ${weekId}: ${oldRating} → ${totalScore} (${totalScore > oldRating ? '+' : ''}${totalScore - oldRating})`)
        const show = (v) => (v === undefined || v === null ? 'N/A' : v)
        console.log(
          `   各指标: BTC涨跌=${show(scores.btcWeeklyChange)} ATH=${show(scores.btcFromATH)} 恐惧=${show(scores.fearGreedIndex)} 梅耶=${show(scores.mayerMultiple)} Ahr=${show(scores.ahr999)} 四年=${show(scores.btcFourYearIndex)} 美联储=${show(scores.fedRate)} 日央行=${show(scores.bojRate)}`,
        )
      } else {
        console.log(`✓ ${weekId}: ${totalScore} (无变化)`)
      }
      
      updatedCount++
      
    } catch (error) {
      console.error(`❌ ${weekId} 计算失败:`, error.message)
      errorCount++
    }
  })
  
  const t0Signals = applyT0MustToData(data)
  const t0Buy = Object.entries(t0Signals).filter(([, signal]) => signal === 'buy').map(([id]) => id)
  const t0Sell = Object.entries(t0Signals).filter(([, signal]) => signal === 'sell').map(([id]) => id)
  console.log(`\n🎯 T0 必买 (${t0Buy.length}): ${t0Buy.join(', ') || '无'}`)
  console.log(`🎯 T0 必卖 (${t0Sell.length}): ${t0Sell.join(', ') || '无'}`)

  const t1Signals = applyT1RecommendToData(data)
  const t1Buy = Object.entries(t1Signals).filter(([, signal]) => signal === 'buy').map(([id]) => id)
  const t1Sell = Object.entries(t1Signals).filter(([, signal]) => signal === 'sell').map(([id]) => id)
  console.log(`\n📌 T1 荐买 (${t1Buy.length}): ${t1Buy.join(', ') || '无'}`)
  console.log(`📌 T1 荐卖 (${t1Sell.length}): ${t1Sell.join(', ') || '无'}`)

  saveWeeklyData(data)

  console.log(`\n✅ 完成！`)
  console.log(`📊 总计处理: ${weekIds.length} 周`)
  console.log(`✓ 成功更新: ${updatedCount} 周`)
  if (errorCount > 0) {
    console.log(`❌ 失败: ${errorCount} 周`)
  }
}

main()
