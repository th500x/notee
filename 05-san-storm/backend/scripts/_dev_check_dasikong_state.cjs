require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const kingDasikongRankingService = require('../services/kingDasikongRankingService');
const { EVENT_ID } = require('../config/kingDasikongDaily');

(async () => {
  const [d] = await pool.query('SELECT CURDATE() AS d, NOW() AS n');
  console.log('server', d[0]);

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temp_event_ranking'
       AND COLUMN_NAME = 'baseline_date'`,
  );
  console.log('baseline_date column:', cols.length > 0 ? 'yes' : 'MISSING');

  const [rows] = await pool.query(
    `SELECT p.faction_id, snap.player_id, p.character_name, snap.baseline_date,
            snap.snapshot_battle_score, COALESCE(s.total_battle_score,0) AS cur_battle,
            (COALESCE(s.total_battle_score,0) - snap.snapshot_battle_score) AS delta_battle
     FROM temp_event_ranking snap
     JOIN players p ON p.player_id = snap.player_id
     LEFT JOIN player_statistics s ON s.player_id = snap.player_id
     WHERE snap.event_id = ?
     ORDER BY snap.baseline_date DESC, p.faction_id
     LIMIT 20`,
    [EVENT_ID],
  );
  console.log('snapshots sample:', rows);

  const [proc] = await pool.query(
    `SELECT p.faction_id, COUNT(*) AS c
     FROM temp_event_ranking snap
     JOIN players p ON p.player_id = snap.player_id
     WHERE snap.event_id = ? AND snap.baseline_date = CURDATE()
     GROUP BY p.faction_id`,
    [EVENT_ID],
  );
  console.log('processed_today (baseline_date=CURDATE):', proc);

  const [snapCounts] = await pool.query(
    `SELECT p.faction_id, COUNT(*) AS c
     FROM temp_event_ranking snap
     JOIN players p ON p.player_id = snap.player_id
     WHERE snap.event_id = ?
     GROUP BY p.faction_id`,
    [EVENT_ID],
  );
  console.log('snapshots per faction:', snapCounts);

  const conn = await pool.getConnection();
  try {
    for (const row of snapCounts.slice(0, 3)) {
      const fid = row.faction_id;
      const processed = await kingDasikongRankingService.hasProcessedToday(conn, fid, EVENT_ID);
      const winner = await kingDasikongRankingService.pickDailyWinner(conn, fid, EVENT_ID);
      const ranking = await kingDasikongRankingService.listDailyActivityRanking(fid, 5, conn);
      console.log('faction', fid, { processed, winner, ranking });
    }
  } finally {
    conn.release();
  }

  const [edicts] = await pool.query(
    `SELECT created_at, content FROM faction_bulletins
     WHERE category = 'edict' AND content LIKE '%大司空%'
     ORDER BY created_at DESC LIMIT 5`,
  );
  console.log('recent edicts:', edicts);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
