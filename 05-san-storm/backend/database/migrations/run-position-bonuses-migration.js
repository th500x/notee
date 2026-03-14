/**
 * 官职表字段迁移：将5个独立加成字段合并为position_bonuses JSON字段
 * 
 * 迁移内容：
 * - 删除字段：resource_bonus, prestige_bonus, infantry_bonus, cavalry_bonus, archer_bonus
 * - 新增字段：position_bonuses (JSON)
 * - 数据迁移：将旧字段数据转换为JSON格式
 * 
 * 执行方式：
 * node backend/database/migrations/run-position-bonuses-migration.js
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

async function migratePositionBonuses() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    
    // 1. 检查表是否存在
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'config_positions'"
    );
    
    if (tables.length === 0) {
      console.log('⚠️  config_positions 表不存在，跳过迁移');
      return;
    }
    
    // 2. 检查旧字段是否存在
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM config_positions LIKE 'resource_bonus'"
    );
    
    if (columns.length === 0) {
      console.log('⚠️  旧字段不存在，可能已经迁移过了');
      return;
    }
    
    console.log('📊 开始迁移官职加成字段...');
    
    // 3. 读取现有数据
    const [positions] = await connection.query(
      'SELECT position_id, resource_bonus, prestige_bonus, infantry_bonus, cavalry_bonus, archer_bonus FROM config_positions'
    );
    
    console.log(`📝 找到 ${positions.length} 条官职数据`);
    
    // 4. 添加新字段
    await connection.query(`
      ALTER TABLE config_positions 
      ADD COLUMN position_bonuses JSON COMMENT '官职加成（如：{"resource": 0.5, "prestige": 0.5, "infantry": 0.15, "cavalry": 0, "archer": 0}）'
      AFTER requirement
    `);
    console.log('✅ 添加 position_bonuses 字段');
    
    // 5. 迁移数据
    for (const position of positions) {
      const bonuses = {
        resource: position.resource_bonus || 0,
        prestige: position.prestige_bonus || 0,
        infantry: position.infantry_bonus || 0,
        cavalry: position.cavalry_bonus || 0,
        archer: position.archer_bonus || 0
      };
      
      await connection.query(
        'UPDATE config_positions SET position_bonuses = ? WHERE position_id = ?',
        [JSON.stringify(bonuses), position.position_id]
      );
    }
    console.log(`✅ 迁移 ${positions.length} 条数据到 position_bonuses 字段`);
    
    // 6. 删除旧字段
    await connection.query(`
      ALTER TABLE config_positions 
      DROP COLUMN resource_bonus,
      DROP COLUMN prestige_bonus,
      DROP COLUMN infantry_bonus,
      DROP COLUMN cavalry_bonus,
      DROP COLUMN archer_bonus
    `);
    console.log('✅ 删除旧的加成字段');
    
    console.log('');
    console.log('🎉 迁移完成！');
    console.log('');
    console.log('📋 迁移摘要：');
    console.log(`   - 迁移数据：${positions.length} 条`);
    console.log('   - 新字段：position_bonuses (JSON)');
    console.log('   - 删除字段：resource_bonus, prestige_bonus, infantry_bonus, cavalry_bonus, archer_bonus');
    
  } catch (error) {
    console.error('❌ 迁移失败：', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行迁移
migratePositionBonuses();
