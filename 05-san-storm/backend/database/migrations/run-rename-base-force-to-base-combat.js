/**
 * 重命名 base_force 为 base_combat 迁移脚本
 * 执行方式: node run-rename-base-force-to-base-combat.js
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
    console.log('🔄 开始重命名 base_force 为 base_combat...\n');
    
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');
    
    console.log('📖 读取迁移SQL文件...');
    const sqlPath = path.join(__dirname, 'rename-base-force-to-base-combat.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('✅ SQL文件读取成功\n');
    
    console.log('🚀 执行迁移SQL...\n');
    await connection.query(sql);
    
    console.log('✅ 迁移执行成功！\n');
    
    console.log('📋 验证 config_characters 表结构：\n');
    const [charactersDesc] = await connection.query('DESCRIBE config_characters');
    
    console.log('属性字段：');
    const attributeFields = charactersDesc.filter(field => 
      field.Field.startsWith('base_')
    );
    
    attributeFields.forEach((field, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${field.Field.padEnd(30)} ${field.Type.padEnd(20)} ${field.Comment || ''}`);
    });
    
    // 检查是否成功重命名
    const hasCombat = attributeFields.find(field => field.Field === 'base_combat');
    const hasForce = attributeFields.find(field => field.Field === 'base_force');
    
    if (hasCombat && !hasForce) {
      console.log('\n✅ base_force 已成功重命名为 base_combat！');
      console.log('✅ 字段命名现在与 players 表和前端代码保持一致');
    } else if (hasForce) {
      console.log('\n⚠️ 警告：base_force 字段仍然存在！');
    } else {
      console.log('\n⚠️ 警告：未找到 base_combat 字段！');
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
