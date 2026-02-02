import { getDatabase } from './database.js'

// 将中文日期格式转换为数字格式
function convertChineseDateToNumeric(chineseDate) {
  // 匹配: "2026年1月30日星期五" 或 "2026年1月30日 星期五"
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
    // 如果已经是数字格式，直接返回
    if (oldNewsId.match(/^\d{4}-\d{2}-\d{2}-/)) {
      return oldNewsId
    }
    
    // 处理中文格式: "2026年1月30日星期五-world_economy-0"
    const lastDashIndex = oldNewsId.lastIndexOf('-')
    if (lastDashIndex === -1) return null
    
    const index = oldNewsId.substring(lastDashIndex + 1)
    const remaining = oldNewsId.substring(0, lastDashIndex)
    
    const secondLastDashIndex = remaining.lastIndexOf('-')
    if (secondLastDashIndex === -1) return null
    
    const category = remaining.substring(secondLastDashIndex + 1)
    const dateStr = remaining.substring(0, secondLastDashIndex)
    
    const numericDate = convertChineseDateToNumeric(dateStr)
    if (!numericDate) return null
    
    return `${numericDate}-${category}-${index}`
  } catch (error) {
    console.error('转换newsId失败:', oldNewsId, error)
    return null
  }
}

async function fixNewsIdFormat() {
  const db = getDatabase()
  
  console.log('开始修复newsId格式...')
  
  // 获取所有emoji反应记录
  const query = 'SELECT id, news_id FROM emoji_reactions'
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('查询失败:', err.message)
      return
    }
    
    console.log(`找到 ${rows.length} 条记录`)
    
    let updatedCount = 0
    let processedCount = 0
    
    rows.forEach((row) => {
      const oldNewsId = row.news_id
      const newNewsId = convertNewsId(oldNewsId)
      
      processedCount++
      
      if (newNewsId && newNewsId !== oldNewsId) {
        console.log(`转换: ${oldNewsId} -> ${newNewsId}`)
        
        // 更新记录
        const updateQuery = 'UPDATE emoji_reactions SET news_id = ? WHERE id = ?'
        db.run(updateQuery, [newNewsId, row.id], function(updateErr) {
          if (updateErr) {
            console.error(`更新记录 ${row.id} 失败:`, updateErr.message)
          } else {
            updatedCount++
            console.log(`✓ 更新记录 ${row.id}`)
          }
          
          // 检查是否所有记录都处理完了
          if (processedCount === rows.length) {
            console.log(`\n修复完成！`)
            console.log(`总记录数: ${rows.length}`)
            console.log(`更新记录数: ${updatedCount}`)
            console.log(`跳过记录数: ${rows.length - updatedCount}`)
            
            // 显示修复后的数据
            console.log('\n修复后的数据:')
            db.all('SELECT news_id, COUNT(*) as count FROM emoji_reactions GROUP BY news_id ORDER BY count DESC', [], (err, results) => {
              if (err) {
                console.error('查询修复后数据失败:', err.message)
              } else {
                results.forEach((result, index) => {
                  console.log(`${index + 1}. ${result.news_id} (${result.count} 反应)`)
                })
              }
              process.exit(0)
            })
          }
        })
      } else {
        console.log(`跳过: ${oldNewsId} (已是正确格式或无法转换)`)
        
        // 检查是否所有记录都处理完了
        if (processedCount === rows.length) {
          console.log(`\n修复完成！`)
          console.log(`总记录数: ${rows.length}`)
          console.log(`更新记录数: ${updatedCount}`)
          console.log(`跳过记录数: ${rows.length - updatedCount}`)
          
          // 显示修复后的数据
          console.log('\n修复后的数据:')
          db.all('SELECT news_id, COUNT(*) as count FROM emoji_reactions GROUP BY news_id ORDER BY count DESC', [], (err, results) => {
            if (err) {
              console.error('查询修复后数据失败:', err.message)
            } else {
              results.forEach((result, index) => {
                console.log(`${index + 1}. ${result.news_id} (${result.count} 反应)`)
              })
            }
            process.exit(0)
          })
        }
      }
    })
    
    if (rows.length === 0) {
      console.log('没有找到需要修复的记录')
      process.exit(0)
    }
  })
}

// 运行修复
fixNewsIdFormat()