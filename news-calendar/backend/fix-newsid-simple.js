import { getDatabase } from './database.js'

// 将中文日期格式转换为数字格式
function convertChineseDateToNumeric(chineseDate) {
  // 匹配: "2026年1月24日星期六" 或 "2026年1月24日 星期六"
  const dateMatch = chineseDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!dateMatch) {
    return null
  }
  
  const year = dateMatch[1]
  const month = dateMatch[2].padStart(2, '0')
  const day = dateMatch[3].padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 转换newsId格式
function convertNewsId(oldNewsId) {
  try {
    console.log('处理newsId:', oldNewsId)
    
    // 如果已经是数字格式，直接返回
    if (oldNewsId.match(/^\d{4}-\d{2}-\d{2}-/)) {
      console.log('已是数字格式，跳过')
      return oldNewsId
    }
    
    // 处理中文格式: "2026年1月24日星期六-asia_economy-0"
    const lastDashIndex = oldNewsId.lastIndexOf('-')
    if (lastDashIndex === -1) {
      console.log('找不到最后一个-')
      return null
    }
    
    const index = oldNewsId.substring(lastDashIndex + 1)
    const remaining = oldNewsId.substring(0, lastDashIndex)
    
    const secondLastDashIndex = remaining.lastIndexOf('-')
    if (secondLastDashIndex === -1) {
      console.log('找不到倒数第二个-')
      return null
    }
    
    const category = remaining.substring(secondLastDashIndex + 1)
    const dateStr = remaining.substring(0, secondLastDashIndex)
    
    console.log('分解结果:')
    console.log('- 日期字符串:', dateStr)
    console.log('- 类别:', category)
    console.log('- 索引:', index)
    
    const numericDate = convertChineseDateToNumeric(dateStr)
    if (!numericDate) {
      console.log('无法转换日期')
      return null
    }
    
    const newNewsId = `${numericDate}-${category}-${index}`
    console.log('转换结果:', newNewsId)
    return newNewsId
  } catch (error) {
    console.error('转换newsId失败:', oldNewsId, error)
    return null
  }
}

async function fixNewsIdFormat() {
  const db = getDatabase()
  
  console.log('=== 开始修复newsId格式 ===')
  
  // 获取所有emoji反应记录
  const query = 'SELECT id, news_id FROM emoji_reactions ORDER BY id'
  
  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('查询失败:', err.message)
        reject(err)
        return
      }
      
      console.log(`找到 ${rows.length} 条记录`)
      
      if (rows.length === 0) {
        console.log('没有找到需要修复的记录')
        resolve()
        return
      }
      
      let processedCount = 0
      let updatedCount = 0
      
      rows.forEach((row, index) => {
        console.log(`\n=== 处理第 ${index + 1} 条记录 ===`)
        console.log('ID:', row.id)
        
        const oldNewsId = row.news_id
        const newNewsId = convertNewsId(oldNewsId)
        
        if (newNewsId && newNewsId !== oldNewsId) {
          console.log(`需要更新: ${oldNewsId} -> ${newNewsId}`)
          
          // 更新记录
          const updateQuery = 'UPDATE emoji_reactions SET news_id = ? WHERE id = ?'
          db.run(updateQuery, [newNewsId, row.id], function(updateErr) {
            processedCount++
            
            if (updateErr) {
              console.error(`更新记录 ${row.id} 失败:`, updateErr.message)
            } else {
              updatedCount++
              console.log(`✓ 成功更新记录 ${row.id}`)
            }
            
            // 检查是否所有记录都处理完了
            if (processedCount === rows.length) {
              console.log(`\n=== 修复完成 ===`)
              console.log(`总记录数: ${rows.length}`)
              console.log(`更新记录数: ${updatedCount}`)
              console.log(`跳过记录数: ${rows.length - updatedCount}`)
              resolve()
            }
          })
        } else {
          processedCount++
          console.log(`跳过: ${oldNewsId} (已是正确格式或无法转换)`)
          
          // 检查是否所有记录都处理完了
          if (processedCount === rows.length) {
            console.log(`\n=== 修复完成 ===`)
            console.log(`总记录数: ${rows.length}`)
            console.log(`更新记录数: ${updatedCount}`)
            console.log(`跳过记录数: ${rows.length - updatedCount}`)
            resolve()
          }
        }
      })
    })
  })
}

// 运行修复
fixNewsIdFormat()
  .then(() => {
    console.log('\n=== 验证修复结果 ===')
    const db = getDatabase()
    db.all('SELECT news_id, COUNT(*) as count FROM emoji_reactions GROUP BY news_id ORDER BY count DESC', [], (err, results) => {
      if (err) {
        console.error('查询修复后数据失败:', err.message)
      } else {
        console.log('修复后的数据:')
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.news_id} (${result.count} 反应)`)
        })
      }
      process.exit(0)
    })
  })
  .catch((error) => {
    console.error('修复失败:', error)
    process.exit(1)
  })