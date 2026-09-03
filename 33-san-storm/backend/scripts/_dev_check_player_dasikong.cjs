/**
 * 单玩家大司空诊断：node scripts/_dev_check_player_dasikong.cjs 11JQ
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const aiKingDasikongDailyService = require('../services/aiKingDasikongDailyService');
const kingDasikongRankingService = require('../services/kingDasikongRankingService');
const { EVENT_ID } = require('../config/kingDasikongDaily');

const pid = process.argv[2] ? String(process.argv[2]).trim() : '11JQ';

(async () => {
  const conn = await pool.getConnection();
  try {
    const [p] = await conn.query(
      `SELECT p.player_id, p.faction_id, p.character_name, p.current_position_id, p.position_level,
              a.account_type, a.status, DATE_FORMAT(p.created_at,'%Y-%m-%d') AS created_ymd
       FROM players p LEFT JOIN accounts a ON a.id = p.player_id WHERE p.player_id = ?`,
      [pid],
    );
    console.log('player', JSON.stringify(p[0] || null, null, 2));
    const fid = p[0]?.faction_id;
    if (!fid) {
      console.log('no player or faction');
      process.exit(0);
    }

    const diag = await aiKingDasikongDailyService.getFactionDasikongDiagnostic(fid);
    console.log('\n=== faction diagnostic ===');
    console.log(JSON.stringify(diag, null, 2));

    const stale = await kingDasikongRankingService.isFactionBaselineStale(conn, fid, EVENT_ID);
    const processed = await kingDasikongRankingService.hasProcessedToday(conn, fid, EVENT_ID);
    const eligible = await kingDasikongRankingService.countEligibleRealPlayers(conn, fid);
    const pastBootstrap = await kingDasikongRankingService.isFactionPastDasikongBootstrapDay(conn, fid);

    console.log('\n=== catch-up decision ===');
    console.log(
      JSON.stringify(
        {
          stale: stale.stale,
          needsBootstrap: stale.snapCount === 0 && eligible > 0,
          processedToday: processed,
          eligibleReal: eligible,
          pastBootstrapDay: pastBootstrap,
          wouldSkipCatchUp: !stale.stale && !(stale.snapCount === 0 && eligible > 0),
        },
        null,
        2,
      ),
    );

    const [snaps] = await conn.query(
      `SELECT snap.player_id, DATE_FORMAT(snap.baseline_date,'%Y-%m-%d') AS baseline_date,
              snap.snapshot_battle_score, COALESCE(s.total_battle_score,0) AS total_battle
       FROM temp_event_ranking snap
       JOIN players pl ON pl.player_id = snap.player_id
       LEFT JOIN player_statistics s ON s.player_id = snap.player_id
       WHERE snap.event_id = ? AND pl.faction_id = ?
       ORDER BY snap.player_id LIMIT 30`,
      [EVENT_ID, fid],
    );
    console.log('\n=== snapshots ===');
    console.log(JSON.stringify(snaps, null, 2));

    const [texts] = await conn.query(
      `SELECT id, subject, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') AS ts
       FROM player_texts
       WHERE receiver_id = ? AND subject LIKE '%大司空%'
       ORDER BY created_at DESC LIMIT 5`,
      [pid],
    );
    console.log('\n=== recent dasikong mails to player ===');
    console.log(JSON.stringify(texts, null, 2));
  } finally {
    conn.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
