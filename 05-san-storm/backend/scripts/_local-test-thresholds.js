/**
 * 一次性：本地测试阈值（不写 CSV/JSON）
 * node scripts/_local-test-thresholds.js
 */
const { pool } = require('../database/connection');

const COMBAT_WIN_THRESHOLDS = [2, 4, 6, 8, 10];
const COMBAT_WIN_DESC = [
  '累计战斗胜利2场',
  '累计战斗胜利4场',
  '累计战斗胜利6场',
  '累计战斗胜利8场',
  '累计战斗胜利10场',
];

(async () => {
  const [rows] = await pool.query(
    `SELECT achievement_id, achievement_name, chain_level, unlock_conditions
     FROM config_achievements
     WHERE chain_id = 'chain_combat_win'
     ORDER BY chain_level`
  );

  if (rows.length !== 5) {
    console.error('期望 5 条 chain_combat_win，实际', rows.length);
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const threshold = COMBAT_WIN_THRESHOLDS[i];
    let cond =
      typeof row.unlock_conditions === 'string'
        ? JSON.parse(row.unlock_conditions)
        : row.unlock_conditions || {};
    cond = { ...cond, win_battles: threshold };
    await pool.query(
      `UPDATE config_achievements SET unlock_conditions = ?, unlock_conditions_desc = ? WHERE achievement_id = ?`,
      [JSON.stringify(cond), COMBAT_WIN_DESC[i], row.achievement_id]
    );
    console.log(`OK achievement ${row.achievement_name}: win_battles=${threshold}`);
  }

  const [titleRows] = await pool.query(
    `SELECT title_id, unlock_conditions FROM config_titles WHERE title_id = ?`,
    ['san_0_title_1_5002']
  );
  if (!titleRows.length) {
    console.error('未找到 san_0_title_1_5002');
    process.exit(1);
  }
  const t = titleRows[0];
  let tCond =
    typeof t.unlock_conditions === 'string'
      ? JSON.parse(t.unlock_conditions)
      : t.unlock_conditions || {};
  tCond = { ...tCond, type: 'position_tenure', position_level: 1, min_days: 1 };
  await pool.query(
    `UPDATE config_titles SET unlock_conditions = ?, unlock_conditions_desc = ? WHERE title_id = ?`,
    [JSON.stringify(tCond), '赛季中担任1阶官职≥1天', 'san_0_title_1_5002']
  );
  console.log('OK title 一人之下: min_days=1');

  const [verifyA] = await pool.query(
    `SELECT achievement_id, unlock_conditions FROM config_achievements WHERE chain_id = 'chain_combat_win' ORDER BY chain_level`
  );
  const [verifyT] = await pool.query(
    `SELECT unlock_conditions FROM config_titles WHERE title_id = 'san_0_title_1_5002'`
  );
  console.log('verify achievements:', verifyA.map((r) => r.unlock_conditions));
  console.log('verify title:', verifyT[0].unlock_conditions);
  process.exit(0);
})();
