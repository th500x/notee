const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm',
    multipleStatements: true
  });

  try {
    console.log('执行迁移：更新装备表属性字段...\n');
    
    // 删除旧字段
    console.log('删除旧的部队属性字段...');
    const oldFields = ['attack_bonus', 'defense_bonus', 'speed_bonus'];
    for (const field of oldFields) {
      try {
        await connection.query(`ALTER TABLE config_equipment DROP COLUMN ${field}`);
        console.log(`✅ 删除 ${field}`);
      } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          console.log(`⚠️  ${field} 不存在，跳过`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n添加将领7项属性加成字段...');
    const newFields = [
      { name: 'luck_bonus', sql: 'ADD COLUMN luck_bonus INT DEFAULT 0 COMMENT \'运气加成×10\' AFTER rarity' },
      { name: 'courage_bonus', sql: 'ADD COLUMN courage_bonus INT DEFAULT 0 COMMENT \'勇气加成×10\' AFTER luck_bonus' },
      { name: 'combat_bonus', sql: 'ADD COLUMN combat_bonus INT DEFAULT 0 COMMENT \'武力加成×10\' AFTER courage_bonus' },
      { name: 'command_bonus', sql: 'ADD COLUMN command_bonus INT DEFAULT 0 COMMENT \'统帅加成×10\' AFTER combat_bonus' },
      { name: 'intelligence_bonus', sql: 'ADD COLUMN intelligence_bonus INT DEFAULT 0 COMMENT \'智力加成×10\' AFTER command_bonus' },
      { name: 'politics_bonus', sql: 'ADD COLUMN politics_bonus INT DEFAULT 0 COMMENT \'政治加成×10\' AFTER intelligence_bonus' },
      { name: 'charm_bonus', sql: 'ADD COLUMN charm_bonus INT DEFAULT 0 COMMENT \'魅力加成×10\' AFTER politics_bonus' }
    ];
    
    for (const field of newFields) {
      try {
        await connection.query(`ALTER TABLE config_equipment ${field.sql}`);
        console.log(`✅ 添加 ${field.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  ${field.name} 已存在，跳过`);
        } else {
          throw error;
        }
      }
    }
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_equipment');
    console.log('\n验证结果：');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Null} ${row.Key || ''} ${row.Default || ''}`);
    });
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
