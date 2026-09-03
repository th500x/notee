/**
 * 检查玩家创建进度
 */

const { pool } = require('./database/connection');

async function checkProgress() {
  try {
    const playerId = process.argv[2] || '0820';
    
    console.log(`查询玩家 ${playerId} 的创建进度...\n`);
    
    const [rows] = await pool.query(
      'SELECT * FROM temp_character_creation WHERE player_id = ?',
      [playerId]
    );
    
    if (rows.length === 0) {
      console.log('❌ 没有找到创建进度记录');
      console.log('   可能原因：');
      console.log('   1. 玩家还没有开始创建角色');
      console.log('   2. 前端没有调用保存API');
      console.log('   3. API调用失败');
    } else {
      const progress = rows[0];
      console.log('✅ 找到创建进度记录：');
      console.log('─'.repeat(80));
      console.log(`玩家ID: ${progress.player_id}`);
      console.log(`当前步骤: ${progress.current_step}`);
      console.log(`选择的势力: ${progress.selected_faction_name} (${progress.selected_faction_id})`);
      console.log(`角色名: ${progress.character_name || '未设置'}`);
      console.log(`剩余银两: ${progress.remaining_silver}`);
      console.log(`随机成本: ${progress.random_cost}`);
      console.log(`当前批次: ${progress.current_batch}`);
      
      if (progress.random_batches) {
        const batches = JSON.parse(progress.random_batches);
        console.log(`批次数量: ${batches.length}`);
        batches.forEach((batch, index) => {
          console.log(`  批次${batch.batch}: ${batch.options.length}个方案, 花费${batch.cost}银两`);
        });
      } else {
        console.log(`批次数量: 0`);
      }
      
      console.log(`选中的方案: 批次${progress.selected_option_batch}, 索引${progress.selected_option_index}`);
      console.log(`创建时间: ${progress.created_at}`);
      console.log(`更新时间: ${progress.updated_at}`);
      console.log(`过期时间: ${progress.expires_at || '未设置'}`);
      console.log('─'.repeat(80));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

checkProgress();
