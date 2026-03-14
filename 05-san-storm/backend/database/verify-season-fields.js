/**
 * 验证配置表的 season 字段
 * 检查所有配置表的 season 字段是否正确填充
 */

const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4'
};

/**
 * 验证配置表的 season 字段
 */
async function verifySeasonFields() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 1. 验证势力配置表
    console.log('=== 势力配置表 (config_factions) ===');
    const [factions] = await connection.query(`
      SELECT faction_id, season, faction_name 
      FROM config_factions 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(factions);
    
    const [factionStats] = await connection.query(`
      SELECT season, COUNT(*) as count 
      FROM config_factions 
      GROUP BY season
    `);
    console.log('赛季分布：');
    console.table(factionStats);
    console.log('');
    
    // 2. 验证将领配置表
    console.log('=== 将领配置表 (config_characters) ===');
    const [characters] = await connection.query(`
      SELECT character_id, season, character_name, rarity 
      FROM config_characters 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(characters);
    
    const [characterStats] = await connection.query(`
      SELECT season, COUNT(*) as count 
      FROM config_characters 
      GROUP BY season
    `);
    console.log('赛季分布：');
    console.table(characterStats);
    console.log('');
    
    // 3. 验证部队配置表
    console.log('=== 部队配置表 (config_troops) ===');
    const [troops] = await connection.query(`
      SELECT troop_id, season, troop_name, rarity 
      FROM config_troops 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(troops);
    
    const [troopStats] = await connection.query(`
      SELECT season, COUNT(*) as count 
      FROM config_troops 
      GROUP BY season
    `);
    console.log('赛季分布：');
    console.table(troopStats);
    console.log('');
    
    // 4. 验证官职配置表
    console.log('=== 官职配置表 (config_positions) ===');
    const [positions] = await connection.query(`
      SELECT position_id, season, position_name, position_level 
      FROM config_positions 
      LIMIT 5
    `);
    console.log('示例数据：');
    console.table(positions);
    
    const [positionStats] = await connection.query(`
      SELECT season, COUNT(*) as count 
      FROM config_positions 
      GROUP BY season
    `);
    console.log('赛季分布：');
    console.table(positionStats);
    console.log('');
    
    // 5. 检查是否有空的 season 字段
    console.log('=== 检查空 season 字段 ===');
    
    const [emptySeasonChars] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM config_characters 
      WHERE season IS NULL OR season = ''
    `);
    console.log(`将领配置表空 season 字段: ${emptySeasonChars[0].count}`);
    
    const [emptySeasonTroops] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM config_troops 
      WHERE season IS NULL OR season = ''
    `);
    console.log(`部队配置表空 season 字段: ${emptySeasonTroops[0].count}`);
    
    const [emptySeasonPositions] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM config_positions 
      WHERE season IS NULL OR season = ''
    `);
    console.log(`官职配置表空 season 字段: ${emptySeasonPositions[0].count}`);
    
    const [emptySeasonFactions] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM config_factions 
      WHERE season IS NULL OR season = ''
    `);
    console.log(`势力配置表空 season 字段: ${emptySeasonFactions[0].count}`);
    console.log('');
    
    // 6. 总结
    console.log('=== 验证总结 ===');
    const totalEmpty = 
      emptySeasonChars[0].count + 
      emptySeasonTroops[0].count + 
      emptySeasonPositions[0].count + 
      emptySeasonFactions[0].count;
    
    if (totalEmpty === 0) {
      console.log('✅ 所有配置表的 season 字段都已正确填充！');
    } else {
      console.log(`⚠️ 发现 ${totalEmpty} 条记录的 season 字段为空，请检查！`);
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行验证
verifySeasonFields();

