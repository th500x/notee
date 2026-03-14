/**
 * 删除成长属性字段迁移脚本
 * 执行方式: node run-remove-growth-attributes.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库配置（从环境变量读取）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 开始删除成长属性字段...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取SQL文件
    console.log('📖 读取迁移SQL文件...');
    const sqlPath = path.join(__dirname, 'remove-growth-attributes.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('✅ SQL文件读取成功\n');
    
    // 执行SQL
    console.log('🚀 执行迁移SQL...\n');
    await connection.query(sql);
    
    // 显示结果
    console.log('✅ 迁移执行成功！\n');
    
    // 验证 config_characters 表结构
    console.log('📋 验证 config_characters 表结构：\n');
    const [charactersDesc] = await connection.query('DESCRIBE config_characters');
    
    console.log('所有字段：');
    charactersDesc.forEach((field, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${field.Field.padEnd(30)} ${field.Type.padEnd(20)} ${field.Comment || ''}`);
    });
    
    // 检查是否还有 growth_ 字段
    const growthFields = charactersDesc.filter(field => field.Field.startsWith('growth_'));
    
    if (growthFields.length === 0) {
      console.log('\n✅ 所有成长属性字段已成功删除！');
    } else {
      console.log('\n⚠️ 警告：仍然存在以下成长属性字段：');
      growthFields.forEach(field => {
        console.log(`  - ${field.Field}`);
      });
    }
    
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败：', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📡 数据库连接已关闭');
    }
  }
}

// 执行迁移
runMigration();
