const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('执行迁移：为 config_skills 添加 target_type 字段...\n');
    
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
      if (row.Field === 'target_type') {
        console.log(`✅ ${row.Field}: ${row.Type} ${row.Null}`);
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
