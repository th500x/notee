/**
 * 检查玩家数据
 */

const { pool } = require('./database/connection');

async function checkPlayer() {
  try {
    const playerId = process.argv[2] || '04MM';
    
    console.log(`查询玩家 ${playerId} 的数据...\n`);
    
    // 1. 检查玩家基础数据
    const [players] = await pool.query(
      'SELECT * FROM players WHERE player_id = ?',
      [playerId]
    );
    
    if (players.length === 0) {
      console.log('❌ 没有找到玩家数据');
      console.log('   玩家可能还没有完成角色创建');
    } else {
      const player = players[0];
      console.log('✅ 找到玩家数据：');
      console.log('─'.repeat(80));
      console.log(`玩家ID: ${player.player_id}`);
      console.log(`角色名: ${player.character_name}`);
      console.log(`势力: ${player.faction_name} (${player.faction_id})`);
      console.log(`银两: ${player.silver}`);
      console.log(`粮草: ${player.food}`);
      console.log(`属性（×10存储）:`);
      console.log(`  武力: ${player.combat} (显示: ${player.combat/10})`);
      console.log(`  智力: ${player.intelligence} (显示: ${player.intelligence/10})`);
      console.log(`  统帅: ${player.command} (显示: ${player.command/10})`);
      console.log(`  政治: ${player.politics} (显示: ${player.politics/10})`);
      console.log(`  魅力: ${player.charm} (显示: ${player.charm/10})`);
      console.log(`  勇气: ${player.courage} (显示: ${player.courage/10})`);
      console.log(`  运气: ${player.luck} (显示: ${player.luck/10})`);
      console.log(`创建时间: ${player.created_at}`);
      console.log('─'.repeat(80));
      
      // 2. 检查玩家卡牌
      const [cards] = await pool.query(
        'SELECT * FROM player_cards WHERE player_id = ?',
        [playerId]
      );
      
      console.log(`\n✅ 玩家卡牌数量: ${cards.length}`);
      if (cards.length > 0) {
        console.log('─'.repeat(80));
        cards.forEach(card => {
          console.log(`卡牌类型: ${card.card_type}`);
          console.log(`卡牌ID: ${card.card_id}`);
          console.log(`稀有度: ${card.rarity}`);
          if (card.card_type === 'troop') {
            console.log(`当前兵力: ${card.current_troops}`);
            console.log(`已使用次数: ${card.battle_count}/${card.max_battle_count}`);
          }
          console.log(`获得时间: ${card.obtained_at}`);
          console.log('─'.repeat(40));
        });
      }
    }
    
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

checkPlayer();
