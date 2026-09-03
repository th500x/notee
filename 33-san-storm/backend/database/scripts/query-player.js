/**
 * 查询玩家数据
 */

const { pool } = require('../connection');

async function queryPlayer(playerId) {
  try {
    // 查询玩家基础信息
    const [players] = await pool.query(`
      SELECT 
        player_id,
        character_name,
        faction_id,
        faction_name,
        silver,
        food,
        reputation,
        contribution,
        combat,
        intelligence,
        command,
        politics,
        charm,
        courage,
        luck
      FROM players 
      WHERE player_id = ?
    `, [playerId]);

    if (players.length === 0) {
      console.log(`❌ 玩家 ${playerId} 不存在`);
      return;
    }

    const player = players[0];
    console.log('\n========== 玩家基础信息 ==========');
    console.log(`玩家ID: ${player.player_id}`);
    console.log(`角色名: ${player.character_name}`);
    console.log(`势力: ${player.faction_name} (${player.faction_id})`);
    console.log(`\n资源:`);
    console.log(`  银两: ${player.silver}`);
    console.log(`  粮草: ${player.food}`);
    console.log(`  声望: ${player.reputation}`);
    console.log(`  贡献: ${player.contribution}`);
    console.log(`\n属性 (×10):`);
    console.log(`  武力: ${player.combat} (显示: ${player.combat / 10})`);
    console.log(`  智力: ${player.intelligence} (显示: ${player.intelligence / 10})`);
    console.log(`  统帅: ${player.command} (显示: ${player.command / 10})`);
    console.log(`  政治: ${player.politics} (显示: ${player.politics / 10})`);
    console.log(`  魅力: ${player.charm} (显示: ${player.charm / 10})`);
    console.log(`  勇气: ${player.courage} (显示: ${player.courage / 10})`);
    console.log(`  运气: ${player.luck} (显示: ${player.luck / 10})`);

    // 查询玩家卡牌（部队、将领、装备等）
    const [cards] = await pool.query(`
      SELECT 
        instance_id,
        card_type,
        card_id,
        rarity,
        current_troops,
        battle_count,
        max_battle_count,
        is_equipped,
        equipped_by,
        equipped_slot
      FROM player_cards 
      WHERE player_id = ?
      ORDER BY card_type, obtained_at
    `, [playerId]);

    console.log(`\n========== 玩家卡牌 (${cards.length}张) ==========`);
    
    const troopCards = cards.filter(c => c.card_type === 'troop');
    const characterCards = cards.filter(c => c.card_type === 'character');
    const equipmentCards = cards.filter(c => c.card_type === 'equipment');
    
    if (troopCards.length > 0) {
      console.log(`\n部队卡 (${troopCards.length}张):`);
      troopCards.forEach(card => {
        console.log(`  - ${card.instance_id}`);
        console.log(`    卡牌ID: ${card.card_id}`);
        console.log(`    稀有度: ${card.rarity}`);
        console.log(`    当前兵力: ${card.current_troops}`);
        console.log(`    使用次数: ${card.battle_count}/${card.max_battle_count}`);
        console.log(`    装备状态: ${card.is_equipped ? `已装备 (${card.equipped_by} - ${card.equipped_slot})` : '未装备'}`);
      });
    }
    
    if (characterCards.length > 0) {
      console.log(`\n将领卡 (${characterCards.length}张):`);
      characterCards.forEach(card => {
        console.log(`  - ${card.instance_id}`);
        console.log(`    卡牌ID: ${card.card_id}`);
        console.log(`    稀有度: ${card.rarity}`);
        console.log(`    装备状态: ${card.is_equipped ? `已装备 (${card.equipped_by} - ${card.equipped_slot})` : '未装备'}`);
      });
    }
    
    if (equipmentCards.length > 0) {
      console.log(`\n装备卡 (${equipmentCards.length}张):`);
      equipmentCards.forEach(card => {
        console.log(`  - ${card.instance_id}`);
        console.log(`    卡牌ID: ${card.card_id}`);
        console.log(`    稀有度: ${card.rarity}`);
        console.log(`    装备状态: ${card.is_equipped ? `已装备 (${card.equipped_by})` : '未装备'}`);
      });
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    process.exit(0);
  }
}

// 从命令行参数获取玩家ID
const playerId = process.argv[2];

if (!playerId) {
  console.log('用法: node query-player.js <玩家ID>');
  console.log('示例: node query-player.js 07I2');
  process.exit(1);
}

queryPlayer(playerId);
