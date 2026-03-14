/**
 * 执行trait_modifier字段迁移
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  charset: 'utf8mb4',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取迁移脚本
    const migrationPath = path.join(__dirname, 'migrations/add-trait-modifier-field.sql');
    console.log(`读取迁移脚本: ${migrationPath}`);
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    console.log('执行迁移脚本...\n');
    
    // 执行SQL语句
    await connection.query(sql);
    
    console.log('✅ 迁移脚本执行成功！\n');
    
    // 验证新字段
    console.log('验证将领表结构...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '05_san_storm' 
        AND TABLE_NAME = 'config_characters'
        AND COLUMN_NAME = 'trait_modifier'
    `);
    
    if (columns.length > 0) {
      console.log('新增字段：');
      columns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}): ${col.COLUMN_COMMENT}`);
      });
    } else {
      console.log('⚠️ 未找到 trait_modifier 字段');
    }
    
    console.log('\n🎉 trait_modifier字段迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
