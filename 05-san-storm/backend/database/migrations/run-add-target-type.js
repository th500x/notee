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
    console.log('执行迁移：为 config_skills 添加 target_type 和 troop_type 字段...\n');
    
    // 添加 troop_type 字段
    await connection.query(`
      ALTER TABLE config_skills 
      ADD COLUMN troop_type VARCHAR(100) COMMENT '兵种类型限制（如：infantry;cavalry;archer，留空表示通用）' 
      AFTER character_type
    `);
    console.log('✅ troop_type 字段添加成功');
    
    // 添加 target_type 字段
    await connection.query(`
      ALTER TABLE config_skills 
      ADD COLUMN target_type VARCHAR(50) COMMENT '目标类型（single/cross/square/line_horizontal/self/ally_single/ally_area/random_enemies/area_3x3）' 
      AFTER effect_value
    `);
    console.log('✅ target_type 字段添加成功');
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_skills');
    console.log('\n验证结果：');
    rows.forEach(row => {
      if (row.Field === 'troop_type' || row.Field === 'target_type') {
        console.log(`✅ ${row.Field}: ${row.Type} ${row.Null} ${row.Key || ''} ${row.Default || ''} ${row.Extra || ''}`);
      }
    });
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  字段已存在，跳过迁移');
    } else {
      console.error('❌ 迁移失败:', error.message);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

runMigration();
