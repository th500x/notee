/**
 * 排行榜路由
 *
 * @description 活动排名 API
 * @see 19-1-STATISTICS_RANKING_SYSTEM.md
 * @see 01-1-DATABASE_DESIGN.md 4.3 temp_ranking_snapshots
 */

const express = require('express');
const { pool } = require('../database/connection');
const ACTIVITY_RANKING_EVENTS = require('../config/activityRankingEvents');

const router = express.Router();

/** 无迁移列时用实时差值（旧行为）；有列时用 COALESCE 支持活动结束后定格 */
const LEGACY_DELTA_BATTLE = `s.total_battle_score - snap.snapshot_battle_score`;
const LEGACY_DELTA_EVENTS = `s.total_events_completed - snap.snapshot_events_completed`;
const LEGACY_DELTA_REP = `(s.total_reputation_earned - snap.snapshot_reputation + s.total_contribution_earned - snap.snapshot_contribution)`;
const LEGACY_DELTA_SF = `(s.total_gold_earned - snap.snapshot_silver + s.total_food_earned - snap.snapshot_food)`;

const legacyFragments = {
  battle: LEGACY_DELTA_BATTLE,
  events: LEGACY_DELTA_EVENTS,
  rep: LEGACY_DELTA_REP,
  sf: LEGACY_DELTA_SF,
};

let rankingFrozenSchema = { checked: false, hasColumns: false };

async function getDeltaSqlFragments() {
  if (!rankingFrozenSchema.checked) {
    try {
      const [rows] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temp_ranking_snapshots'
         AND COLUMN_NAME = 'frozen_delta_battle'`
      );
      rankingFrozenSchema.hasColumns = Number(rows[0]?.c) > 0;
    } catch (e) {
      console.warn('[Rankings] 无法检测 frozen 列，使用实时差值:', e.message);
      rankingFrozenSchema.hasColumns = false;
    }
    rankingFrozenSchema.checked = true;
  }
  if (!rankingFrozenSchema.hasColumns) return legacyFragments;
  return {
    battle: `COALESCE(snap.frozen_delta_battle, ${LEGACY_DELTA_BATTLE})`,
    events: `COALESCE(snap.frozen_delta_events, ${LEGACY_DELTA_EVENTS})`,
    rep: `COALESCE(snap.frozen_delta_rep_contrib, ${LEGACY_DELTA_REP})`,
    sf: `COALESCE(snap.frozen_delta_silver_food, ${LEGACY_DELTA_SF})`,
  };
}

/**
 * 活动已到结束时间且尚未写入 frozen_at 时，将当前四项增量写入 frozen_delta_* 并定格（与 announcements 及 activityRankingEvents 同步）
 */
async function ensureRankingFrozen(eventId, hasFrozenCols) {
  if (!hasFrozenCols) return;
  const cfg = ACTIVITY_RANKING_EVENTS[eventId];
  if (!cfg || !cfg.endTime) return;
  const endMs = new Date(cfg.endTime).getTime();
  if (Number.isNaN(endMs) || Date.now() <= endMs) return;

  try {
    const [done] = await pool.query(
      'SELECT frozen_at FROM temp_ranking_snapshots WHERE event_id = ? AND frozen_at IS NOT NULL LIMIT 1',
      [eventId]
    );
    if (done.length > 0) return;

    await pool.query(
      `UPDATE temp_ranking_snapshots snap
       JOIN statistics s ON s.player_id = snap.player_id
       SET
         snap.frozen_delta_battle = s.total_battle_score - snap.snapshot_battle_score,
         snap.frozen_delta_events = s.total_events_completed - snap.snapshot_events_completed,
         snap.frozen_delta_rep_contrib = (s.total_reputation_earned - snap.snapshot_reputation
           + s.total_contribution_earned - snap.snapshot_contribution),
         snap.frozen_delta_silver_food = (s.total_gold_earned - snap.snapshot_silver
           + s.total_food_earned - snap.snapshot_food),
         snap.frozen_at = NOW()
       WHERE snap.event_id = ? AND snap.frozen_at IS NULL`,
      [eventId]
    );
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR' || (e.message && String(e.message).includes('Unknown column'))) {
      console.warn(
        '[Rankings] 跳过积分冻结（请先执行 migrations/add-temp-ranking-snapshots-frozen-deltas.sql）:',
        eventId
      );
      return;
    }
    throw e;
  }
}

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

    const d = await getDeltaSqlFragments();
    await ensureRankingFrozen(eventId, rankingFrozenSchema.hasColumns);

    // 查询排行榜（前 N 名）
    const [rankings] = await pool.query(
      `
      SELECT 
        s.player_id,
        p.character_name AS name,
        (${d.battle}) AS delta_battle,
        (${d.events}) AS delta_events,
        (${d.rep}) AS delta_rep_contrib,
        (${d.sf}) AS delta_silver_food,
        (${d.battle}) * 1
        + (${d.events}) * 300
        + (${d.rep}) * 30
        + (${d.sf}) * 3
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
    `,
      [eventId, limit]
    );

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
          await pool.query(
            `
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
          `,
            [eventId, playerId, playerId]
          );
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
        const [myScore] = await pool.query(
          `
          SELECT 
            (${d.battle}) AS delta_battle,
            (${d.events}) AS delta_events,
            (${d.rep}) AS delta_rep_contrib,
            (${d.sf}) AS delta_silver_food,
            (${d.battle}) * 1
            + (${d.events}) * 300
            + (${d.rep}) * 30
            + (${d.sf}) * 3
            AS total_score
          FROM statistics s
          JOIN temp_ranking_snapshots snap 
            ON s.player_id = snap.player_id AND snap.event_id = ?
          WHERE s.player_id = ?
        `,
          [eventId, playerId]
        );

        if (myScore.length > 0) {
          const myTotalScore = Number(myScore[0].total_score) || 0;

          // 计算排名（比我分高的人数 + 1）
          const [rankResult] = await pool.query(
            `
            SELECT COUNT(*) AS higher_count
            FROM statistics s
            JOIN temp_ranking_snapshots snap 
              ON s.player_id = snap.player_id AND snap.event_id = ?
            WHERE 
              (${d.battle}) * 1
              + (${d.events}) * 300
              + (${d.rep}) * 30
              + (${d.sf}) * 3
              > ?
          `,
            [eventId, myTotalScore]
          );

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
      },
    });
  } catch (error) {
    console.error('[Rankings] 获取排行榜失败:', error);
    res.status(500).json({ success: false, error: '获取排行榜失败' });
  }
});

module.exports = router;
