require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../database/connection');

async function checkTable() {
  try {
    const [columns] = await pool.query("DESCRIBE config_skills");
    console.log('config_skills 表结构:');
    console.table(columns);
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkTable();
