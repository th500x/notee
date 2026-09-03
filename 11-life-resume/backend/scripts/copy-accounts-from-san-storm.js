/**
 * 一次性：把 05_san_storm.accounts 拷进 11_life_resume.accounts（INSERT IGNORE，不改源表）。
 * 须能 SELECT 源库、INSERT 目标库（本地 root 即可；生产可用 root 跑一次）。
 *
 *   node scripts/copy-accounts-from-san-storm.js
 */

const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override: true });
}

const destDb = String(process.env.DB_NAME || '11_life_resume').trim();
const sourceDb = String(process.env.COPY_ACCOUNTS_SOURCE_DB || '05_san_storm').trim();

async function main() {
  if (sourceDb === destDb) {
    throw new Error('源库与目标库不能相同');
  }

  const conn = await mysql.createConnection({
    host: process.env.COPY_ACCOUNTS_SOURCE_HOST || process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.COPY_ACCOUNTS_SOURCE_PORT || process.env.DB_PORT || '3306', 10),
    user: process.env.COPY_ACCOUNTS_SOURCE_USER || process.env.DB_USER || 'root',
    password:
      process.env.COPY_ACCOUNTS_SOURCE_PASSWORD !== undefined
        ? process.env.COPY_ACCOUNTS_SOURCE_PASSWORD
        : (process.env.DB_PASSWORD || ''),
    charset: 'utf8mb4',
    multipleStatements: false,
  });

  try {
    const [srcOk] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'accounts'`,
      [sourceDb]
    );
    if (!srcOk[0] || Number(srcOk[0].n) < 1) {
      throw new Error(`源库 ${sourceDb}.accounts 不存在`);
    }

    const [dstOk] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'accounts'`,
      [destDb]
    );
    if (!dstOk[0] || Number(dstOk[0].n) < 1) {
      throw new Error(`目标库 ${destDb}.accounts 不存在（请先 npm run db:migrate）`);
    }

    const [before] = await conn.query(`SELECT COUNT(*) AS n FROM \`${destDb}\`.accounts`);
    const [result] = await conn.query(
      `INSERT IGNORE INTO \`${destDb}\`.accounts SELECT * FROM \`${sourceDb}\`.accounts`
    );
    const [after] = await conn.query(`SELECT COUNT(*) AS n FROM \`${destDb}\`.accounts`);
    const [srcCount] = await conn.query(`SELECT COUNT(*) AS n FROM \`${sourceDb}\`.accounts`);

    console.log(`[copy-accounts] source ${sourceDb}: ${srcCount[0].n}`);
    console.log(`[copy-accounts] dest ${destDb}: ${before[0].n} -> ${after[0].n}`);
    console.log(`[copy-accounts] inserted ${result.affectedRows} (ignored existing)`);
    console.log('[copy-accounts] source table left unchanged');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('[copy-accounts] failed:', err.message);
  process.exit(1);
});
