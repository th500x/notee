import fs from 'fs'
import { execSync } from 'child_process'

// 从git获取数据
const gitData = execSync('git show 579c58d:04-coin-index/src/data/weeklyData.json', { encoding: 'utf8' })

// 解析JSON
const data = JSON.parse(gitData)

// 筛选2025年的数据
const weeks2025 = Object.keys(data).filter(k => k.startsWith('2025')).sort()

console.log('📊 2025年数据统计:')
console.log(`   总周数: ${weeks2025.length}`)
console.log(`   周范围: ${weeks2025[0]} 到 ${weeks2025[weeks2025.length-1]}`)
console.log(`\n📋 所有周:`)
console.log(weeks2025.join(', '))

// 保存2025年数据
const data2025 = {}
weeks2025.forEach(week => {
  data2025[week] = data[week]
})

fs.writeFileSync('temp_2025_only.json', JSON.stringify(data2025, null, 2), 'utf8')
console.log('\n✅ 2025年数据已保存到 temp_2025_only.json')
