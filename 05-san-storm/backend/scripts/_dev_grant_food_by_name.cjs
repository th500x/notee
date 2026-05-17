/**
 * One-off: grant food to players matching name/id substring (UTF-8).
 * Usage: node scripts/_dev_grant_food_by_name.cjs 11JQ 100000
 */
const { pool, closePool } = require('../database/connection');

async function main() {
  const needle = String(process.argv[2] || '').trim();
  const add = Math.max(0, Math.floor(Number(process.argv[3]) || 0));
  if (!needle || !add) {
    console.error('Usage: node scripts/_dev_grant_food_by_name.cjs <nameOrIdSubstring> <foodDelta>');
    process.exit(1);
  }
  const like = `%${needle}%`;
  const [r] = await pool.query(
    `UPDATE players SET food = food + ? WHERE character_name LIKE ? OR player_id LIKE ?`,
    [add, like, like],
  );
  console.log('OK affectedRows=', r && r.affectedRows);
  const [rows] = await pool.query(
    `SELECT player_id, character_name, food FROM players WHERE character_name LIKE ? OR player_id LIKE ? LIMIT 10`,
    [like, like],
  );
  console.log(JSON.stringify(rows, null, 2));
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
