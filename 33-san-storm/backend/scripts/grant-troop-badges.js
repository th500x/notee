/**
 * 给指定玩家叠加部队徽章（本地测试用）
 * 用法：node backend/scripts/grant-troop-badges.js [playerId] [amount]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const ITEM_ID = 'item_badge_troop';
const playerIdArg = String(process.argv[2] || '11JQ').trim();
const amount = Math.max(1, Math.floor(Number(process.argv[3]) || 10));

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
  });

  const [rows] = await c.query(
    `SELECT player_id, items FROM players
     WHERE player_id = ? OR player_id LIKE ?
     ORDER BY CASE WHEN player_id = ? THEN 0 ELSE 1 END
     LIMIT 10`,
    [playerIdArg, `%${playerIdArg}%`, playerIdArg]
  );
  if (!rows.length) {
    console.error('未找到玩家', playerIdArg);
    await c.end();
    process.exit(1);
  }
  console.log(
    '候选玩家:',
    rows.map((r) => r.player_id)
  );

  const row = rows.find((r) => r.player_id === playerIdArg) || rows[0];
  let items = {};
  if (row.items) {
    items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
  }
  const before = Number(items[ITEM_ID]) || 0;
  items[ITEM_ID] = before + amount;
  await c.query('UPDATE players SET items = ? WHERE player_id = ?', [
    JSON.stringify(items),
    row.player_id,
  ]);
  console.log(
    `OK player=${row.player_id} ${ITEM_ID}: ${before} → ${items[ITEM_ID]} (+${amount})`
  );
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
