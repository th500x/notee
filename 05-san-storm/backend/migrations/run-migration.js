/**
 * 执行数据库迁移脚本
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../database/connection');

async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');
    
    // 读取SQL文件
    const sqlFile = path.join(__dirname, '003_create_temp_character_creation.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 执行SQL
    await pool.query(sql);
    
    console.log('✅ 数据库迁移成功！');
    console.log('✅ 临时表 temp_character_creation 已创建');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
