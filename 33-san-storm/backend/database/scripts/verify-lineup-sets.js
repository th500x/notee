const { pool } = require('../../database/connection');

(async () => {
  const [t] = await pool.query("SHOW TABLES LIKE 'player_lineup_sets'");
  const [g] = await pool.query("SHOW TABLES LIKE 'player_garrison'");
  const [e] = await pool.query("SHOW TABLES LIKE 'player_lineup_extra'");
  const [a] = await pool.query("SHOW TABLES LIKE '_archive_player_garrison'");
  const [c] = await pool.query(
    'SELECT lineup_scope, COUNT(*) AS n FROM player_lineup_sets GROUP BY lineup_scope',
  );
  console.log({
    sets: t.length,
    garrison_live: g.length,
    extra_live: e.length,
    archive: a.length,
    counts: c,
  });
  require('../../services/garrisonService');
  require('../../services/lineupExtraService');
  console.log('services ok');
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
