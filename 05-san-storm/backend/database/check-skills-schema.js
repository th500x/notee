const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('检查 config_skills 表结构...\n');
    
    const [rows] = await connection.query('DESCRIBE config_skills');
    
    console.log('字段列表：');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Null} ${row.Key || ''} ${row.Default || ''}`);
    });
    
    // 检查是否有 target_type 和 troop_type
    const hasTargetType = rows.some(r => r.Field === 'target_type');
    const hasTroopType = rows.some(r => r.Field === 'troop_type');
    
    console.log('\n字段检查：');
    console.log(`  target_type: ${hasTargetType ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  troop_type: ${hasTroopType ? '✅ 存在' : '❌ 不存在'}`);
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
