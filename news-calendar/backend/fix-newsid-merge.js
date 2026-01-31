import { getDatabase } from './database.js'

// 将中文日期格式转换为数字格式
function convertChineseDateToNumeric(chineseDate) {
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
    
    // 处理中文格式
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
  
  console.log('=== 开始智能修复newsId格式 ===')
  
  return new Promise((resolve, reject) => {
    // 获取所有需要转换的记录（中文格式）
    const query = `SELECT id, news_id, emoji, ip_address, created_at 
                   FROM emoji_reactions 
                   WHERE news_id LIKE '%年%月%日%'
                   ORDER BY created_at ASC`
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('查询失败:', err.message)
        reject(err)
        return
      }
      
      console.log(`找到 ${rows.length} 条需要转换的记录`)
      
      if (rows.length === 0) {
        console.log('没有找到需要修复的记录')
        resolve()
        return
      }
      
      let processedCount = 0
      let updatedCount = 0
      let mergedCount = 0
      let deletedCount = 0
      
      rows.forEach((row, index) => {
        console.log(`\n=== 处理第 ${index + 1} 条记录 ===`)
        console.log('ID:', row.id)
        console.log('原newsId:', row.news_id)
        console.log('emoji:', row.emoji)
        console.log('ip:', row.ip_address)
        
        const oldNewsId = row.news_id
        const newNewsId = convertNewsId(oldNewsId)
        
        if (!newNewsId) {
          processedCount++
          console.log('无法转换，跳过')
          
          if (processedCount === rows.length) {
            finishProcess()
          }
          return
        }
        
        console.log('新newsId:', newNewsId)
        
        // 检查新newsId是否已经存在相同的记录
        const checkQuery = `SELECT id FROM emoji_reactions 
                           WHERE news_id = ? AND ip_address = ? AND id != ?`
        
        db.get(checkQuery, [newNewsId, row.ip_address, row.id], (checkErr, existingRow) => {
          if (checkErr) {
            console.error('检查现有记录失败:', checkErr.message)
            processedCount++
            
            if (processedCount === rows.length) {
              finishProcess()
            }
            return
          }
          
          if (existingRow) {
            // 如果已经存在相同的记录，删除旧记录
            console.log(`发现重复记录 ID:${existingRow.id}，删除旧记录`)
            
            const deleteQuery = 'DELETE FROM emoji_reactions WHERE id = ?'
            db.run(deleteQuery, [row.id], function(deleteErr) {
              processedCount++
              
              if (deleteErr) {
                console.error(`删除记录 ${row.id} 失败:`, deleteErr.message)
              } else {
                deletedCount++
                mergedCount++
                console.log(`✓ 删除重复记录 ${row.id}`)
              }
              
              if (processedCount === rows.length) {
                finishProcess()
              }
            })
          } else {
            // 如果不存在重复记录，直接更新
            const updateQuery = 'UPDATE emoji_reactions SET news_id = ? WHERE id = ?'
            db.run(updateQuery, [newNewsId, row.id], function(updateErr) {
              processedCount++
              
              if (updateErr) {
                console.error(`更新记录 ${row.id} 失败:`, updateErr.message)
              } else {
                updatedCount++
                console.log(`✓ 成功更新记录 ${row.id}`)
              }
              
              if (processedCount === rows.length) {
                finishProcess()
              }
            })
          }
        })
      })
      
      function finishProcess() {
        console.log(`\n=== 修复完成 ===`)
        console.log(`总记录数: ${rows.length}`)
        console.log(`更新记录数: ${updatedCount}`)
        console.log(`删除重复记录数: ${deletedCount}`)
        console.log(`合并记录数: ${mergedCount}`)
        resolve()
      }
    })
  })
}

// 运行修复
fixNewsIdFormat()
  .then(() => {
    console.log('\n=== 验证修复结果 ===')
    const db = getDatabase()
    
    // 检查是否还有中文格式的记录
    db.all(`SELECT news_id, COUNT(*) as count 
            FROM emoji_reactions 
            WHERE news_id LIKE '%年%月%日%'
            GROUP BY news_id`, [], (err, chineseRows) => {
      if (err) {
        console.error('查询中文格式记录失败:', err.message)
      } else {
        console.log(`剩余中文格式记录: ${chineseRows.length}`)
        chineseRows.forEach((row) => {
          console.log(`- ${row.news_id} (${row.count} 条)`)
        })
      }
      
      // 显示所有记录
      db.all('SELECT news_id, COUNT(*) as count FROM emoji_reactions GROUP BY news_id ORDER BY count DESC', [], (err, results) => {
        if (err) {
          console.error('查询修复后数据失败:', err.message)
        } else {
          console.log('\n修复后的所有数据:')
          results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.news_id} (${result.count} 反应)`)
          })
        }
        process.exit(0)
      })
    })
  })
  .catch((error) => {
    console.error('修复失败:', error)
    process.exit(1)
  })