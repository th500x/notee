/**
 * 本地库：city_type gate→city_gate；14 城 city_id 去数字段；再可跑 import-city-geo-data
 *   node backend/scripts/migrate-city-id-and-city-gate-db.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ID_MAP = [
  ['san_1_city_2_yangdi', 'san_1_city_yangdi'],
  ['san_1_city_3_changshe', 'san_1_city_changshe'],
  ['san_1_city_2_xuchang', 'san_1_city_xuchang'],
  ['san_1_city_3_kunyang', 'san_1_city_kunyang'],
  ['san_1_city_4_huanyuanguan', 'san_1_city_huanyuanguan'],
  ['san_1_city_4_donglingguan', 'san_1_city_donglingguan'],
  ['san_1_city_4_guangchengguan', 'san_1_city_guangchengguan'],
  ['san_1_city_3_shaoling', 'san_1_city_shaoling'],
  ['san_1_city_2_ruyang', 'san_1_city_ruyang'],
  ['san_1_city_2_pingyu', 'san_1_city_pingyu'],
  ['san_1_city_3_shangcai', 'san_1_city_shangcai'],
  ['san_1_city_1_runan', 'san_1_city_runan'],
  ['san_1_city_3_xinxi', 'san_1_city_xinxi'],
  ['san_1_city_4_wushengguan', 'san_1_city_wushengguan'],
];

/** [table, column] — 先子表后 cities */
const REF_COLS = [
  ['wars', 'target_city_id'],
  ['wars_pvp', 'target_city_id'],
  ['players', 'main_city_id'],
  ['players', 'on_duty_city_id'],
  ['player_garrison', 'city_id'],
  ['player_lineup_sets', 'city_id'],
  ['factions', 'initial_city_id'],
  ['config_factions', 'initial_city_id'],
  ['faction_bulletins', 'target_city_id'],
  ['city_siege_state', 'city_id'],
  ['cities', 'city_id'],
];

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table],
  );
  return rows.length > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    console.log('1) ENUM 收窄（无 gate/fort）+ gate→city_gate …');
    await conn.query(`UPDATE cities SET city_type = 'city_gate' WHERE city_type = 'gate'`);
    const [del] = await conn.query(`DELETE FROM cities WHERE city_type = 'fort'`);
    console.log('   deleted fort rows:', del.affectedRows);
    await conn.query(`
      ALTER TABLE cities
        MODIFY COLUMN city_type ENUM(
          'city_major','city_medium','city_small','city_gate'
        ) NOT NULL COMMENT '城市类型（关隘=city_gate；无 fort/gate）';
    `);

    console.log('2) 重命名 city_id …');
    for (const [from, to] of ID_MAP) {
      for (const [table, col] of REF_COLS) {
        if (!(await tableExists(conn, table))) continue;
        if (!(await columnExists(conn, table, col))) continue;
        if (table === 'cities' && col === 'city_id') {
          const [existNew] = await conn.query(`SELECT 1 FROM cities WHERE city_id = ? LIMIT 1`, [to]);
          const [existOld] = await conn.query(`SELECT 1 FROM cities WHERE city_id = ? LIMIT 1`, [from]);
          if (!existOld.length) continue;
          if (existNew.length) {
            console.warn(`   skip cities PK ${from}→${to}: target already exists`);
            continue;
          }
        }
        const [r] = await conn.query(`UPDATE \`${table}\` SET \`${col}\` = ? WHERE \`${col}\` = ?`, [to, from]);
        if (r.affectedRows) {
          console.log(`   ${table}.${col}: ${from} → ${to} (${r.affectedRows})`);
        }
      }
    }

    const [sample] = await conn.query(
      `SELECT city_id, city_type FROM cities
       WHERE city_id IN ('san_1_city_yangdi','san_1_city_huanyuanguan','san_1_city_runan')
       ORDER BY city_id`,
    );
    console.log('3) sample rows:', sample);
    console.log('done. Next: node backend/database/import-city-geo-data.js');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
