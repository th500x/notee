/**
 * 执行玩家角色表战斗字段迁移
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: '05_san_storm',
      multipleStatements: true
    });
    console.log('✅ 数据库连接成功\n');

    // 读取迁移SQL文件
    const sqlPath = path.join(__dirname, 'migrations', 'add-player-combat-fields.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // 执行迁移
    console.log('执行迁移脚本...');
    const [results] = await connection.query(sql);
    
    // 显示验证结果
    if (Array.isArray(results) && results.length > 0) {
      const lastResult = results[results.length - 1];
      if (Array.isArray(lastResult) && lastResult.length > 0) {
        console.log('\n✅ 字段添加成功！\n');
        console.log('新增字段：');
        lastResult.forEach(row => {
          console.log(`  - ${row.COLUMN_NAME} (${row.COLUMN_TYPE}): ${row.COLUMN_COMMENT}`);
        });
      }
    }
    
    console.log('\n🎉 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

runMigration();
