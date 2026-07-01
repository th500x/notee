const { pool } = require('../database/connection');

(async () => {
  const [p] = await pool.query(
    `SELECT COUNT(*) AS c FROM temp_card_pool_draws
     WHERE player_id = '11JQ' AND echo_choice_status = 'pending'`,
  );
  console.log('pending count:', p[0].c);
  await pool.end();
})();
