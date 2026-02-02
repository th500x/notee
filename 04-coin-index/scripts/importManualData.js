// 手动数据导入脚本 - 从CSV文件导入指标数据
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
    // 指标权重配置
    const weights = {
      fearGreed: 0.25,      // 恐惧&贪婪指数权重 25%
      mayer: 0.25,          // 梅耶倍数权重 25%
      ahr999: 0.25,         // Ahr999指标权重 25%
      fourYear: 0.25        // BTC四年指数权重 25%
    }
    
    // 指标标准化函数 (转换为0-1分数，1=最佳投资时机)
    const normalizeIndicators = (data) => {
      // 恐惧&贪婪指数：越低越好 (恐惧时买入)
      const fearGreedScore = Math.max(0, Math.min(1, (100 - data.fearGreedIndex) / 100))
      
      // 梅耶倍数：越低越好 (<1.0最佳，>2.4过高)
      const mayerScore = data.mayerMultiple <= 1.0 ? 1.0 : 
                        data.mayerMultiple <= 2.4 ? (2.4 - data.mayerMultiple) / 1.4 : 0
      
      // Ahr999指标：越低越好 (≤0.45最佳，≤1.2可接受)
      const ahr999Score = data.ahr999 <= 0.45 ? 1.0 :
                         data.ahr999 <= 1.2 ? (1.2 - data.ahr999) / 0.75 : 0
      
      // BTC四年指数：越低越好 (≤0.6最佳，≤1.0可接受)
      const fourYearScore = data.btcFourYearIndex <= 0.6 ? 1.0 :
                           data.btcFourYearIndex <= 1.0 ? (1.0 - data.btcFourYearIndex) / 0.4 : 0
      
      return {
        fearGreedScore,
        mayerScore,
        ahr999Score,
        fourYearScore
      }
    }
    
    // 计算标准化分数
    const scores = normalizeIndicators(weekData)
    
    // 加权平均计算
    const weightedScore = 
      scores.fearGreedScore * weights.fearGreed +
      scores.mayerScore * weights.mayer +
      scores.ahr999Score * weights.ahr999 +
      scores.fourYearScore * weights.fourYear
    
    // 转换为1-5星评级
    const rating = Math.max(1, Math.min(5, Math.round(weightedScore * 4 + 1)))
    
    console.log(`📊 评级计算 - 恐惧贪婪:${scores.fearGreedScore.toFixed(2)} 梅耶:${scores.mayerScore.toFixed(2)} Ahr999:${scores.ahr999Score.toFixed(2)} 四年:${scores.fourYearScore.toFixed(2)} → ${rating}★`)
    
    return rating
    
  } catch (error) {
    console.error('❌ 评级计算失败:', error.message)
    return 3 // 默认3星
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
  
  // CSV文件路径
  const projectRoot = path.resolve(__dirname, '..')
  const csvFilePath = path.join(projectRoot, 'data-import.csv')
  
  // 检查CSV文件是否存在
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV文件不存在: ${csvFilePath}`)
    console.log('💡 请先填写 data-import-template.csv 文件')
    return
  }
  
  try {
    // 读取并解析CSV文件
    const csvContent = fs.readFileSync(csvFilePath, 'utf8')
    console.log('📖 读取CSV文件成功')
    
    const importedData = parseCSV(csvContent)
    console.log(`📊 解析到 ${importedData.length} 条数据`)
    
    // 更新两个数据文件
    console.log('\n🔄 更新 src/data/weeklyData.json...')
    const srcUpdated = updateWeeklyData(importedData, 'src/data/weeklyData.json')
    
    console.log('\n🔄 更新 public/weeklyData.json...')
    const publicUpdated = updateWeeklyData(importedData, 'public/weeklyData.json')
    
    console.log('\n🎉 数据导入完成!')
    console.log(`📈 src数据: ${srcUpdated} 周已更新`)
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