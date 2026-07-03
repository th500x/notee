// 手动数据导入脚本 - 从 docs/tools/data-import.csv 导入指标数据
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { MANUAL_CSV_PATH, PUBLIC_DATA_PATH, SRC_DATA_PATH } from './lib/weeklyDataStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// BTC ATH价格 - 固定值
const BTC_ATH_PRICE = 126080 // 美元

// 计算BTC距ATH回撤百分比
const calculateBTCFromATH = (currentPrice) => {
  const drawdown = ((currentPrice - BTC_ATH_PRICE) / BTC_ATH_PRICE) * 100
  return parseFloat(drawdown.toFixed(1))
}

// CSV解析函数 - 只处理有周ID的行
const parseCSV = (csvContent) => {
  const lines = csvContent.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    
    // 跳过空行
    if (values.length < headers.length || values.every(v => !v)) {
      continue
    }
    
    // 只处理第一列有周ID的行
    const weekIdValue = values[0]
    if (!weekIdValue) {
      console.log(`⏭️ 跳过第${i+1}行: 无周ID`)
      continue
    }
    
    const row = {}
    
    headers.forEach((header, index) => {
      const value = values[index]
      
      // 数据类型转换
      if (header === '周ID') {
        // 标准化周ID格式：2026.0-W01 → 2026-W01
        row.weekId = value.replace(/\.0-/, '-')
      } else if (header === '恐惧&贪婪指数') {
        row.fearGreedIndex = value && !isNaN(value) ? Math.round(parseFloat(value)) : 50
      } else if (header === '梅耶倍数') {
        row.mayerMultiple = value && !isNaN(value) ? parseFloat(parseFloat(value).toFixed(2)) : 1.5
      } else if (header === 'Ahr999指标') {
        row.ahr999 = value && !isNaN(value) ? parseFloat(parseFloat(value).toFixed(2)) : 1.0
      } else if (header === 'BTC四年指数') {
        row.btcFourYearIndex = value && !isNaN(value) ? parseFloat(parseFloat(value).toFixed(2)) : 0.8
      } else if (header === '美联储利率') {
        row.fedRate = value && !isNaN(value) ? parseFloat(parseFloat(value).toFixed(2)) : undefined
      } else if (header === '日央行利率') {
        row.bojRate = value && !isNaN(value) ? parseFloat(parseFloat(value).toFixed(2)) : undefined
      }
    })
    
    console.log(`✅ 解析第${i+1}行: ${row.weekId} - 恐惧&贪婪=${row.fearGreedIndex}, 梅耶=${row.mayerMultiple}, Ahr999=${row.ahr999}, 四年=${row.btcFourYearIndex}`)
    data.push(row)
  }
  
  return data
}

// 处理多行数据 - 计算平均值
const processMultipleRows = (data) => {
  const weekGroups = {}
  
  // 按周ID分组
  data.forEach(row => {
    if (!weekGroups[row.weekId]) {
      weekGroups[row.weekId] = []
    }
    weekGroups[row.weekId].push(row)
  })
  
  // 计算每周的平均值
  const processedData = []
  Object.keys(weekGroups).forEach(weekId => {
    const rows = weekGroups[weekId]
    
    if (rows.length === 1) {
      processedData.push(rows[0])
    } else {
      // 计算平均值
      const avgRow = { weekId }
      
      const validRows = rows.filter(r => 
        r.fearGreedIndex !== undefined || 
        r.mayerMultiple !== undefined || 
        r.ahr999 !== undefined || 
        r.btcFourYearIndex !== undefined
      )
      
      if (validRows.length > 0) {
        // 计算各指标平均值
        const fearGreedValues = validRows.filter(r => r.fearGreedIndex !== undefined).map(r => r.fearGreedIndex)
        const mayerValues = validRows.filter(r => r.mayerMultiple !== undefined).map(r => r.mayerMultiple)
        const ahr999Values = validRows.filter(r => r.ahr999 !== undefined).map(r => r.ahr999)
        const fourYearValues = validRows.filter(r => r.btcFourYearIndex !== undefined).map(r => r.btcFourYearIndex)
        
        if (fearGreedValues.length > 0) {
          avgRow.fearGreedIndex = Math.round(fearGreedValues.reduce((a, b) => a + b, 0) / fearGreedValues.length)
        }
        if (mayerValues.length > 0) {
          avgRow.mayerMultiple = parseFloat((mayerValues.reduce((a, b) => a + b, 0) / mayerValues.length).toFixed(2))
        }
        if (ahr999Values.length > 0) {
          avgRow.ahr999 = parseFloat((ahr999Values.reduce((a, b) => a + b, 0) / ahr999Values.length).toFixed(2))
        }
        if (fourYearValues.length > 0) {
          avgRow.btcFourYearIndex = parseFloat((fourYearValues.reduce((a, b) => a + b, 0) / fourYearValues.length).toFixed(2))
        }
        
        console.log(`📊 ${weekId}: 合并${validRows.length}行数据 → 恐惧&贪婪=${avgRow.fearGreedIndex}, 梅耶=${avgRow.mayerMultiple}, Ahr999=${avgRow.ahr999}, 四年=${avgRow.btcFourYearIndex}`)
        processedData.push(avgRow)
      }
    }
  })
  
  return processedData
}
const calculatePersonalRating = (weekData) => {
  try {
    // 按照COMPLETE_GUIDE.md定义的评分标准计算各指标评分
    const scores = {}
    
    // 1. BTC周涨跌幅评分 (-2到+2)
    const btcChange = weekData.btcWeeklyChange
    if (btcChange <= -20) scores.btcWeeklyChange = 2
    else if (btcChange <= -10) scores.btcWeeklyChange = 1
    else if (btcChange <= 10) scores.btcWeeklyChange = 0
    else if (btcChange <= 20) scores.btcWeeklyChange = -1
    else scores.btcWeeklyChange = -2
    
    // 2. BTC距ATH回撤评分 (-2到+2)
    const btcFromATH = weekData.btcFromATH
    if (btcFromATH <= -40) scores.btcFromATH = 2
    else if (btcFromATH <= -20) scores.btcFromATH = 1
    else if (btcFromATH <= 20) scores.btcFromATH = 0
    else if (btcFromATH <= 40) scores.btcFromATH = -1
    else scores.btcFromATH = -2
    
    // 3. 恐惧&贪婪指数评分 (-2到+2)
    const fearGreed = weekData.fearGreedIndex
    if (fearGreed <= 20) scores.fearGreedIndex = 2
    else if (fearGreed <= 40) scores.fearGreedIndex = 1
    else if (fearGreed <= 60) scores.fearGreedIndex = 0
    else if (fearGreed <= 80) scores.fearGreedIndex = -1
    else scores.fearGreedIndex = -2
    
    // 4. 梅耶倍数评分 (-2到+2)
    const mayer = weekData.mayerMultiple
    if (mayer <= 0.8) scores.mayerMultiple = 2
    else if (mayer <= 0.9) scores.mayerMultiple = 1
    else if (mayer <= 1.1) scores.mayerMultiple = 0
    else if (mayer <= 1.2) scores.mayerMultiple = -1
    else scores.mayerMultiple = -2
    
    // 5. Ahr999指标评分 (-2到+2)
    const ahr = weekData.ahr999
    if (ahr <= 0.4) scores.ahr999 = 2
    else if (ahr <= 0.8) scores.ahr999 = 1
    else if (ahr <= 1.2) scores.ahr999 = 0
    else if (ahr <= 1.6) scores.ahr999 = -1
    else scores.ahr999 = -2
    
    // 6. BTC四年指数评分 (-2到+2)
    const fourYear = weekData.btcFourYearIndex
    if (fourYear <= 1.6) scores.btcFourYearIndex = 2
    else if (fourYear <= 1.8) scores.btcFourYearIndex = 1
    else if (fourYear <= 2.0) scores.btcFourYearIndex = 0
    else if (fourYear <= 2.2) scores.btcFourYearIndex = -1
    else scores.btcFourYearIndex = -2
    
    // 7. 美联储利率评分 (-2到+2)
    const fedRate = weekData.fedRate
    if (fedRate <= 1.5) scores.fedRate = 2
    else if (fedRate <= 2.5) scores.fedRate = 1
    else if (fedRate <= 3.5) scores.fedRate = 0
    else if (fedRate <= 4.5) scores.fedRate = -1
    else scores.fedRate = -2
    
    // 8. 日央行利率评分 (-2到+2)
    const bojRate = weekData.bojRate
    if (bojRate <= 0) scores.bojRate = 2
    else if (bojRate <= 1) scores.bojRate = 1
    else if (bojRate <= 2) scores.bojRate = 0
    else if (bojRate <= 3) scores.bojRate = -1
    else scores.bojRate = -2
    
    // 计算总分 (范围: -16到+16)
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)
    
    // 保存各指标评分到weekData
    weekData.indicatorScores = scores
    weekData.totalScore = totalScore
    
    console.log(`📊 评级计算:`)
    console.log(`  BTC周涨跌幅: ${btcChange.toFixed(2)}% → ${scores.btcWeeklyChange}分`)
    console.log(`  BTC距ATH: ${btcFromATH.toFixed(2)}% → ${scores.btcFromATH}分`)
    console.log(`  恐惧贪婪: ${fearGreed} → ${scores.fearGreedIndex}分`)
    console.log(`  梅耶倍数: ${mayer.toFixed(2)} → ${scores.mayerMultiple}分`)
    console.log(`  Ahr999: ${ahr.toFixed(2)} → ${scores.ahr999}分`)
    console.log(`  四年指数: ${fourYear.toFixed(2)} → ${scores.btcFourYearIndex}分`)
    console.log(`  美联储利率: ${fedRate}% → ${scores.fedRate}分`)
    console.log(`  日央行利率: ${bojRate}% → ${scores.bojRate}分`)
    console.log(`  总分: ${totalScore}分`)
    
    return totalScore
    
  } catch (error) {
    console.error('❌ 评级计算失败:', error.message)
    return 0 // 默认0分
  }
}

// 更新JSON数据文件
const updateWeeklyData = (importedData, targetFile) => {
  try {
    const projectRoot = path.resolve(__dirname, '..')
    const filePath = path.join(projectRoot, targetFile)
    
    // 读取现有数据
    let existingData = {}
    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf8')
      existingData = JSON.parse(existingContent)
    }
    
    // 更新数据
    let updatedCount = 0
    importedData.forEach(row => {
      const weekId = row.weekId
      
      if (existingData[weekId]) {
        // 更新指定的指标字段
        existingData[weekId].fearGreedIndex = row.fearGreedIndex
        existingData[weekId].mayerMultiple = row.mayerMultiple
        existingData[weekId].ahr999 = row.ahr999
        existingData[weekId].btcFourYearIndex = row.btcFourYearIndex
        if (row.fedRate !== undefined) existingData[weekId].fedRate = row.fedRate
        if (row.bojRate !== undefined) existingData[weekId].bojRate = row.bojRate
        
        // 重新计算BTC距ATH回撤 (使用固定ATH价格)
        if (existingData[weekId].btcWeeklyAvgPrice) {
          existingData[weekId].btcFromATH = calculateBTCFromATH(existingData[weekId].btcWeeklyAvgPrice)
        }
        
        // 自动计算个人评级
        const calculatedRating = calculatePersonalRating(existingData[weekId])
        existingData[weekId].personalRating = calculatedRating
        
        existingData[weekId].updatedAt = new Date().toISOString()
        
        updatedCount++
        console.log(`✅ 更新 ${weekId}: 恐惧&贪婪=${row.fearGreedIndex}, 梅耶=${row.mayerMultiple}, Ahr999=${row.ahr999}, 四年指数=${row.btcFourYearIndex}, ATH回撤=${existingData[weekId].btcFromATH}% → 评级=${calculatedRating}★`)
      } else {
        console.log(`⚠️ 跳过 ${weekId}: 周数据不存在`)
      }
    })
    
    // 保存更新后的数据
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf8')
    console.log(`\n💾 数据已保存到: ${filePath}`)
    console.log(`📊 总计更新: ${updatedCount} 周`)
    
    return updatedCount
    
  } catch (error) {
    console.error('❌ 更新数据失败:', error.message)
    return 0
  }
}

// 主函数
const main = async () => {
  console.log('📋 开始导入手动数据...')
  
  // CSV 唯一路径：docs/tools/data-import.csv
  const csvFilePath = MANUAL_CSV_PATH
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV文件不存在: ${csvFilePath}`)
    console.log('💡 请编辑 docs/tools/data-import.csv')
    return
  }
  
  try {
    // 读取并解析CSV文件
    const csvContent = fs.readFileSync(csvFilePath, 'utf8')
    console.log('📖 读取CSV文件成功')
    
    const importedData = parseCSV(csvContent)
    console.log(`📊 解析到 ${importedData.length} 条数据`)
    
    console.log('\n🔄 更新 public/weeklyData.json...')
    const publicUpdated = updateWeeklyData(importedData, 'public/weeklyData.json')
    
    console.log('\n🔄 同步 src/data/weeklyData.json...')
    if (fs.existsSync(PUBLIC_DATA_PATH)) {
      fs.copyFileSync(PUBLIC_DATA_PATH, SRC_DATA_PATH)
    }
    
    console.log('\n🎉 数据导入完成!')
    console.log(`📈 public数据: ${publicUpdated} 周已更新`)
    
  } catch (error) {
    console.error('💥 导入失败:', error.message)
  }
}

// 执行导入
console.log('🚀 手动数据导入脚本启动...')
main().catch(error => {
  console.error('💥 脚本执行失败:', error)
})

export { parseCSV, updateWeeklyData, calculatePersonalRating }