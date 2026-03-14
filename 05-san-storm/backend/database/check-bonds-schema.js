const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: '05_san_storm'
  });

  try {
    console.log('检查 config_bonds 表结构...\n');
    
    const [rows] = await connection.query('DESCRIBE config_bonds');
    
    console.log('字段列表：');
    rows.forEach(row => {
      console.log(`  ${row.Field}: ${row.Type} ${row.Null} ${row.Key || ''} ${row.Default || ''}`);
    });
    
    // 检查是否有 effect_value
    const hasEffectValue = rows.some(r => r.Field === 'effect_value');
    
    console.log('\n字段检查：');
    console.log(`  effect_value: ${hasEffectValue ? '✅ 存在' : '❌ 不存在'}`);
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema();
