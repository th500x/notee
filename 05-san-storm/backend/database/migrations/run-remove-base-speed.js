/**
 * 删除 base_speed 字段迁移脚本
 * 执行方式: node run-remove-base-speed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

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
    console.log('🔄 开始删除 base_speed 字段...\n');
    
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    console.log('📖 读取迁移SQL文件...');
    const sqlPath = path.join(__dirname, 'remove-base-speed.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('✅ SQL文件读取成功\n');
    
    console.log('🚀 执行迁移SQL...\n');
    await connection.query(sql);
    
    console.log('✅ 迁移执行成功！\n');
    
    console.log('📋 验证 config_characters 表结构：\n');
    const [charactersDesc] = await connection.query('DESCRIBE config_characters');
    
    console.log('所有字段：');
    charactersDesc.forEach((field, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${field.Field.padEnd(30)} ${field.Type.padEnd(20)} ${field.Comment || ''}`);
    });
    
    // 检查是否还有 base_speed 字段
    const speedField = charactersDesc.find(field => field.Field === 'base_speed');
    
    if (!speedField) {
      console.log('\n✅ base_speed 字段已成功删除！');
      console.log('✅ config_characters 表现在只有7项基础属性：');
      console.log('   1. base_luck (运气)');
      console.log('   2. base_courage (勇气)');
      console.log('   3. base_combat (武力)');
      console.log('   4. base_command (统帅)');
      console.log('   5. base_intelligence (智力)');
      console.log('   6. base_politics (政治)');
      console.log('   7. base_charm (魅力)');
    } else {
      console.log('\n⚠️ 警告：base_speed 字段仍然存在！');
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

runMigration();
