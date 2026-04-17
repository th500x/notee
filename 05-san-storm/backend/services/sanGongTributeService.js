/**
 * 三公府 · 朝政 · 朝贡：销毁军营池内部队卡，按攻城 NPC 单杀银两/贡献的 1.5 倍补偿玩家；势力储备银两同额、粮草为银两 5 倍。
 */

const { pool } = require('../database/connection');
const { getEligibleBarracksTroopInstanceIds } = require('./playerBarracksTroopPoolService');
const { tributeCompensationPerTroopCard } = require('../../shared/utils/siegeKillEconomyByRarity.cjs');
const statisticsDeltaService = require('./statisticsDeltaService');

const MAX_PER_CALENDAR_DAY = 5;

function mysqlDateToYmd(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * @param {string} playerId
 * @returns {Promise<{ usedToday: number, remainingToday: number, maxPerDay: number }>}
 */
async function getTributeDailyStatus(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { usedToday: 0, remainingToday: MAX_PER_CALENDAR_DAY, maxPerDay: MAX_PER_CALENDAR_DAY };

  await pool.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
  const [rows] = await pool.query(
    'SELECT san_gong_tribute_date, san_gong_tribute_count FROM player_events WHERE player_id = ?',
    [pid],
  );
  const row = rows[0] || {};
  const [dr] = await pool.query('SELECT CURDATE() AS d');
  const todayStr = mysqlDateToYmd(dr[0].d);
  const stored = mysqlDateToYmd(row.san_gong_tribute_date);
  let used = 0;
  if (stored && stored === todayStr) {
    used = Math.max(0, Math.min(MAX_PER_CALENDAR_DAY, Number(row.san_gong_tribute_count) || 0));
  }
  return {
    usedToday: used,
    remainingToday: Math.max(0, MAX_PER_CALENDAR_DAY - used),
    maxPerDay: MAX_PER_CALENDAR_DAY,
  };
}

/**
 * @param {string} playerId
 * @param {string[]} instanceIds
 * @returns {Promise<
 *   | { ok: true; silver: number; contribution: number; factionSilver: number; factionFood: number; deleted: number }
 *   | { ok: false; status: number; error: string }
 * >}
 */
async function submitTroopTribute(playerId, instanceIds) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: '缺少 playerId' };
  const ids = [...new Set((instanceIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (ids.length === 0) return { ok: false, status: 400, error: '请选择至少一张部队卡' };
  if (ids.length > MAX_PER_CALENDAR_DAY) {
    return { ok: false, status: 400, error: `单次最多选择 ${MAX_PER_CALENDAR_DAY} 张` };
  }

  const eligible = new Set(await getEligibleBarracksTroopInstanceIds(pid));
  for (const id of ids) {
    if (!eligible.has(id)) {
      return { ok: false, status: 400, error: '仅可朝贡当前军营池内的部队卡（未上阵、未在驻地槽、次数未满或传奇）' };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [dr] = await conn.query('SELECT CURDATE() AS d');
    const todayStr = mysqlDateToYmd(dr[0].d);

    const [peRows] = await conn.query(
      'SELECT san_gong_tribute_date, san_gong_tribute_count FROM player_events WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    if (!peRows.length) {
      await conn.query('INSERT IGNORE INTO player_events (player_id) VALUES (?)', [pid]);
    }
    const [pe2] = await conn.query(
      'SELECT san_gong_tribute_date, san_gong_tribute_count FROM player_events WHERE player_id = ? FOR UPDATE',
      [pid],
    );
    const pe = pe2[0] || {};
    const stored = mysqlDateToYmd(pe.san_gong_tribute_date);
    let used = 0;
    if (stored && stored === todayStr) {
      used = Math.max(0, Number(pe.san_gong_tribute_count) || 0);
    }
    if (used + ids.length > MAX_PER_CALENDAR_DAY) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: `今日朝贡额度不足（已用 ${used}/${MAX_PER_CALENDAR_DAY}，本次选中 ${ids.length} 张）`,
      };
    }

    const [pRows] = await conn.query('SELECT faction_id FROM players WHERE player_id = ? LIMIT 1', [pid]);
    const factionId = pRows[0]?.faction_id;
    if (!factionId) {
      await conn.rollback();
      return { ok: false, status: 400, error: '无势力归属，无法朝贡' };
    }

    const ph = ids.map(() => '?').join(',');
    const [cardRows] = await conn.query(
      `SELECT instance_id, rarity FROM player_cards
       WHERE player_id = ? AND card_type = 'troop' AND instance_id IN (${ph})`,
      [pid, ...ids],
    );
    if (cardRows.length !== ids.length) {
      await conn.rollback();
      return { ok: false, status: 400, error: '部分部队卡不存在或已不在背包，请刷新后重试' };
    }

    let totalSilver = 0;
    let totalContribution = 0;
    for (const c of cardRows) {
      const { silver, contribution } = tributeCompensationPerTroopCard(c.rarity);
      totalSilver += silver;
      totalContribution += contribution;
    }

    const [delRes] = await conn.query(
      `DELETE FROM player_cards WHERE player_id = ? AND card_type = 'troop' AND instance_id IN (${ph})`,
      [pid, ...ids],
    );
    if (!delRes || delRes.affectedRows !== ids.length) {
      await conn.rollback();
      return { ok: false, status: 400, error: '销毁部队卡失败（可能已上阵或在驻地），请刷新后重试' };
    }

    const newCount = stored === todayStr ? used + ids.length : ids.length;
    await conn.query(
      `UPDATE player_events SET san_gong_tribute_date = ?, san_gong_tribute_count = ? WHERE player_id = ?`,
      [todayStr, newCount, pid],
    );

    if (totalSilver > 0) {
      await conn.query('UPDATE players SET silver = silver + ? WHERE player_id = ?', [totalSilver, pid]);
    }
    if (totalContribution > 0) {
      await conn.query('UPDATE players SET contribution = contribution + ? WHERE player_id = ?', [
        totalContribution,
        pid,
      ]);
    }

    const factionFood = totalSilver * 5;
    await conn.query(
      'UPDATE factions SET reserve_silver = reserve_silver + ?, reserve_food = reserve_food + ? WHERE id = ?',
      [totalSilver, factionFood, factionId],
    );

    await conn.commit();

    await statisticsDeltaService.recordEarned(pid, {
      ...(totalSilver > 0 ? { silver: totalSilver } : {}),
      ...(totalContribution > 0 ? { contribution: totalContribution } : {}),
    });

    return {
      ok: true,
      silver: totalSilver,
      contribution: totalContribution,
      factionSilver: totalSilver,
      factionFood,
      deleted: ids.length,
    };
  } catch (e) {
    await conn.rollback();
    const msg = e?.message || String(e);
    if (/Unknown column ['`]san_gong_tribute/i.test(msg)) {
      return {
        ok: false,
        status: 503,
        error: '数据库缺少朝贡日限列。请在 backend 目录执行 node scripts/apply-pending-local-ddl.js',
      };
    }
    console.error('[sanGongTributeService] submitTroopTribute', e);
    return { ok: false, status: 500, error: '朝贡处理失败' };
  } finally {
    conn.release();
  }
}

module.exports = {
  getTributeDailyStatus,
  submitTroopTribute,
  MAX_PER_CALENDAR_DAY,
};
