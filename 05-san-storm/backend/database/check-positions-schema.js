const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('检查 config_positions 表结构...\n');
    
    const [rows] = await connection.query('DESCRIBE config_positions');
    
    console.log('字段列表：');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Null} ${row.Key || ''} ${row.Default || ''}`);
    });
    
    // 检查是否有 requirement
    const hasRequirement = rows.some(r => r.Field === 'requirement');
    const hasReputationRequired = rows.some(r => r.Field === 'reputation_required');
    
    console.log('\n字段检查：');
    console.log(`  requirement: ${hasRequirement ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  reputation_required: ${hasReputationRequired ? '⚠️  仍然存在（需要迁移）' : '✅ 已移除'}`);
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
