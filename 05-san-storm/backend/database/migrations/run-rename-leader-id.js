const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm',
    multipleStatements: true
  });

  try {
    console.log('执行迁移：重命名 leader_id → faction_leader...');
    
    const sql = `
      ALTER TABLE config_factions 
      CHANGE COLUMN leader_id faction_leader VARCHAR(50) COMMENT '势力君主ID（关联将领表）';
    `;
    
    await connection.query(sql);
    console.log('✅ 字段重命名成功');
    
    // 验证
    const [rows] = await connection.query('DESCRIBE config_factions');
    console.log('\n验证结果：');
    rows.forEach(row => {
      if (row.Field === 'faction_leader') {
        console.log(`✅ ${row.Field}: ${row.Type} ${row.Null} ${row.Key} ${row.Default || ''} ${row.Extra || ''}`);
      }
    });
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
