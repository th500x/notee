import fs from 'fs'

const csvPath = '04-coin-index/data-import.csv'
const csv = fs.readFileSync(csvPath, 'utf8')

const lines = csv.split('\n')
const fixedLines = []

console.log('🔧 开始修正CSV格式...\n')

lines.forEach((line, index) => {
  if (index === 0) {
    // 保留表头
    fixedLines.push(line)
    return
  }
  
  if (!line.trim() || !line.includes(',')) {
    // 保留空行
    fixedLines.push(line)
    return
  }
  
  const parts = line.split(',')
  const weekId = parts[0]
  
  // 修正2025年的周ID格式
  if (weekId.includes('2025')) {
    let newWeekId = weekId
    
    // 2025.00000006 -> 2025-W06
    if (/2025\.0+(\d+)/.test(weekId)) {
      const match = weekId.match(/2025\.0+(\d+)/)
      const weekNum = match[1].padStart(2, '0')
      newWeekId = `2025-W${weekNum}`
    }
    // 2025.0-W11 -> 2025-W11
    else if (/2025\.0-W(\d+)/.test(weekId)) {
      const match = weekId.match(/2025\.0-W(\d+)/)
      newWeekId = `2025-W${match[1]}`
    }
    // 0.0-W22 -> 2025-W22
    else if (/0\.0-W(\d+)/.test(weekId)) {
      const match = weekId.match(/0\.0-W(\d+)/)
      newWeekId = `2025-W${match[1]}`
    }
    
    if (newWeekId !== weekId) {
      console.log(`✏️  ${weekId} → ${newWeekId}`)
      parts[0] = newWeekId
      fixedLines.push(parts.join(','))
    } else {
      fixedLines.push(line)
    }
  } else {
    fixedLines.push(line)
  }
})

// 保存修正后的CSV
fs.writeFileSync(csvPath, fixedLines.join('\n'), 'utf8')

console.log('\n✅ CSV格式修正完成!')
console.log(`📄 文件: ${csvPath}`)
