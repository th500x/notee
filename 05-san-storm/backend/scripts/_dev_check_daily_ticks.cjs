/**
 * 势力储备日恢复 + 大司空日榜 · 本地诊断
 *   cd 05-san-storm/backend && node scripts/_dev_check_daily_ticks.cjs [factionId]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const { runDailyReserveRecoveryTick } = require('../services/factionReserveRecoveryService');
const aiKingDasikongDailyService = require('../services/aiKingDasikongDailyService');

const onlyFaction = process.argv[2] ? String(process.argv[2]).trim() : '';

(async () => {
  const [dr] = await pool.query('SELECT CURDATE() AS d, NOW() AS nowTs, @@session.time_zone AS tz');
  console.log('MySQL', dr[0]);

  const [factions] = await pool.query('SELECT id FROM factions ORDER BY id');
  for (const { id: fid } of factions) {
    if (onlyFaction && fid !== onlyFaction) continue;
    const [bal] = await pool.query(
      `SELECT silver, food, troop_legendary, character_legendary, recovery_applied_date
       FROM faction_reserve WHERE faction_id = ? AND category = 'pool'`,
      [fid],
    );
    const [cities] = await pool.query(
      `SELECT COUNT(*) AS c FROM cities
       WHERE faction_id = ? AND status = 'owned'
         AND city_type IN ('city_small','city_medium','city_major')`,
      [fid],
    );
    const [players] = await pool.query(
      `SELECT COUNT(*) AS c FROM players p
       INNER JOIN accounts a ON a.id = p.player_id
         AND COALESCE(NULLIF(TRIM(a.account_type), ''), 'real') = 'real' AND a.status = 'active'
       WHERE p.faction_id = ? AND p.player_id <> 'sys1'`,
      [fid],
    );
    console.log('\n---', fid, '---');
    console.log('pool', bal[0] || '(no row)');
    console.log('ownedCities', cities[0].c, 'eligibleReal', players[0].c);
  }

  if (onlyFaction) {
    const diag = await aiKingDasikongDailyService.getFactionDasikongDiagnostic(onlyFaction);
    console.log('\n[dasikong diagnostic]', JSON.stringify(diag, null, 2));
  }

  console.log('\n[dry-run] runDailyReserveRecoveryTick...');
  const recovery = await runDailyReserveRecoveryTick();
  console.log(JSON.stringify(recovery, null, 2));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
