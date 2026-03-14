const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('执行迁移：更新技能表目标字段...\n');
    
    // 删除旧字段
    try {
      await connection.query('ALTER TABLE config_skills DROP COLUMN target_type');
      console.log('✅ 删除 target_type 字段');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠️  target_type 字段不存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 添加新字段
    try {
      await connection.query(`
        ALTER TABLE config_skills 
        ADD COLUMN target_range VARCHAR(20) COMMENT '目标范围（1x1/1x2/1x3/2x2/3x3/4x4/cross/cross_thin/cross_large）' 
        AFTER effect_value
      `);
      console.log('✅ 添加 target_range 字段');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  target_range 字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    try {
      await connection.query(`
        ALTER TABLE config_skills 
        ADD COLUMN target_count VARCHAR(20) COMMENT '目标数量（all/1/2/3/random_1/random_2/random_3）' 
        AFTER target_range
      `);
      console.log('✅ 添加 target_count 字段');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  target_count 字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_skills');
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
