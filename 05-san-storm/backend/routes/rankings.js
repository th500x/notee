/**
 * 排行榜路由
 * 
 * @description 活动排名 API
 * @see 15-STATISTICS_RANKING_SYSTEM.md
 * @see 01-1-DATABASE_DESIGN.md 4.3 temp_ranking_snapshots
 */

const express = require('express');
const { pool } = require('../database/connection');

const router = express.Router();

/**
 * GET /api/rankings/:eventId
 * 获取活动排行榜
 * 
 * Query: ?limit=10&playerId=p001
 * - limit: 显示前几名（默认10）
 * - playerId: 当前玩家ID（用于查询"我的排名"）
 */
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const playerId = req.query.playerId || null;

    // 查询排行榜（前 N 名）
    const [rankings] = await pool.query(`
      SELECT 
        s.player_id,
        p.character_name AS name,
        (s.total_battle_score - snap.snapshot_battle_score) AS delta_battle,
        (s.total_events_completed - snap.snapshot_events_completed) AS delta_events,
        (s.total_reputation_earned - snap.snapshot_reputation 
         + s.total_contribution_earned - snap.snapshot_contribution) AS delta_rep_contrib,
        (s.total_gold_earned - snap.snapshot_silver 
         + s.total_food_earned - snap.snapshot_food) AS delta_silver_food,
        (s.total_battle_score - snap.snapshot_battle_score) * 1
        + (s.total_events_completed - snap.snapshot_events_completed) * 300
        + (s.total_reputation_earned - snap.snapshot_reputation 
           + s.total_contribution_earned - snap.snapshot_contribution) * 30
        + (s.total_gold_earned - snap.snapshot_silver 
           + s.total_food_earned - snap.snapshot_food) * 3
        AS total_score
      FROM statistics s
      JOIN temp_ranking_snapshots snap 
        ON s.player_id = snap.player_id AND snap.event_id = ?
      JOIN players p ON s.player_id = p.player_id
      ORDER BY 
        total_score DESC,
        delta_battle DESC,
        delta_events DESC,
        delta_rep_contrib DESC,
        delta_silver_food DESC
      LIMIT ?
    `, [eventId, limit]);

    // 格式化排名列表
    const formattedRankings = rankings.map((row, index) => ({
      rank: index + 1,
      playerId: row.player_id,
      name: row.name || row.player_id,
      totalScore: Number(row.total_score) || 0,
      battleScore: Number(row.delta_battle) || 0,
      eventsCompleted: Number(row.delta_events) || 0,
      repContrib: Number(row.delta_rep_contrib) || 0,
      silverFood: Number(row.delta_silver_food) || 0,
    }));

    // 查询"我的排名"
    let myRanking = null;
    if (playerId) {
      // 先检查该玩家是否有快照
      let [snapCheck] = await pool.query(
        'SELECT 1 FROM temp_ranking_snapshots WHERE event_id = ? AND player_id = ?',
        [eventId, playerId]
      );

      // 活动期间新玩家自动补建快照（增量从当前值开始，即0分起步）
      if (snapCheck.length === 0) {
        try {
          await pool.query(`
            INSERT IGNORE INTO temp_ranking_snapshots
              (event_id, player_id,
               snapshot_battle_score, snapshot_events_completed,
               snapshot_reputation, snapshot_contribution,
               snapshot_silver, snapshot_food, expires_at)
            SELECT ?, ?,
              s.total_battle_score, s.total_events_completed,
              s.total_reputation_earned, s.total_contribution_earned,
              s.total_gold_earned, s.total_food_earned,
              DATE_ADD(NOW(), INTERVAL 30 DAY)
            FROM statistics s WHERE s.player_id = ?
          `, [eventId, playerId, playerId]);
          // 重新检查
          [snapCheck] = await pool.query(
            'SELECT 1 FROM temp_ranking_snapshots WHERE event_id = ? AND player_id = ?',
            [eventId, playerId]
          );
        } catch (e) {
          console.warn('[Rankings] 自动补建快照失败:', e.message);
        }
      }

      if (snapCheck.length > 0) {
        // 计算该玩家的总分
        const [myScore] = await pool.query(`
          SELECT 
            (s.total_battle_score - snap.snapshot_battle_score) AS delta_battle,
            (s.total_events_completed - snap.snapshot_events_completed) AS delta_events,
            (s.total_reputation_earned - snap.snapshot_reputation 
             + s.total_contribution_earned - snap.snapshot_contribution) AS delta_rep_contrib,
            (s.total_gold_earned - snap.snapshot_silver 
             + s.total_food_earned - snap.snapshot_food) AS delta_silver_food,
            (s.total_battle_score - snap.snapshot_battle_score) * 1
            + (s.total_events_completed - snap.snapshot_events_completed) * 300
            + (s.total_reputation_earned - snap.snapshot_reputation 
               + s.total_contribution_earned - snap.snapshot_contribution) * 30
            + (s.total_gold_earned - snap.snapshot_silver 
               + s.total_food_earned - snap.snapshot_food) * 3
            AS total_score
          FROM statistics s
          JOIN temp_ranking_snapshots snap 
            ON s.player_id = snap.player_id AND snap.event_id = ?
          WHERE s.player_id = ?
        `, [eventId, playerId]);

        if (myScore.length > 0) {
          const myTotalScore = Number(myScore[0].total_score) || 0;

          // 计算排名（比我分高的人数 + 1）
          const [rankResult] = await pool.query(`
            SELECT COUNT(*) AS higher_count
            FROM statistics s
            JOIN temp_ranking_snapshots snap 
              ON s.player_id = snap.player_id AND snap.event_id = ?
            WHERE 
              (s.total_battle_score - snap.snapshot_battle_score) * 1
              + (s.total_events_completed - snap.snapshot_events_completed) * 300
              + (s.total_reputation_earned - snap.snapshot_reputation 
                 + s.total_contribution_earned - snap.snapshot_contribution) * 30
              + (s.total_gold_earned - snap.snapshot_silver 
                 + s.total_food_earned - snap.snapshot_food) * 3
              > ?
          `, [eventId, myTotalScore]);

          myRanking = {
            rank: (rankResult[0]?.higher_count || 0) + 1,
            totalScore: myTotalScore,
            battleScore: Number(myScore[0].delta_battle) || 0,
            eventsCompleted: Number(myScore[0].delta_events) || 0,
            repContrib: Number(myScore[0].delta_rep_contrib) || 0,
            silverFood: Number(myScore[0].delta_silver_food) || 0,
          };
        }
      }
    }

    // 总参与人数
    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS total FROM temp_ranking_snapshots WHERE event_id = ?',
      [eventId]
    );

    res.json({
      success: true,
      data: {
        rankings: formattedRankings,
        myRanking,
        totalParticipants: countResult[0]?.total || 0,
        updatedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('[Rankings] 获取排行榜失败:', error);
    res.status(500).json({ success: false, error: '获取排行榜失败' });
  }
});

module.exports = router;
