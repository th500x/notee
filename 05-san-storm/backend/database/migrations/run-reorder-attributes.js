/**
 * 属性字段顺序调整迁移脚本
 * 执行方式: node run-reorder-attributes.js
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
    console.log('🔄 开始执行属性字段顺序调整迁移...\n');
    
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    // 读取SQL文件
    console.log('📖 读取迁移SQL文件...');
    const sqlPath = path.join(__dirname, 'reorder-attributes.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('✅ SQL文件读取成功\n');
    
    // 执行SQL
    console.log('🚀 执行迁移SQL...\n');
    const [results] = await connection.query(sql);
    
    // 显示结果
    console.log('✅ 迁移执行成功！\n');
    
    // 验证 players 表结构
    console.log('📋 验证 players 表结构：');
    const [playersDesc] = await connection.query('DESCRIBE players');
    
    console.log('\n属性字段顺序：');
    const attributeFields = playersDesc.filter(field => 
      ['luck', 'courage', 'combat', 'command', 'intelligence', 'politics', 'charm',
       'base_luck', 'base_courage', 'base_combat', 'base_command', 'base_intelligence', 'base_politics', 'base_charm']
      .includes(field.Field)
    );
    
    attributeFields.forEach((field, index) => {
      console.log(`  ${index + 1}. ${field.Field.padEnd(20)} - ${field.Comment}`);
    });
    
    // 验证 config_characters 表结构
    console.log('\n📋 验证 config_characters 表结构：');
    const [charactersDesc] = await connection.query('DESCRIBE config_characters');
    
    console.log('\n属性字段顺序：');
    const charAttributeFields = charactersDesc.filter(field => 
      ['base_luck', 'base_courage', 'base_combat', 'base_command', 'base_intelligence', 'base_politics', 'base_charm']
      .includes(field.Field)
    );
    
    charAttributeFields.forEach((field, index) => {
      console.log(`  ${index + 1}. ${field.Field.padEnd(25)} - ${field.Comment}`);
    });
    
    console.log('\n✅ 所有属性字段顺序已统一为：运气、勇气、武力、统帅、智力、政治、魅力');
    console.log('✅ 迁移完成！');
    
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
