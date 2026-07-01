const { pool } = require('../database/connection');

(async () => {
  const [rows] = await pool.query(
    `SELECT id, rarity, card_id, echo_choice_status, quota_weight, pity_count, drawn_at
     FROM temp_card_pool_draws
     WHERE player_id = '11JQ' AND pool_type = 'character'
     ORDER BY id DESC LIMIT 20`,
  );
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
