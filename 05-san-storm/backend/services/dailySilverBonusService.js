/**
 * 称号/成就 daily_silver_bonus：编组已装备卡日发银两（幂等按自然日）
 *
 * @see docs/00-base/04-2-DATA_TERM_DICTIONARY.md §7 · 25-1 / 25-2
 */

const { pool } = require('../database/connection');
const { parseDailySilverBonus } = require('../../shared/utils/specialEffectMarkers.cjs');
const {
  ensureTitleProgressRow,
  loadTitleProgress,
  saveTitleProgress,
} = require('./titleProgressStore');
const { recordEarned } = require('./statisticsDeltaService');

function mysqlDateToYmd(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

/**
 * 统计玩家编组槽（player / character1 / character2）已装备称号+成就的日银加成
 *
 * @param {*} connection
 * @param {string} playerId
 * @returns {Promise<number>}
 */
async function sumEquippedDailySilverBonus(connection, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return 0;

  const [rows] = await connection.query(
    `SELECT pc.card_type AS cardType, pc.card_id AS cardId
       FROM player_cards pc
      WHERE pc.player_id = ?
        AND pc.is_equipped = TRUE
        AND pc.equipped_slot IN ('title', 'achievement')
        AND pc.equipped_by IN ('player', 'character1', 'character2')
        AND pc.card_type IN ('title', 'achievement')`,
    [pid],
  );
  if (!rows.length) return 0;

  const titleIds = [...new Set(rows.filter((r) => r.cardType === 'title').map((r) => r.cardId))];
  const achIds = [...new Set(rows.filter((r) => r.cardType === 'achievement').map((r) => r.cardId))];

  let total = 0;
  if (titleIds.length) {
    const ph = titleIds.map(() => '?').join(',');
    const [tRows] = await connection.query(
      `SELECT special_effect FROM config_titles WHERE title_id IN (${ph})`,
      titleIds,
    );
    for (const r of tRows) total += parseDailySilverBonus(r.special_effect);
  }
  if (achIds.length) {
    const ph = achIds.map(() => '?').join(',');
    const [aRows] = await connection.query(
      `SELECT special_effect FROM config_achievements WHERE achievement_id IN (${ph})`,
      achIds,
    );
    for (const r of aRows) total += parseDailySilverBonus(r.special_effect);
  }
  return total;
}

/**
 * 档案拉取或登录后尝试发放当日额外银两
 *
 * @param {string} playerId
 * @returns {Promise<{ granted: number, date: string|null }>}
 */
async function grantDailySilverBonusIfDue(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { granted: 0, date: null };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const today = mysqlDateToYmd(dr[0].d);

    await ensureTitleProgressRow(conn, pid);
    const progress = await loadTitleProgress(conn, pid);
    if (progress.dailySilverBonusLastDate && progress.dailySilverBonusLastDate >= today) {
      await conn.commit();
      return { granted: 0, date: today };
    }

    const bonus = await sumEquippedDailySilverBonus(conn, pid);
    if (bonus <= 0) {
      progress.dailySilverBonusLastDate = today;
      await saveTitleProgress(conn, pid, progress);
      await conn.commit();
      return { granted: 0, date: today };
    }

    await conn.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [bonus, pid]);
    progress.dailySilverBonusLastDate = today;
    await saveTitleProgress(conn, pid, progress);
    await conn.commit();

    recordEarned(pid, { silver: bonus }).catch((err) => {
      console.warn('[dailySilverBonus] recordEarned failed', pid, err?.message || err);
    });

    return { granted: bonus, date: today };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    console.error('[dailySilverBonus] grant failed', pid, err?.message || err);
    return { granted: 0, date: null };
  } finally {
    conn.release();
  }
}

module.exports = {
  sumEquippedDailySilverBonus,
  grantDailySilverBonusIfDue,
};
