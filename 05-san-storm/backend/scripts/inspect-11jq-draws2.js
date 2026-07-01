const { pool } = require('../database/connection');

(async () => {
  const [p] = await pool.query(
    `SELECT id, card_id, echo_choice_status, quota_weight, pity_count, drawn_at
     FROM temp_card_pool_draws WHERE player_id = '11JQ' AND id >= 3248 ORDER BY id`,
  );
  console.log('rows:', p);
  const [pend] = await pool.query(
    `SELECT id, card_id, echo_choice_status FROM temp_card_pool_draws
     WHERE player_id = '11JQ' AND echo_choice_status = 'pending'`,
  );
  console.log('pending:', pend);
  await pool.end();
})();
