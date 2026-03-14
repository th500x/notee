const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('执行迁移：重命名 reputation_required → requirement...\n');
    
    await connection.query(`
      ALTER TABLE config_positions 
      CHANGE COLUMN reputation_required requirement INT NOT NULL COMMENT '所需声望'
    `);
    console.log('✅ 字段重命名成功');
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_positions');
    console.log('\n验证结果：');
    rows.forEach(row => {
      if (row.Field === 'requirement') {
        console.log(`✅ ${row.Field}: ${row.Type} ${row.Null}`);
      }
    });
    
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.log('⚠️  字段 reputation_required 不存在，可能已经重命名');
    } else {
      console.error('❌ 迁移失败:', error.message);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

runMigration();
