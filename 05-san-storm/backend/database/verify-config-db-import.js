/**
 * import-all 完成后：核对关键 config 表行数，避免「JSON 有、库无」的双机开发漏导入。
 *
 * 用法：node database/verify-config-db-import.js
 * 由 import-all.js 在全部子脚本成功后自动调用。
 */

const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
};

/** @type {Array<{ label: string, sql: string, params?: unknown[], min: number }>} */
const CHECKS = [
  {
    label: '将领 · san_1（黄巾之乱）',
    sql: "SELECT COUNT(*) AS c FROM config_characters WHERE season = 'san_1'",
    min: 50,
  },
  {
    label: '将领 · san_0（楚汉争霸 · 招贤池）',
    sql: "SELECT COUNT(*) AS c FROM config_characters WHERE season = 'san_0'",
    min: 1,
  },
  {
    label: '部队 · san_1',
    sql: "SELECT COUNT(*) AS c FROM config_troops WHERE season = 'san_1'",
    min: 20,
  },
  {
    label: '势力 config_factions',
    sql: 'SELECT COUNT(*) AS c FROM config_factions',
    min: 1,
  },
  {
    label: '成就 config_achievements',
    sql: 'SELECT COUNT(*) AS c FROM config_achievements',
    min: 1,
  },
];

async function verifyConfigDbImport() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
  } catch (err) {
    throw new Error(`无法连接 MySQL（${dbConfig.database}）：${err.message}`);
  }

  const failures = [];
  console.log('🔍 导入后库内抽检…');
  try {
    for (const chk of CHECKS) {
      const [rows] = await conn.query(chk.sql, chk.params || []);
      const count = Number(rows[0]?.c ?? 0);
      const ok = count >= chk.min;
      console.log(`  ${ok ? '✓' : '✗'} ${chk.label}: ${count}（期望 ≥ ${chk.min}）`);
      if (!ok) failures.push(`${chk.label} 仅 ${count} 条`);
    }
  } finally {
    await conn.end();
  }

  if (failures.length > 0) {
    throw new Error(
      `配置库抽检未通过：${failures.join('；')}。请在 backend 目录执行 node database/import-all.js`,
    );
  }
  console.log('');
}

module.exports = { verifyConfigDbImport };

if (require.main === module) {
  verifyConfigDbImport()
    .then(() => {
      console.log('✅ 配置库抽检通过');
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
}
