/**
 * 验证表是否创建成功
 */

const { pool } = require('../database/connection');

async function verifyTable() {
  try {
    console.log('验证表结构...');
    
    // 查询表结构
    const [rows] = await pool.query('DESCRIBE temp_character_creation');
    
    console.log('\n✅ 表 temp_character_creation 结构：');
    console.log('─'.repeat(80));
    rows.forEach(row => {
      console.log(`${row.Field.padEnd(25)} ${row.Type.padEnd(20)} ${row.Null.padEnd(5)} ${row.Key.padEnd(5)} ${row.Default || 'NULL'}`);
    });
    console.log('─'.repeat(80));
    
    console.log(`\n✅ 共 ${rows.length} 个字段`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
}

verifyTable();
