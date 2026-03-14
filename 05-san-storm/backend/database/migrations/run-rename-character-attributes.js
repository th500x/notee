/**
 * 执行迁移：移除将领属性的 base_ 前缀
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: '05_san_storm',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('📦 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    
    console.log('📖 读取迁移脚本...');
    const sqlFile = path.join(__dirname, 'rename-character-attributes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🔄 执行迁移...');
    const [results] = await connection.query(sql);
    
    console.log('✅ 迁移执行成功！');
    console.log(results);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
