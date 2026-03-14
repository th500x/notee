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
    console.log('执行迁移：为 config_positions 添加缺失字段...\n');
    
    const fields = [
      { name: 'position_rank', sql: 'ADD COLUMN position_rank INT NOT NULL DEFAULT 0 COMMENT \'官职排名（用于排序）\' AFTER position_level' },
      { name: 'icon', sql: 'ADD COLUMN icon VARCHAR(10) COMMENT \'官职图标（emoji）\' AFTER category' },
      { name: 'color', sql: 'ADD COLUMN color VARCHAR(20) COMMENT \'官职颜色（hex）\' AFTER icon' },
      { name: 'description', sql: 'ADD COLUMN description TEXT COMMENT \'官职描述\' AFTER color' },
      { name: 'resource_bonus', sql: 'ADD COLUMN resource_bonus DECIMAL(5,2) DEFAULT 0 COMMENT \'资源加成\' AFTER requirement' },
      { name: 'prestige_bonus', sql: 'ADD COLUMN prestige_bonus DECIMAL(5,2) DEFAULT 0 COMMENT \'声望加成\' AFTER resource_bonus' },
      { name: 'infantry_bonus', sql: 'ADD COLUMN infantry_bonus DECIMAL(5,2) DEFAULT 0 COMMENT \'步兵加成\' AFTER prestige_bonus' },
      { name: 'cavalry_bonus', sql: 'ADD COLUMN cavalry_bonus DECIMAL(5,2) DEFAULT 0 COMMENT \'骑兵加成\' AFTER infantry_bonus' },
      { name: 'archer_bonus', sql: 'ADD COLUMN archer_bonus DECIMAL(5,2) DEFAULT 0 COMMENT \'弓兵加成\' AFTER cavalry_bonus' }
    ];
    
    for (const field of fields) {
      try {
        await connection.query(`ALTER TABLE config_positions ${field.sql}`);
        console.log(`✅ ${field.name} 字段添加成功`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  ${field.name} 字段已存在，跳过`);
        } else {
          throw error;
        }
      }
    }
    
    // 添加索引
    try {
      await connection.query('ALTER TABLE config_positions ADD INDEX idx_rank (position_rank)');
      console.log('✅ idx_rank 索引添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  idx_rank 索引已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_positions');
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
